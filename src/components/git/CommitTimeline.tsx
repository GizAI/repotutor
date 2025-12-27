'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, RefreshCw, ChevronLeft, GitMerge, Code } from 'lucide-react';
import { DiffViewer } from '@/components/ui/DiffViewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingSpinner } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n';

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
}

interface CommitTimelineProps {
  embedded?: boolean;
  onCommitSelect?: (hash: string) => void;
}

export function CommitTimeline({ embedded = false, onCommitSelect }: CommitTimelineProps) {
  const { t } = useT();
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('--all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null);
  const [commitDiff, setCommitDiff] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/git/graph?branch=${encodeURIComponent(selectedBranch)}&limit=50`);
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
      setError(t('git.graph.loading'));
    } finally {
      setIsLoading(false);
    }
  }, [t, selectedBranch]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

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

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (email: string) => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-amber-500'];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={embedded ? 'h-full flex flex-col' : 'h-full flex flex-col bg-background'}>
      {/* Branch selector */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="flex-1 bg-transparent text-sm focus:outline-none"
        >
          <option value="--all">All branches</option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch} {branch === currentBranch ? '(current)' : ''}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="icon-sm" onClick={fetchGraph}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">{error}</div>
        ) : commits.length === 0 ? (
          <EmptyState
            icon={<Code className="w-8 h-8 text-muted-foreground" />}
            title={t('git.graph.empty')}
          />
        ) : (
          <div className="relative px-4 py-2">
            {/* Timeline line */}
            <div className="absolute left-[2.25rem] top-0 bottom-0 w-0.5 bg-border" />

            {/* Commits */}
            {commits.map((commit, index) => (
              <motion.div
                key={commit.hash}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="relative flex gap-3 py-3"
              >
                {/* Timeline dot */}
                <div className="relative z-10 shrink-0">
                  {commit.isHead ? (
                    <div className="w-5 h-5 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : commit.branches.length > 0 || commit.tags.length > 0 ? (
                    <div className="w-5 h-5 rounded-full bg-primary/20 border-2 border-primary" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted border-2 border-border" />
                  )}
                </div>

                {/* Commit card */}
                <button
                  onClick={() => handleCommitClick(commit)}
                  className="flex-1 text-left p-3 rounded-xl bg-muted border hover:border-primary transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(commit.email)} flex items-center justify-center text-white text-xs font-medium shrink-0`}>
                      {getInitials(commit.author)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{commit.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono text-primary">{commit.shortHash}</span>
                        <span>•</span>
                        <span>{commit.author}</span>
                        <span>•</span>
                        <span>{commit.relativeDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Branches & Tags */}
                  {(commit.branches.length > 0 || commit.tags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {commit.branches.map((branch) => (
                        <Badge key={branch} variant={branch === currentBranch ? 'default' : 'secondary'}>
                          {branch}
                        </Badge>
                      ))}
                      {commit.tags.map((tag) => (
                        <Badge key={tag} className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Merge indicator */}
                  {commit.parents.length > 1 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-purple-500">
                      <GitMerge className="h-3 w-3" />
                      <span>Merge commit</span>
                    </div>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Commit Detail Modal - Full screen on mobile */}
      <Dialog open={!!selectedCommit} onOpenChange={() => { setSelectedCommit(null); setCommitDiff(null); }}>
        <DialogContent className="w-full h-full max-w-full max-h-full sm:max-w-4xl sm:max-h-[85vh] sm:h-auto rounded-none sm:rounded-lg flex flex-col p-0 gap-0">
          {selectedCommit && (
            <>
              <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
                <DialogTitle className="text-sm font-medium line-clamp-2 sm:line-clamp-1">
                  {selectedCommit.message}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedCommit.shortHash} • {selectedCommit.author} • {selectedCommit.relativeDate}
                </p>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-2 sm:p-4 min-h-0">
                {commitDiff === null ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <DiffViewer diff={commitDiff} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
