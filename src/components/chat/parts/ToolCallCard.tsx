'use client';

import { useState, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolCall } from '../types';
import {
  Check, X, ChevronDown, Loader2, Eye, FilePlus, FileDiff, FileEdit,
  Terminal, Search, FileSearch, FolderOpen, Globe, Rocket, ListTodo,
  FileText, BookOpen, Code, MessageSquare, Map, Zap, XCircle, Wrench, Puzzle
} from 'lucide-react';
import { getToolConfig, getToolTitle, isToolMinimal } from './knownTools';
import { EditView } from './EditView';
import { BashView } from './BashView';

// Icon mapping
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye, FilePlus, FileDiff, FileEdit, Terminal, Search, FileSearch,
  FolderOpen, Globe, Rocket, ListTodo, FileText, BookOpen, Code,
  MessageSquare, Map, Zap, XCircle, Wrench, Puzzle
};

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICONS[iconName] || Wrench;
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str.length > 2000 ? str.slice(0, 2000) + '\n... (truncated)' : str;
  }
}

// Get custom view component for tool
function getToolView(tool: ToolCall): ReactNode | null {
  switch (tool.name) {
    case 'Edit':
    case 'MultiEdit':
      return <EditView tool={tool} />;
    case 'Bash':
      return <BashView tool={tool} showOutput={tool.status === 'completed' || tool.status === 'error'} />;
    default:
      return null;
  }
}

export function ToolCallCard({ tool }: { tool: ToolCall }) {
  const config = getToolConfig(tool.name);
  const title = getToolTitle(tool);
  const minimal = isToolMinimal(tool);

  const [expanded, setExpanded] = useState(!minimal);
  const [tab, setTab] = useState<'input' | 'output'>('input');

  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';
  const hasOutput = !!tool.output;

  // Get subtitle/preview
  const subtitle = useMemo(() => {
    if (config.extractSubtitle) {
      return config.extractSubtitle(tool);
    }
    if (config.extractPreview) {
      return config.extractPreview(tool);
    }
    return null;
  }, [tool, config]);

  // Get icon component
  const Icon = getIcon(config.icon);

  // Check if tool has custom view
  const customView = getToolView(tool);
  const hasCustomView = customView !== null && !minimal;

  return (
    <div className={`rounded-lg border overflow-hidden relative ${
      isError ? 'border-red-500/30 bg-red-500/5' :
      isRunning ? 'border-[var(--accent)]/50 bg-[var(--accent-soft)]' :
      'border-[var(--border-default)] bg-[var(--bg-primary)]'
    }`}>
      {/* Running indicator bar */}
      {isRunning && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent)]/20 overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-[var(--accent)]"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--hover-bg)] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status icon */}
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin shrink-0" />
          ) : isError ? (
            <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
          ) : (
            <Icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}

          {/* Tool name/title */}
          <span className={`font-mono text-xs font-medium truncate ${
            isError ? 'text-red-500' : 'text-[var(--text-primary)]'
          }`}>
            {title}
          </span>

          {/* Subtitle */}
          {subtitle && (
            <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-48 font-mono">
              {subtitle}
            </span>
          )}

          {/* Elapsed time */}
          {tool.elapsed !== undefined && (
            <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{tool.elapsed.toFixed(1)}s</span>
          )}

          {/* Error badge */}
          {tool.error && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 truncate max-w-32 shrink-0">
              {tool.error}
            </span>
          )}

          {/* Mutable badge */}
          {config.isMutable && !isRunning && !isError && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">
              modified
            </span>
          )}
        </div>

        {/* Expand indicator */}
        {(tool.input || tool.output || hasCustomView) && (
          <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform shrink-0 ${
            expanded ? 'rotate-180' : ''
          }`} />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (tool.input || tool.output || hasCustomView) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Custom view for specific tools */}
            {hasCustomView ? (
              <div className="p-3 border-t border-[var(--border-default)]">
                {customView}
              </div>
            ) : (
              <>
                {/* Tab bar for input/output */}
                {hasOutput && (
                  <div className="flex border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
                    <button
                      onClick={(e) => { e.stopPropagation(); setTab('input'); }}
                      className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
                        tab === 'input'
                          ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      Input
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTab('output'); }}
                      className={`px-3 py-1.5 text-[10px] font-medium transition-colors ${
                        tab === 'output'
                          ? 'text-emerald-500 border-b-2 border-emerald-500'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      Output
                    </button>
                  </div>
                )}

                {/* JSON content */}
                <pre className={`p-3 text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin ${
                  isError && tab === 'output'
                    ? 'bg-red-500/5 text-red-500'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                }`}>
                  {formatJson(tab === 'input' || !hasOutput ? tool.input || '' : tool.output || '')}
                </pre>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
