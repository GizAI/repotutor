'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FileViewer, FileTree, BreadcrumbNav } from '@/components/browser';
import { Card } from '@/components/ui/card';
import { Folder, FileText, Menu, Search, X, Moon, Sun, Monitor, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useThemeContext } from '@/components/layout/ThemeProvider';
import { RepoSelector } from '@/components/layout/RepoSelector';
import type { FileTree as FileTreeType } from '@/lib/files/reader';
import type { ThemeMode } from '@/lib/themes';

const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

interface MobileBrowseViewProps {
  path: string;
  onNavigate: (path: string) => void;
  onSearch: () => void;
}

export function MobileBrowseView({ path, onNavigate, onSearch }: MobileBrowseViewProps) {
  const { t } = useT();
  const { themeMode, cycleTheme, mounted } = useThemeContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entries, setEntries] = useState<FileTreeType[] | null>(null);
  const [repoName, setRepoName] = useState('');
  const [pathInfo, setPathInfo] = useState<{ type: 'file' | 'directory' } | null>(null);
  const [siblings, setSiblings] = useState<{ path: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Load file tree
  useEffect(() => {
    fetch('/api/files/?tree=true&depth=0', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setEntries(data.entries || []))
      .catch(() => setEntries([]));
  }, []);

  // Load repo name
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setRepoName(data.currentProject?.name || ''))
      .catch(() => {});
  }, []);

  // Determine path type and load siblings
  useEffect(() => {
    if (!path) {
      setPathInfo({ type: 'directory' });
      setSiblings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const hasExtension = path.includes('.') && path.split('.').pop()!.length <= 5;

    if (hasExtension) {
      setPathInfo({ type: 'file' });
      setLoading(false);
    } else {
      fetch(`/api/files/?path=${encodeURIComponent(path)}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => setPathInfo({ type: data?.pathInfo?.type || 'file' }))
        .catch(() => setPathInfo({ type: 'file' }))
        .finally(() => setLoading(false));
    }

    // Load siblings for markdown files
    const ext = path.split('.').pop()?.toLowerCase();
    if (ext && ['md', 'mdx', 'markdown'].includes(ext)) {
      fetch(`/api/files/siblings/?path=${encodeURIComponent(path)}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : { siblings: [] })
        .then(data => setSiblings(data.siblings || []))
        .catch(() => setSiblings([]));
    } else {
      setSiblings([]);
    }
  }, [path]);

  const handleFileTreeNavigate = useCallback((filePath: string) => {
    onNavigate(filePath);
    setSidebarOpen(false);
  }, [onNavigate]);

  const isFile = pathInfo?.type === 'file';
  const isDirectory = !pathInfo || pathInfo.type === 'directory';

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="shrink-0 h-12 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
        <div className="flex h-full items-center gap-2 px-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <RepoSelector />
          <button
            onClick={onSearch}
            className="flex items-center gap-2 px-2.5 py-1.5 flex-1 max-w-[160px] text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search</span>
          </button>
          <button
            onClick={cycleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)]"
          >
            {mounted && (() => { const ThemeIcon = THEME_ICONS[themeMode]; return <ThemeIcon className="h-4 w-4" />; })()}
          </button>
        </div>
      </header>

      {/* File Tree Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 h-full bg-[var(--bg-primary)] border-r border-[var(--border-default)] overflow-y-auto">
            <div className="p-3 border-b border-[var(--border-default)] flex items-center justify-between">
              <span className="font-medium text-sm text-[var(--text-primary)]">{repoName || 'Files'}</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded text-[var(--text-secondary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              {entries && entries.length > 0 ? (
                <FileTree entries={entries} onNavigate={handleFileTreeNavigate} />
              ) : (
                <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                  {entries === null ? t('common.loading') : t('file.empty')}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mb-3 overflow-x-auto">
          <BreadcrumbNav path={path} repoName={repoName} onNavigate={onNavigate} />
        </div>

        {loading ? (
          <Card className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-[var(--text-secondary)]">Loading...</div>
            </div>
          </Card>
        ) : isFile && path ? (
          <FileViewer path={path} siblings={siblings} />
        ) : isDirectory ? (
          <DirectoryView entries={entries} currentPath={path} repoName={repoName} onNavigate={onNavigate} />
        ) : (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] mb-4">
                <Folder className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-body-lg font-medium text-[var(--text-primary)]">Path not found</div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

// Directory view component
interface DirectoryViewProps {
  entries: FileTreeType[] | null;
  currentPath: string;
  repoName: string;
  onNavigate: (path: string) => void;
}

function findEntriesForPath(entries: FileTreeType[], targetPath: string): FileTreeType[] {
  if (!targetPath) return entries;
  const pathParts = targetPath.split('/');
  let current = entries;
  for (const part of pathParts) {
    const found = current.find(e => e.name === part && e.type === 'directory');
    if (found?.children) {
      current = found.children;
    } else {
      return [];
    }
  }
  return current;
}

function DirectoryView({ entries, currentPath, repoName, onNavigate }: DirectoryViewProps) {
  const directChildren = entries ? findEntriesForPath(entries, currentPath) : [];

  if (directChildren.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] mb-4">
            <Folder className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-body-lg font-medium text-[var(--text-primary)]">Empty directory</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-body-lg font-medium text-[var(--text-primary)] truncate">
            {currentPath || repoName}
          </h2>
          <span className="text-caption text-[var(--text-secondary)] shrink-0">
            {countItems(directChildren)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {directChildren.map((entry) => (
            <button
              key={entry.path}
              onClick={() => onNavigate(entry.path)}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] transition-all text-left"
            >
              {entry.type === 'directory' ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
                  <Folder className="h-4 w-4 text-primary" />
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)]">
                  <FileText className="h-4 w-4 text-[var(--text-tertiary)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {entry.name}
                </div>
                {entry.type === 'file' && entry.size !== undefined && (
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {formatSize(entry.size)}
                  </div>
                )}
                {entry.type === 'directory' && entry.children && (
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {entry.children.length} items
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function countItems(entries: FileTreeType[]): string {
  const dirs = entries.filter((e) => e.type === 'directory').length;
  const files = entries.filter((e) => e.type === 'file').length;
  const parts = [];
  if (dirs > 0) parts.push(`${dirs} folder${dirs > 1 ? 's' : ''}`);
  if (files > 0) parts.push(`${files} file${files > 1 ? 's' : ''}`);
  return parts.join(', ') || 'Empty';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
