'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  onDelete?: (sessionId: string) => void;
  onRename?: (sessionId: string, newTitle: string) => void;
}

// Export session as JSON
async function exportSessionAsJson(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error('Failed to fetch session');

    const data = await response.json();
    const blob = new Blob([JSON.stringify(data.session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export session');
  }
}

// Export session as Markdown
async function exportSessionAsMarkdown(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error('Failed to fetch session');

    const data = await response.json();
    const session = data.session;

    let markdown = `# Chat Session\n\n`;
    markdown += `**ID:** ${session.id}\n`;
    markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    markdown += `**Updated:** ${new Date(session.updatedAt).toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
      markdown += `## ${role}\n\n`;
      markdown += `${msg.content}\n\n`;
      if (msg.model) {
        markdown += `*Model: ${msg.model}*\n\n`;
      }
      markdown += `---\n\n`;
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${sessionId.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export session');
  }
}

// Import session from file
async function importSession(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const sessionData = JSON.parse(text);

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ import: true, data: sessionData }),
    });

    return response.ok;
  } catch (error) {
    console.error('Import failed:', error);
    return false;
  }
}

// Get favorites from localStorage
function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem('session-favorites');
    return new Set(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set();
  }
}

// Save favorites to localStorage
function saveFavorites(favorites: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('session-favorites', JSON.stringify([...favorites]));
}

