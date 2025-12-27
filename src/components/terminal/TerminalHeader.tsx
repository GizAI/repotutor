'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TerminalSessionSummary } from '@/hooks/useTerminalSession';
import { Terminal } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface TerminalHeaderProps {
  sessions: TerminalSessionSummary[];
  currentSessionId: string | null;
  connected: boolean;
  onOpenSessionList: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onTerminateSession: (sessionId: string) => void;
  className?: string;
}

export function TerminalHeader({
  sessions,
  currentSessionId,
  connected,
  onOpenSessionList,
  onNewSession,
  onSelectSession,
  onTerminateSession,
  className = '',
}: TerminalHeaderProps) {
  const { t } = useT();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const handleTerminateClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentSessionId) {
        onTerminateSession(currentSessionId);
      }
    },
    [currentSessionId, onTerminateSession]
  );

  return (
    <div
      className={`flex items-center h-10 px-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] ${className}`}
    >
      {/* Session List Button */}
      <button
        onClick={onOpenSessionList}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
        title={t('terminal.sessions')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Current Session Dropdown */}
      <div ref={dropdownRef} className="relative flex-1 mx-2">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors w-full text-left"
        >
          {/* Status indicator */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              connected
                ? currentSession?.isActive
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
                : 'bg-red-500'
            }`}
          />

          {/* Session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                {currentSession?.title || t('terminal.noSession')}
              </span>
            </div>
            {currentSession && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono truncate block">
                {currentSession.cwd}
              </span>
            )}
          </div>

          {/* Dropdown arrow */}
          <svg
            className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute left-0 right-0 top-full mt-1 z-50 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg max-h-64 overflow-y-auto"
            >
              {sessions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[var(--text-tertiary)] text-center">
                  {t('terminal.noSessions')}
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-[var(--hover-bg)] transition-colors ${
                      session.id === currentSessionId ? 'bg-[var(--accent-soft)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          session.isActive ? 'bg-emerald-500' : 'bg-[var(--text-tertiary)]'
                        }`}
                      />
                      <span
                        className={`text-sm truncate ${
                          session.id === currentSessionId
                            ? 'text-[var(--accent)] font-medium'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {session.title}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-auto font-mono">
                        {session.cols}x{session.rows}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] font-mono truncate mt-0.5 pl-4">
                      {session.cwd}
                    </div>
                  </button>
                ))
              )}

              {/* Divider */}
              <div className="border-t border-[var(--border-default)] my-1" />

              {/* New Session */}
              <button
                onClick={() => {
                  onNewSession();
                  setShowDropdown(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-[var(--accent)] hover:bg-[var(--hover-bg)] transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('terminal.newSession')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Badge */}
      <div
        className={`px-2 py-0.5 rounded text-[10px] mr-2 ${
          connected
            ? currentSession?.isActive
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-amber-500/10 text-amber-500'
            : 'bg-red-500/10 text-red-500'
        }`}
      >
        {connected
          ? currentSession?.isActive
            ? t('terminal.sessionActive')
            : t('terminal.sessionIdle')
          : t('terminal.disconnected')}
      </div>

      {/* New Session Button */}
      <button
        onClick={onNewSession}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] transition-colors"
        title={t('terminal.newSession')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Terminate Current Session Button */}
      {currentSessionId && (
        <button
          onClick={handleTerminateClick}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title={t('terminal.terminateSession')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
