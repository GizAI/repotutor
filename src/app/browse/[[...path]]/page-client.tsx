'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTree, FileViewer, BreadcrumbNav } from '@/components/browser';
import { Card } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useGlobal } from '@/components/layout';
import type { FileEntry, FileTree as FileTreeType, DocSibling } from '@/lib/files/reader';

interface BrowsePageClientProps {
  repoName: string;
  currentPath: string;
  pathInfo: FileEntry | null;
  entries: FileTreeType[] | null;
  siblings?: DocSibling[];
}

export function BrowsePageClient({
  repoName,
  currentPath,
  pathInfo,
  entries,
  siblings = [],
}: BrowsePageClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isFile = pathInfo?.type === 'file';
  const isDirectory = !pathInfo || pathInfo.type === 'directory';

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden flex items-center justify-center h-9 w-9 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Open menu"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - File Tree */}
      <aside
        className={`
          w-72 lg:w-64 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-primary)] overflow-y-auto
          fixed top-0 left-0 h-screen z-50
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="arrow" className="h-4 w-4 rotate-180" />
            <span className="font-medium text-sm">{repoName}</span>
          </Link>
          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* Search Button */}
        <SearchButton />

        <div className="p-2">
          {entries && entries.length > 0 ? (
            <FileTree entries={entries} onNavigate={() => setSidebarOpen(false)} />
          ) : (
            <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
              No files found
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 pt-16 lg:pt-6 lg:p-6 min-w-0 max-w-full overflow-x-hidden">
        {/* Breadcrumb */}
        <div className="mb-4 lg:mb-6 overflow-x-auto max-w-full">
          <BreadcrumbNav path={currentPath} repoName={repoName} />
        </div>

        {/* Content */}
        {isFile && currentPath ? (
          <FileViewer path={currentPath} siblings={siblings} />
        ) : isDirectory ? (
          <DirectoryView entries={entries} currentPath={currentPath} repoName={repoName} />
        ) : (
          <Card padding="lg">
            <div className="flex flex-col items-center justify-center py-12 lg:py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] mb-4">
                <Icon name="folder" className="h-6 w-6 text-[var(--text-tertiary)]" />
              </div>
              <div className="text-body-lg font-medium text-[var(--text-primary)]">Path not found</div>
              <div className="text-caption text-[var(--text-secondary)] mt-2">
                The requested path does not exist.
              </div>
              <Link
                href="/browse"
                className="mt-4 text-sm text-[var(--accent)] hover:underline"
              >
                Go to root
              </Link>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

interface DirectoryViewProps {
  entries: FileTreeType[] | null;
  currentPath: string;
  repoName: string;
}

function DirectoryView({ entries, currentPath, repoName }: DirectoryViewProps) {
  if (!entries || entries.length === 0) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center justify-center py-12 lg:py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] mb-4">
            <Icon name="folder" className="h-6 w-6 text-[var(--text-tertiary)]" />
          </div>
          <div className="text-body-lg font-medium text-[var(--text-primary)]">Empty directory</div>
          <div className="text-caption text-[var(--text-secondary)] mt-2">
            This directory has no visible files.
          </div>
        </div>
      </Card>
    );
  }

  const directChildren = entries;

  return (
    <div className="space-y-4 max-w-full min-w-0">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-body-lg font-medium text-[var(--text-primary)] truncate min-w-0">
            {currentPath || repoName}
          </h2>
          <span className="text-caption text-[var(--text-secondary)] shrink-0">
            {countItems(directChildren)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {directChildren.map((entry) => (
            <Link
              key={entry.path}
              href={`/browse/${entry.path}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] transition-all"
            >
              {entry.type === 'directory' ? (
                <FolderIcon />
              ) : (
                <FileIcon extension={entry.extension || ''} />
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
            </Link>
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

function FolderIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
      <Icon name="folder" className="h-4 w-4 text-[var(--accent)]" />
    </div>
  );
}

function FileIcon({ extension }: { extension: string }) {
  const color = getFileColor(extension);
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}15` }}
    >
      <svg
        className="h-4 w-4"
        style={{ color }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    </div>
  );
}

function getFileColor(extension: string): string {
  const ext = extension.replace('.', '').toLowerCase();
  const colors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f7df1e',
    jsx: '#61dafb',
    json: '#cbcb41',
    md: '#519aba',
    mdx: '#f9ac00',
    css: '#264de4',
    scss: '#cc6699',
    html: '#e34c26',
    prisma: '#2d3748',
    sql: '#f29111',
    py: '#3776ab',
    go: '#00add8',
    rs: '#dea584',
    yaml: '#cb171e',
    yml: '#cb171e',
    sh: '#89e051',
    bash: '#89e051',
  };
  return colors[ext] || 'var(--text-tertiary)';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SearchButton() {
  const { openSearch } = useGlobal();

  return (
    <button
      onClick={openSearch}
      className="w-[calc(100%-1rem)] flex items-center gap-2 px-3 py-2 mx-2 my-2 text-left text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg transition-colors"
    >
      <Icon name="search" className="h-4 w-4 text-[var(--text-tertiary)]" />
      <span className="flex-1">Search...</span>
      <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-primary)] text-[var(--text-tertiary)] rounded border border-[var(--border-default)]">
        /
      </kbd>
    </button>
  );
}