// Available tag colors
const TAG_COLORS = [
  { name: 'red', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
  { name: 'orange', bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' },
  { name: 'amber', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
  { name: 'green', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  { name: 'blue', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  { name: 'purple', bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' },
];

interface SessionTag {
  name: string;
  color: string;
}

// Get tags from localStorage
function getSessionTags(): Record<string, SessionTag[]> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem('session-tags');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save tags to localStorage
function saveSessionTags(tags: Record<string, SessionTag[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('session-tags', JSON.stringify(tags));
}

export function SessionList({
  isOpen,
  sessions,
  currentSessionId,
  onSelect,
  onNew,
  onClose,
  onDelete,
  onRename,
}: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sessionTags, setSessionTags] = useState<Record<string, SessionTag[]>>(() => getSessionTags());
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all unique tags for filtering
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    Object.values(sessionTags).forEach(tagList => {
      tagList.forEach(tag => tags.add(tag.name));
    });
    return Array.from(tags);
  }, [sessionTags]);

  // Add/remove tag from session
  const toggleTag = useCallback((sessionId: string, tag: SessionTag) => {
    setSessionTags(prev => {
      const next = { ...prev };
      const currentTags = next[sessionId] || [];
      const existingIndex = currentTags.findIndex(t => t.name === tag.name);

      if (existingIndex >= 0) {
        next[sessionId] = currentTags.filter((_, i) => i !== existingIndex);
      } else {
        next[sessionId] = [...currentTags, tag];
      }

      saveSessionTags(next);
      return next;
    });
  }, []);

  // Filter sessions based on search, favorites, and tags
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by favorites if enabled
    if (showFavoritesOnly) {
      filtered = filtered.filter(s => favorites.has(s.id));
    }

    // Filter by tag
    if (tagFilter) {
      filtered = filtered.filter(s => {
        const tags = sessionTags[s.id] || [];
        return tags.some(t => t.name === tagFilter);
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.preview?.toLowerCase().includes(query) ||
        s.id.includes(query) ||
        (sessionTags[s.id] || []).some(t => t.name.toLowerCase().includes(query))
      );
    }

    // Sort: favorites first, then by date
    return [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [sessions, searchQuery, favorites, showFavoritesOnly, tagFilter, sessionTags]);

  // Toggle favorite
  const toggleFavorite = useCallback((sessionId: string) => {
    setFavorites(prev => {
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

  // Handle file import
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const success = await importSession(file);
    if (success) {
      alert('Session imported successfully');
      window.location.reload(); // Refresh to show new session
    } else {
      alert('Failed to import session');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

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
        <div className="flex items-center gap-2">
          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            title="Import session"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="p-4 space-y-3 border-b border-[var(--border-default)]">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNew}
            className="btn btn-primary flex-1 py-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              showFavoritesOnly
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            ★ Favorites
          </button>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {allTags.map(tag => {
              const color = TAG_COLORS.find(c => c.name === tag) || TAG_COLORS[4];
              const isActive = tagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(isActive ? null : tag)}
                  className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                    isActive
                      ? `${color.bg} ${color.text} ${color.border}`
                      : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                Clear
              </button>
            )}
          </div>
        )}
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
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-caption text-[var(--text-secondary)]">No matching sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                isFavorite={favorites.has(session.id)}
                tags={sessionTags[session.id] || []}
                onSelect={() => onSelect(session)}
                onFavorite={() => toggleFavorite(session.id)}
                onToggleTag={(tag) => toggleTag(session.id, tag)}
                onDelete={onDelete ? () => onDelete(session.id) : undefined}
                onRename={onRename}
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
  isFavorite,
  tags,
  onSelect,
  onFavorite,
  onToggleTag,
  onDelete,
  onRename,
}: {
  session: SessionSummary;
  isActive: boolean;
  isFavorite: boolean;
  tags: SessionTag[];
  onSelect: () => void;
  onFavorite: () => void;
  onToggleTag: (tag: SessionTag) => void;
  onDelete?: () => void;
  onRename?: (sessionId: string, newTitle: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Shorten model name for display
  const shortModel = session.model
    ? session.model.replace('claude-', '').replace('-20251101', '')
    : 'claude';

  const handleExportJson = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExporting(true);
    await exportSessionAsJson(session.id);
    setIsExporting(false);
    setShowMenu(false);
  }, [session.id]);

  const handleExportMarkdown = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExporting(true);
    await exportSessionAsMarkdown(session.id);
    setIsExporting(false);
    setShowMenu(false);
  }, [session.id]);

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
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
      {/* Mode Badge */}
      <div className="flex items-center gap-2 mb-2">
        <Icon name="spark" className={`h-4 w-4 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} />
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {shortModel}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
        </span>

        {/* Action Menu Button */}
        <button
          onClick={handleMenuToggle}
          className="opacity-0 group-hover:opacity-100 p-1 -m-1 rounded hover:bg-[var(--hover-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
          title="More actions"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
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

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/30" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs text-red-500 mb-2">Delete this session?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete?.(); setConfirmDelete(false); }}
              className="flex-1 px-2 py-1 rounded bg-red-500 text-white text-xs"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs"
            >
              Cancel
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
            className="absolute right-2 top-10 z-10 w-40 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onFavorite(); setShowMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
            >
              <span className={isFavorite ? 'text-amber-500' : ''}>★</span>
              {isFavorite ? 'Remove Favorite' : 'Add Favorite'}
            </button>
            {onRename && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowTagPicker(!showTagPicker); }}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Add Tag
            </button>
            {showTagPicker && (
              <div className="px-2 py-1.5 border-t border-[var(--border-default)]">
                <div className="flex flex-wrap gap-1">
                  {TAG_COLORS.map(color => {
                    const hasTag = tags.some(t => t.color === color.name);
                    return (
                      <button
                        key={color.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTag({ name: color.name, color: color.name });
                        }}
                        className={`w-5 h-5 rounded-full border-2 ${color.bg} ${
                          hasTag ? 'border-[var(--accent)]' : 'border-transparent'
                        }`}
                        title={`${hasTag ? 'Remove' : 'Add'} ${color.name} tag`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            <button
              onClick={handleExportJson}
              disabled={isExporting}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export JSON
            </button>
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Markdown
            </button>
            {onDelete && (
              <>
                <div className="border-t border-[var(--border-default)] my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); setShowMenu(false); }}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.map((tag, idx) => {
            const color = TAG_COLORS.find(c => c.name === tag.color) || TAG_COLORS[4];
            return (
              <span
                key={idx}
                className={`px-1.5 py-0.5 text-[9px] rounded ${color.bg} ${color.text}`}
              >
                {tag.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Title */}
      <h3 className={`text-sm font-medium line-clamp-1 mb-1 flex items-center gap-1 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
        {isFavorite && <span className="text-amber-500">★</span>}
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
