'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { TerminalSessionSummary } from '@/hooks/useTerminalSession';
import { X, Search, Terminal } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface TerminalSessionListProps {
  isOpen: boolean;
  sessions: TerminalSessionSummary[];
  currentSessionId?: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onClose: () => void;
  onTerminate?: (sessionId: string) => void;
  onRename?: (sessionId: string, newTitle: string) => void;
}

// Get favorites from localStorage
function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem('terminal-session-favorites');
    return new Set(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set();
  }
}

// Save favorites to localStorage
function saveFavorites(favorites: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('terminal-session-favorites', JSON.stringify([...favorites]));
}

export function TerminalSessionList({
  isOpen,
  sessions,
  currentSessionId,
  onSelect,
  onNew,
  onClose,
  onTerminate,
  onRename,
}: TerminalSessionListProps) {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // SSR-safe: Load from localStorage after mount
  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  // Filter sessions based on search and favorites
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by favorites if enabled
    if (showFavoritesOnly) {
      filtered = filtered.filter((s) => favorites.has(s.id));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.cwd.toLowerCase().includes(query) ||
          s.preview?.toLowerCase().includes(query) ||
          s.id.includes(query)
      );
    }

    // Sort: favorites first, then active, then by last activity
    return [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      // Active sessions first
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;

      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
  }, [sessions, searchQuery, favorites, showFavoritesOnly]);

  // Toggle favorite
  const toggleFavorite = useCallback((sessionId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sidebar */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.15 }}
        className="relative w-72 h-full bg-[var(--bg-primary)] border-r border-[var(--border-default)] flex flex-col"
      >
        {/* Header */}
        <header className="flex items-center justify-between h-12 px-3 border-b border-[var(--border-default)]">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            {t('terminal.sessions')}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Search and Actions */}
        <div className="p-3 space-y-2 border-b border-[var(--border-default)]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('terminal.searchSessions')}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onNew} className="btn btn-primary flex-1 py-1.5 text-sm">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('terminal.newSession')}
            </button>
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${
                showFavoritesOnly
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              ★
            </button>
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-secondary)] mb-3">
                <Terminal className="w-6 h-6 text-[var(--text-tertiary)]" />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{t('terminal.noSessions')}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                {t('terminal.createFirstSession')}
              </p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                {t('terminal.noMatchingSessions')}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredSessions.map((session) => (
                <TerminalSessionCard
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  isFavorite={favorites.has(session.id)}
                  onSelect={() => onSelect(session.id)}
                  onFavorite={() => toggleFavorite(session.id)}
                  onTerminate={onTerminate ? () => onTerminate(session.id) : undefined}
                  onRename={onRename}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[var(--border-default)] text-center">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {sessions.length} {t('terminal.activeSessions')} | {t('terminal.maxSessions')}
          </p>
        </div>
      </motion.aside>
    </div>
  );
}

function TerminalSessionCard({
  session,
  isActive,
  isFavorite,
  onSelect,
  onFavorite,
  onTerminate,
  onRename,
}: {
  session: TerminalSessionSummary;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onTerminate?: () => void;
  onRename?: (sessionId: string, newTitle: string) => void;
}) {
  const { t } = useT();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMenu(!showMenu);
    },
    [showMenu]
  );

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = () => setShowMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showMenu]);

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
      {/* Header Row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Status indicator */}
        <span
          className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-emerald-500' : 'bg-[var(--text-tertiary)]'}`}
          title={session.isActive ? t('terminal.sessionActive') : t('terminal.sessionIdle')}
        />
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-mono">
          {session.cols}x{session.rows}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
          {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
        </span>

        {/* Action Menu Button */}
        <button
          onClick={handleMenuToggle}
          className="opacity-0 group-hover:opacity-100 p-1 -m-1 rounded hover:bg-[var(--hover-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
          title="More actions"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>

      {/* Rename Input */}
      {isRenaming && (
        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onRename) {
                onRename(session.id, newTitle);
                setIsRenaming(false);
              } else if (e.key === 'Escape') {
                setIsRenaming(false);
                setNewTitle(session.title);
              }
            }}
            className="w-full px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--accent)] text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Terminate Confirmation */}
      {confirmTerminate && (
        <div
          className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-red-500 mb-2">{t('terminal.confirmTerminate')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onTerminate?.();
                setConfirmTerminate(false);
              }}
              className="flex-1 px-2 py-1 rounded bg-red-500 text-white text-xs"
            >
              {t('terminal.terminate')}
            </button>
            <button
              onClick={() => setConfirmTerminate(false)}
              className="flex-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Action Menu Dropdown */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-2 top-10 z-10 w-36 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavorite();
                setShowMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
            >
              <span className={isFavorite ? 'text-amber-500' : ''}>★</span>
              {isFavorite ? t('terminal.removeFavorite') : t('terminal.addFavorite')}
            </button>
            {onRename && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                {t('terminal.rename')}
              </button>
            )}
            {onTerminate && (
              <>
                <div className="border-t border-[var(--border-default)] my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmTerminate(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {t('terminal.terminate')}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title */}
      <h3
        className={`text-sm font-medium line-clamp-1 mb-1 flex items-center gap-1 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
      >
        {isFavorite && <span className="text-amber-500">★</span>}
        <Terminal className="w-3.5 h-3.5 mr-1" />
        {session.title}
      </h3>

      {/* CWD */}
      <p className="text-xs text-[var(--text-tertiary)] font-mono line-clamp-1 mb-1">
        {session.cwd}
      </p>

      {/* Preview (last output line) */}
      {session.preview && (
        <p className="text-[11px] text-[var(--text-tertiary)] line-clamp-1 font-mono bg-[var(--bg-tertiary)] rounded px-1.5 py-0.5">
          {session.preview}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-tertiary)]">
        <span className="font-mono">{session.id}</span>
      </div>
    </motion.div>
  );
}
