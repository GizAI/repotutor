'use client';

import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { SessionSummary } from '@/hooks/useSessionManager';
import { Icon } from '@/components/ui/Icon';

interface SessionListProps {
  isOpen: boolean;
  sessions: SessionSummary[];
  currentSessionId?: string;
  onSelect: (session: SessionSummary) => void;
  onNew: () => void;
  onClose: () => void;
}

export function SessionList({
  isOpen,
  sessions,
  currentSessionId,
  onSelect,
  onNew,
  onClose,
}: SessionListProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-30 bg-[var(--bg-primary)] flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-default)]">
        <h2 className="text-body-lg font-medium text-[var(--text-primary)]">Sessions</h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </header>

      {/* New Chat Button */}
      <div className="p-4 border-b border-[var(--border-default)]">
        <button
          onClick={onNew}
          className="btn btn-primary w-full py-2.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Conversation
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--bg-secondary)] mb-4">
              <svg className="w-7 h-7 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-caption text-[var(--text-secondary)]">No sessions yet</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Start a new conversation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onSelect={() => onSelect(session)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-[var(--border-default)] text-center">
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Sessions stored in ~/.claude/projects/
        </p>
      </div>
    </motion.div>
  );
}

function SessionCard({
  session,
  isActive,
  onSelect,
}: {
  session: SessionSummary;
  isActive: boolean;
  onSelect: () => void;
}) {
  // Shorten model name for display
  const shortModel = session.model
    ? session.model.replace('claude-', '').replace('-20251101', '')
    : 'claude';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative p-3 rounded-lg transition-all cursor-pointer border ${
        isActive
          ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
          : 'bg-[var(--bg-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
      }`}
      onClick={onSelect}
    >
      {/* Mode Badge */}
      <div className="flex items-center gap-2 mb-2">
        <Icon name="spark" className={`h-4 w-4 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} />
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {shortModel}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
        </span>
      </div>

      {/* Title */}
      <h3 className={`text-sm font-medium line-clamp-1 mb-1 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
        {session.title}
      </h3>

      {/* Preview */}
      <p className="text-xs text-[var(--text-tertiary)] line-clamp-2">
        {session.preview || 'No preview'}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-tertiary)]">
        <span>{session.messageCount} messages</span>
        <span className="font-mono">{session.id.slice(0, 8)}...</span>
      </div>
    </motion.div>
  );
}
