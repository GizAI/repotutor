'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTree, BreadcrumbNav } from '@/components/browser';
import { ChatBot } from '@/components/chat';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useGlobal } from '@/components/layout';
import { useThemeContext } from '@/components/layout/ThemeProvider';
import { RepoSelector } from '@/components/layout/RepoSelector';
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
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [repoName, setRepoName] = useState('');
  const { openSearch } = useGlobal();
  const { themeMode, cycleTheme, mounted } = useThemeContext();

  // Panel refs for imperative collapse/expand
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    const panel = sidebarPanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
        setIsSidebarCollapsed(false);
      } else {
        panel.collapse();
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  // Toggle chat
  const toggleChat = useCallback(() => {
    const panel = chatPanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
        setIsChatOpen(true);
      } else {
        panel.collapse();
        setIsChatOpen(false);
      }
    }
  }, []);

  // 현재 프로젝트 이름 가져오기
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.currentProject?.name) {
          setRepoName(data.currentProject.name);
        }
      })
      .catch(console.error);
  }, []);

  // URL에서 현재 경로 추출
  const currentPath = pathname.startsWith('/browse/')
    ? decodeURIComponent(pathname.slice(8))
    : '';

  // 파일 트리 로드
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
  }, []);

  const handleNavigate = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + / : 채팅 토글
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleChat();
      }
      // Cmd/Ctrl + B : 사이드바 토글
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleChat]);

  // 모바일 레이아웃
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    setIsMobile(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // 모바일에서는 기존 레이아웃 사용
  if (isMobile) {
    return (
      <BrowseContext.Provider value={{ entries, currentPath }}>
        <div className="flex flex-col min-h-screen bg-[var(--bg-primary)]">
          {/* Sticky Header */}
          <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
            <div className="flex h-12 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <Icon name="menu" className="h-5 w-5" />
                </button>
                <RepoSelector />
              </div>

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

              <button
                onClick={cycleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
              >
                {mounted && <Icon name={THEME_ICONS[themeMode]} className="h-4 w-4" />}
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
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
              )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <aside
              className={`
                w-72 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-primary)] overflow-y-auto
                fixed top-0 left-0 h-screen z-50
                transform transition-transform duration-200 ease-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              `}
            >
              <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 text-[var(--text-primary)]" onClick={() => setSidebarOpen(false)}>
                  <Icon name="arrow" className="h-4 w-4 rotate-180" />
                  <span className="font-medium text-sm">{repoName}</span>
                </Link>
                <button onClick={() => setSidebarOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
              <div className="p-2">
                {entries && entries.length > 0 ? (
                  <FileTree entries={entries} onNavigate={handleNavigate} />
                ) : entries === null ? (
                  <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">Loading...</div>
                ) : (
                  <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">No files found</div>
                )}
              </div>
            </aside>

            <main className="flex-1 p-4 lg:p-6 min-w-0 max-w-full overflow-x-hidden">
              <div className="mb-4 lg:mb-6 overflow-x-auto max-w-full">
                <BreadcrumbNav path={currentPath} repoName={repoName} />
              </div>
              {children}
            </main>
          </div>
        </div>
      </BrowseContext.Provider>
    );
  }

  // 데스크톱: Flexbox 레이아웃
  return (
    <BrowseContext.Provider value={{ entries, currentPath }}>
      <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
        {/* Sticky Header */}
        <header className="shrink-0 h-12 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/80 backdrop-blur-xl z-40">
          <div className="flex h-full items-center justify-between px-4">
            {/* Left: Sidebar Toggle + RepoSelector */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSidebar}
                className="flex items-center justify-center h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                title="Toggle sidebar (⌘B)"
              >
                <Icon name={isSidebarCollapsed ? 'menu' : 'sidebar'} className="h-4 w-4" />
              </button>
              <RepoSelector />
            </div>

            {/* Center: Search */}
            <button
              onClick={openSearch}
              className="flex items-center gap-2 px-3 py-1.5 mx-4 flex-1 max-w-md text-left text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg transition-colors"
            >
              <Icon name="search" className="h-4 w-4 text-[var(--text-tertiary)]" />
              <span className="flex-1">Search files...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-primary)] text-[var(--text-tertiary)] rounded border border-[var(--border-default)]">
                ⌘K
              </kbd>
            </button>

            {/* Right: Theme + Chat Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={cycleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                title={`Theme: ${themeMode}`}
              >
                {mounted && <Icon name={THEME_ICONS[themeMode]} className="h-4 w-4" />}
              </button>
              <button
                onClick={toggleChat}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  isChatOpen
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                }`}
                title="Toggle AI Chat (⌘/)"
              >
                <Icon name="spark" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content with Resizable Panels */}
        <ResizablePanelGroup id="browse-layout" direction="horizontal" className="flex-1 min-h-0">
          {/* Sidebar */}
          <ResizablePanel
            ref={sidebarPanelRef}
            defaultSize={20}
            minSize={15}
            maxSize={30}
            collapsible
            collapsedSize={0}
            onCollapse={() => setIsSidebarCollapsed(true)}
            onExpand={() => setIsSidebarCollapsed(false)}
          >
            <aside className="h-full border-r border-[var(--border-default)] bg-[var(--bg-primary)] overflow-y-auto">
              <div className="p-2">
                {entries && entries.length > 0 ? (
                  <FileTree entries={entries} onNavigate={handleNavigate} />
                ) : entries === null ? (
                  <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">Loading...</div>
                ) : (
                  <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">No files found</div>
                )}
              </div>
            </aside>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Content */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <main className="h-full overflow-y-auto">
              <div className="p-4 lg:p-6 min-w-0 max-w-full">
                {/* Breadcrumb */}
                <div className="mb-4 lg:mb-6 overflow-x-auto max-w-full">
                  <BreadcrumbNav path={currentPath} repoName={repoName} />
                </div>
                {children}
              </div>
            </main>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Panel */}
          <ResizablePanel
            ref={chatPanelRef}
            defaultSize={30}
            minSize={20}
            maxSize={40}
            collapsible
            collapsedSize={0}
            onCollapse={() => setIsChatOpen(false)}
            onExpand={() => setIsChatOpen(true)}
          >
            <div className="h-full border-l border-[var(--border-default)]">
              <ChatBot
                isOpen={true}
                onClose={toggleChat}
                currentPath={currentPath}
                fullScreen
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </BrowseContext.Provider>
  );
}
