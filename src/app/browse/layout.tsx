'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTree, BreadcrumbNav } from '@/components/browser';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useGlobal } from '@/components/layout';
import { useThemeContext } from '@/components/layout/ThemeProvider';
import type { ThemeMode } from '@/lib/themes';
import type { FileTree as FileTreeType } from '@/lib/files/reader';
import { BrowseContext } from './BrowseContext';

const THEME_ICONS: Record<ThemeMode, IconName> = {
  dark: 'moon',
  light: 'sun',
  system: 'monitor',
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entries, setEntries] = useState<FileTreeType[] | null>(null);
  const { openSearch } = useGlobal();
  const { themeMode, cycleTheme, mounted } = useThemeContext();

  // URL에서 현재 경로 추출
  const currentPath = pathname.startsWith('/browse/')
    ? decodeURIComponent(pathname.slice(8))
    : '';

  // 파일 트리 한번만 로드 (레이아웃은 네비게이션 시 다시 마운트되지 않음!)
  useEffect(() => {
    fetch('/api/files/?tree=true&depth=0', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setEntries(data.entries || []);
      })
      .catch(err => {
        console.error('Failed to load file tree:', err);
        setEntries([]);
      });
  }, []); // 마운트 시 한번만!

  const handleNavigate = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const repoName = 'reson';

  return (
    <BrowseContext.Provider value={{ entries, currentPath }}>
      <div className="flex flex-col min-h-screen bg-[var(--bg-primary)]">
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="flex h-12 items-center justify-between px-4">
            {/* Left: Mobile Menu + Logo */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                aria-label="Open menu"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
                  <Icon name="book" className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-sm hidden sm:inline">{repoName}</span>
              </Link>
            </div>

            {/* Center: Search */}
            <button
              onClick={openSearch}
              className="flex items-center gap-2 px-3 py-1.5 mx-4 flex-1 max-w-md text-left text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg transition-colors"
            >
              <Icon name="search" className="h-4 w-4 text-[var(--text-tertiary)]" />
              <span className="flex-1 hidden sm:inline">Search files...</span>
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-primary)] text-[var(--text-tertiary)] rounded border border-[var(--border-default)]">
                ⌘K
              </kbd>
            </button>

            {/* Right: Theme */}
            <button
              onClick={cycleTheme}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
              title={`테마: ${themeMode}`}
            >
              {mounted ? (
                <Icon name={THEME_ICONS[themeMode]} className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        <div className="flex flex-1">
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

          {/* Sidebar - File Tree (레이아웃에 있으므로 다시 로드 안 됨!) */}
          <aside
            className={`
              w-72 lg:w-64 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-primary)] overflow-y-auto
              fixed top-0 left-0 h-screen z-50
              transform transition-transform duration-200 ease-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              lg:translate-x-0 lg:top-12 lg:z-30
              lg:h-[calc(100vh-3rem)]
            `}
          >
            <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between lg:hidden">
              <Link
                href="/"
                className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <Icon name="arrow" className="h-4 w-4 rotate-180" />
                <span className="font-medium text-sm">{repoName}</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                aria-label="Close menu"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2">
              {entries && entries.length > 0 ? (
                <FileTree entries={entries} onNavigate={handleNavigate} />
              ) : entries === null ? (
                <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                  Loading...
                </div>
              ) : (
                <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                  No files found
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 lg:ml-64 p-4 lg:p-6 min-w-0 max-w-full overflow-x-hidden">
            {/* Breadcrumb */}
            <div className="mb-4 lg:mb-6 overflow-x-auto max-w-full">
              <BreadcrumbNav path={currentPath} repoName={repoName} />
            </div>

            {/* Page Content (children) */}
            {children}
          </main>
        </div>
      </div>
    </BrowseContext.Provider>
  );
}
