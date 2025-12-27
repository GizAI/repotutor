'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Code2, X } from 'lucide-react';
import { DiffViewer } from '@/components/ui/DiffViewer';
import { useT } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface CommitNode {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  email: string;
  date: string;
  relativeDate: string;
  branches: string[];
  tags: string[];
  isHead: boolean;
  // Layout properties
  x?: number;
  y?: number;
  column?: number;
}

interface CommitGraphProps {
  embedded?: boolean;
  onCommitSelect?: (hash: string) => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
];

export function CommitGraph({ embedded = false, onCommitSelect }: CommitGraphProps) {
  const { t } = useT();
  const isMobile = useIsMobile();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('--all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null);
  const [commitDiff, setCommitDiff] = useState<string | null>(null);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/git/graph?branch=${encodeURIComponent(selectedBranch)}&limit=100`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCommits(data.commits || []);
        setBranches(data.branches || []);
        setCurrentBranch(data.currentBranch || '');
        setError(null);
      }
    } catch {
      setError('Failed to load graph');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Render D3 graph
  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const NODE_RADIUS = 6;
    const ROW_HEIGHT = 40;
    const COL_WIDTH = 20;
    const PADDING_LEFT = 30;
    const PADDING_TOP = 20;

    // Calculate column assignments for each commit
    const hashToIndex = new Map<string, number>();
    const columnAssignments = new Map<string, number>();
    const activeColumns = new Set<number>();

    commits.forEach((commit, index) => {
      hashToIndex.set(commit.hash, index);
    });

    // Assign columns to commits
    commits.forEach((commit, index) => {
      // Find available column
      let column = 0;
      while (activeColumns.has(column)) {
        column++;
      }

      // Check if this is a continuation of a parent branch
      for (const parentHash of commit.parents) {
        const parentColumn = columnAssignments.get(parentHash);
        if (parentColumn !== undefined && !activeColumns.has(parentColumn)) {
          column = parentColumn;
          break;
        }
      }

      columnAssignments.set(commit.hash, column);
      activeColumns.add(column);

      // Free columns for commits that have all children processed
      const parentIndices = commit.parents.map((p) => hashToIndex.get(p) || -1);
      for (const parentHash of commit.parents) {
        const parentIndex = hashToIndex.get(parentHash);
        if (parentIndex !== undefined) {
          const isLastChild = commits
            .slice(0, index)
            .every((c) => !c.parents.includes(parentHash));
          if (isLastChild) {
            activeColumns.delete(columnAssignments.get(parentHash) || 0);
          }
        }
      }

      commit.column = column;
      commit.x = PADDING_LEFT + column * COL_WIDTH;
      commit.y = PADDING_TOP + index * ROW_HEIGHT;
    });

    const maxColumn = Math.max(...commits.map((c) => c.column || 0));
    const graphWidth = PADDING_LEFT + (maxColumn + 1) * COL_WIDTH + 20;
    const totalHeight = PADDING_TOP + commits.length * ROW_HEIGHT;

    // Create graph group
    const g = svg.append('g');

    // Draw edges (parent connections)
    const linkGroup = g.append('g').attr('class', 'links');

    commits.forEach((commit) => {
      const startX = commit.x!;
      const startY = commit.y!;

      commit.parents.forEach((parentHash) => {
        const parentIndex = hashToIndex.get(parentHash);
        if (parentIndex === undefined) return;

        const parent = commits[parentIndex];
        if (!parent) return;

        const endX = parent.x!;
        const endY = parent.y!;

        const color = COLORS[(commit.column || 0) % COLORS.length];

        // Draw curved line for branch merges
        if (commit.column !== parent.column) {
          // Bezier curve
          const midY = (startY + endY) / 2;
          linkGroup
            .append('path')
            .attr(
              'd',
              `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
            )
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        } else {
          // Straight line
          linkGroup
            .append('line')
            .attr('x1', startX)
            .attr('y1', startY)
            .attr('x2', endX)
            .attr('y2', endY)
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        }
      });
    });

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');

    commits.forEach((commit) => {
      const color = COLORS[(commit.column || 0) % COLORS.length];
      const isHovered = hoveredCommit === commit.hash;
      const isSelected = selectedCommit?.hash === commit.hash;

      const node = nodeGroup
        .append('g')
        .attr('transform', `translate(${commit.x}, ${commit.y})`)
        .attr('cursor', 'pointer')
        .on('click', () => handleCommitClick(commit))
        .on('mouseenter', () => setHoveredCommit(commit.hash))
        .on('mouseleave', () => setHoveredCommit(null));

      // Node circle
      if (commit.isHead) {
        // HEAD indicator
        node
          .append('circle')
          .attr('r', NODE_RADIUS + 3)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 2);
      }

      node
        .append('circle')
        .attr('r', NODE_RADIUS)
        .attr('fill', commit.branches.length > 0 || commit.tags.length > 0 ? color : 'var(--bg-secondary)')
        .attr('stroke', color)
        .attr('stroke-width', 2);

      // Branch/tag labels
      let labelX = graphWidth - commit.x!;
      if (commit.branches.length > 0 || commit.tags.length > 0) {
        const labels = [...commit.branches, ...commit.tags.map((t) => `🏷️ ${t}`)];
        labels.forEach((label, i) => {
          const isCurrent = label === currentBranch;
          node
            .append('rect')
            .attr('x', 12 + i * 80)
            .attr('y', -8)
            .attr('width', 75)
            .attr('height', 16)
            .attr('rx', 8)
            .attr('fill', isCurrent ? color : 'var(--bg-tertiary)');

          node
            .append('text')
            .attr('x', 12 + i * 80 + 37)
            .attr('y', 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', isCurrent ? 'white' : 'var(--text-secondary)')
            .text(label.length > 10 ? label.slice(0, 10) + '…' : label);
        });
      }

      // Commit message
      node
        .append('text')
        .attr('x', graphWidth - commit.x! + 10)
        .attr('y', 4)
        .attr('font-size', '12px')
        .attr('fill', isHovered || isSelected ? 'var(--accent)' : 'var(--text-primary)')
        .text(
          `${commit.shortHash} • ${commit.message.length > 50 ? commit.message.slice(0, 50) + '…' : commit.message}`
        );
    });

    // Set viewBox for scrolling
    svg.attr('viewBox', `0 0 ${dimensions.width} ${totalHeight}`);
    svg.attr('height', totalHeight);

  }, [commits, dimensions, hoveredCommit, selectedCommit, currentBranch]);

  // Fetch commit diff
  const fetchCommitDiff = async (hash: string) => {
    try {
      const response = await fetch(`/api/git/diff?commit=${encodeURIComponent(hash)}`);
      const data = await response.json();
      setCommitDiff(data.diff || '');
    } catch {
      setCommitDiff('Failed to load diff');
    }
  };

  const handleCommitClick = (commit: CommitNode) => {
    setSelectedCommit(commit);
    fetchCommitDiff(commit.hash);
    onCommitSelect?.(commit.hash);
  };

  // Use mobile timeline for mobile devices
  if (isMobile) {
    const { CommitTimeline } = require('./CommitTimeline');
    return <CommitTimeline embedded={embedded} onCommitSelect={onCommitSelect} />;
  }

  const containerClass = embedded ? 'h-full flex flex-col' : 'h-full flex flex-col bg-[var(--bg-primary)]';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)] shrink-0">
        <GitBranch className="w-4 h-4 text-[var(--text-tertiary)]" />
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
        >
          <option value="--all">All branches</option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch} {branch === currentBranch ? '(current)' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={fetchGraph}
          className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
            {error}
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 mb-4 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
              <Code2 className="w-8 h-8 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-[var(--text-secondary)]">{t('git.graph.empty')}</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            style={{ minWidth: '100%' }}
            className="font-sans"
          />
        )}
      </div>

      {/* Commit Detail Modal */}
      <AnimatePresence>
        {selectedCommit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setSelectedCommit(null);
                setCommitDiff(null);
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-full max-w-lg bg-[var(--bg-primary)] border-l border-[var(--border-default)] flex flex-col"
            >
              <header className="flex items-center gap-3 h-14 px-4 border-b border-[var(--border-default)] shrink-0">
                <button
                  onClick={() => {
                    setSelectedCommit(null);
                    setCommitDiff(null);
                  }}
                  className="p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {selectedCommit.message}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {selectedCommit.shortHash} • {selectedCommit.author} • {selectedCommit.relativeDate}
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-auto p-4">
                {commitDiff === null ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <DiffViewer diff={commitDiff} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
