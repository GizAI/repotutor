'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolCall } from '../types';
import { Check, X, ChevronDown, Loader2 } from 'lucide-react';

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str.length > 2000 ? str.slice(0, 2000) + '\n... (truncated)' : str;
  }
}

// Extract key parameter based on tool type
function getToolPreview(toolName: string, input?: string): string | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    switch (toolName) {
      case 'Read':
        return parsed.file_path?.split('/').pop() || parsed.file_path;
      case 'Write':
      case 'Edit':
        return parsed.file_path?.split('/').pop() || parsed.file_path;
      case 'Glob':
        return parsed.pattern;
      case 'Grep':
        return parsed.pattern;
      case 'Bash':
        return parsed.command?.slice(0, 60) + (parsed.command?.length > 60 ? '...' : '');
      case 'WebFetch':
      case 'WebSearch':
        return parsed.url || parsed.query;
      case 'Task':
        return parsed.description || parsed.subagent_type;
      default:
        return null;
    }
  } catch {
    // If not valid JSON, try to extract directly for streaming input
    return null;
  }
}

function parseTaskInput(input?: string): { subagent?: string; description?: string } | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed.subagent_type || parsed.description) {
      return { subagent: parsed.subagent_type, description: parsed.description };
    }
  } catch { /* ignore */ }
  return null;
}

export function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'input' | 'output'>('input');

  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';
  const hasOutput = !!tool.output;
  const taskInfo = tool.name === 'Task' ? parseTaskInput(tool.input) : null;
  const preview = !taskInfo ? getToolPreview(tool.name, tool.input) : null;

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
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
          ) : isError ? (
            <X className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          )}
          <span className={`font-mono text-xs font-medium ${isError ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
            {tool.name}
          </span>

          {taskInfo && (
            <>
              {taskInfo.subagent && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">{taskInfo.subagent}</span>
              )}
              {taskInfo.description && (
                <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-48">{taskInfo.description}</span>
              )}
            </>
          )}
          {preview && !taskInfo && (
            <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-64 font-mono">{preview}</span>
          )}
          {tool.elapsed !== undefined && (
            <span className="text-[10px] text-[var(--text-tertiary)]">{tool.elapsed.toFixed(1)}s</span>
          )}
          {tool.error && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 truncate max-w-32">{tool.error}</span>
          )}
        </div>
        {(tool.input || tool.output) && (
          <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      <AnimatePresence>
        {expanded && (tool.input || tool.output) && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            {hasOutput && (
              <div className="flex border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <button onClick={() => setTab('input')}
                  className={`px-3 py-1.5 text-[10px] font-medium ${tab === 'input' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                  Input
                </button>
                <button onClick={() => setTab('output')}
                  className={`px-3 py-1.5 text-[10px] font-medium ${tab === 'output' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-[var(--text-tertiary)]'}`}>
                  Output
                </button>
              </div>
            )}
            <pre className={`p-3 text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin ${
              isError && tab === 'output' ? 'bg-red-500/5 text-red-500' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
            }`}>
              {formatJson(tab === 'input' || !hasOutput ? tool.input || '' : tool.output || '')}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
