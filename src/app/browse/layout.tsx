'use client';

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
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

// Lazy load terminal components
const WebTerminal = lazy(() => import('@/components/terminal/WebTerminal').then(m => ({ default: m.WebTerminal })));
const DesktopViewer = lazy(() => import('@/components/terminal/DesktopViewer').then(m => ({ default: m.DesktopViewer })));

const THEME_ICONS: Record<ThemeMode, IconName> = {
  dark: 'moon',
  light: 'sun',
  system: 'monitor',
};

type BottomTab = 'terminal' | 'desktop';
type MobileTab = 'browse' | 'chat' | 'terminal' | 'desktop';

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entries, setEntries] = useState<FileTreeType[] | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [isBottomOpen, setIsBottomOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('browse');
  const { openSearch } = useGlobal();
  const { themeMode, cycleTheme, mounted } = useThemeContext();

  // Panel refs for imperative collapse/expand
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const bottomPanelRef = useRef<ImperativePanelHandle>(null);

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

  // Toggle bottom panel
  const toggleBottom = useCallback(() => {
    const panel = bottomPanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
        setIsBottomOpen(true);
      } else {
        panel.collapse();
        setIsBottomOpen(false);
      }
    }
  }, []);

  // Open bottom panel with specific tab
  const openBottomTab = useCallback((tab: BottomTab) => {
    setBottomTab(tab);
    const panel = bottomPanelRef.current;
    if (panel && panel.isCollapsed()) {
      panel.expand();
      setIsBottomOpen(true);
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
      // Cmd/Ctrl + ` : 터미널 토글
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        if (isBottomOpen && bottomTab === 'terminal') {
          toggleBottom();
        } else {
          openBottomTab('terminal');
        }
      }
      // Cmd/Ctrl + Shift + D : 데스크톱 토글
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (isBottomOpen && bottomTab === 'desktop') {
          toggleBottom();
        } else {
          openBottomTab('desktop');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, toggleChat, toggleBottom, openBottomTab, isBottomOpen, bottomTab]);

  // 모바일 레이아웃 - mounted 후에만 결정 (hydration 에러 방지)
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    setIsMobile(media.matches);
    // Close chat by default on mobile
    if (media.matches) {
      setIsChatOpen(false);
    }
    const listener = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setIsChatOpen(false);
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // SSR/초기 렌더링: skeleton 표시 (hydration mismatch 방지)
  if (!mounted || isMobile === null) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)]">
        <div className="flex-1 animate-pulse bg-[var(--bg-secondary)]" />
      </div>
    );
  }

  // 모바일: 4탭 (Browse, Chat, Terminal, Desktop) + 햄버거 사이드바
  if (isMobile) {
    return (
      <BrowseContext.Provider value={{ entries, currentPath }}>
        <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
          {/* Header */}
          <header className="shrink-0 h-12 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
            <div className="flex h-full items-center gap-2 px-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)]"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <RepoSelector />
              <button
                onClick={openSearch}
                className="flex items-center gap-2 px-2.5 py-1.5 flex-1 max-w-[160px] text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg"
              >
                <Icon name="search" className="h-4 w-4" />
                <span className="truncate">Search</span>
              </button>
              <button
                onClick={cycleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)]"
              >
                {mounted && <Icon name={THEME_ICONS[themeMode]} className="h-4 w-4" />}
              </button>
            </div>
          </header>

          {/* Sidebar Overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
              <aside className="relative w-72 h-full bg-[var(--bg-primary)] border-r border-[var(--border-default)] overflow-y-auto">
                <div className="p-3 border-b border-[var(--border-default)] flex items-center justify-between">
                  <span className="font-medium text-sm text-[var(--text-primary)]">{repoName || 'Files'}</span>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 rounded text-[var(--text-secondary)]">
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-2">
                  {entries && entries.length > 0 ? (
                    <FileTree entries={entries} onNavigate={() => setSidebarOpen(false)} />
                  ) : (
                    <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                      {entries === null ? 'Loading...' : 'No files'}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === 'browse' && (
              <div className="h-full overflow-y-auto p-4">
                <div className="mb-3 overflow-x-auto">
                  <BreadcrumbNav path={currentPath} repoName={repoName} />
                </div>
                {children}
              </div>
            )}

            {mobileTab === 'chat' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--text-secondary)]">Loading...</div>}>
                <ChatBot
                  isOpen={true}
                  onClose={() => setMobileTab('browse')}
                  currentPath={currentPath}
                  fullScreen
                />
              </Suspense>
            )}

            {mobileTab === 'terminal' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--text-secondary)]">Loading...</div>}>
                <WebTerminal className="h-full" />
              </Suspense>
            )}

            {mobileTab === 'desktop' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--text-secondary)]">Loading...</div>}>
                <DesktopViewer className="h-full" />
              </Suspense>
            )}
          </main>

          {/* Bottom Tab Bar - 4탭 */}
          <nav className="shrink-0 h-14 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
            <div className="flex h-full items-center justify-around">
              <button
                onClick={() => setMobileTab('browse')}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                  mobileTab === 'browse' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon name="code" className="h-5 w-5" />
                <span className="text-[10px] font-medium">Browse</span>
              </button>
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                  mobileTab === 'chat' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon name="spark" className="h-5 w-5" />
                <span className="text-[10px] font-medium">Chat</span>
              </button>
              <button
                onClick={() => setMobileTab('terminal')}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                  mobileTab === 'terminal' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon name="terminal" className="h-5 w-5" />
                <span className="text-[10px] font-medium">Terminal</span>
              </button>
              <button
                onClick={() => setMobileTab('desktop')}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                  mobileTab === 'desktop' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon name="monitor" className="h-5 w-5" />
                <span className="text-[10px] font-medium">Desktop</span>
              </button>
            </div>
          </nav>
        </div>
      </BrowseContext.Provider>
    );
  }

  // 데스크톱: Flexbox 레이아웃 with bottom panel
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

            {/* Right: Bottom Panel + Theme + Chat Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleBottom}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  isBottomOpen
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                }`}
                title="Toggle Panel (⌘`)"
              >
                <Icon name="terminal" className="h-4 w-4" />
              </button>
              <div className="w-px h-4 bg-[var(--border-default)]" />
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

        {/* Main Content with Vertical Split */}
        <ResizablePanelGroup id="browse-vertical" direction="vertical" className="flex-1 min-h-0">
          {/* Top: Horizontal panels (sidebar, content, chat) */}
          <ResizablePanel defaultSize={70} minSize={30}>
            <ResizablePanelGroup id="browse-horizontal" direction="horizontal" className="h-full">
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
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Bottom: Terminal/Desktop Panel */}
          <ResizablePanel
            ref={bottomPanelRef}
            defaultSize={30}
            minSize={15}
            maxSize={60}
            collapsible
            collapsedSize={0}
            onCollapse={() => setIsBottomOpen(false)}
            onExpand={() => setIsBottomOpen(true)}
          >
            <div className="h-full border-t border-[var(--border-default)] flex flex-col bg-[var(--bg-primary)]">
              {/* Tab Header */}
              <div className="shrink-0 flex items-center gap-1 px-2 h-9 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <button
                  onClick={() => setBottomTab('terminal')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
                    bottomTab === 'terminal'
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon name="terminal" className="h-3.5 w-3.5" />
                  Terminal
                </button>
                <button
                  onClick={() => setBottomTab('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
                    bottomTab === 'desktop'
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon name="monitor" className="h-3.5 w-3.5" />
                  Desktop
                </button>
                <div className="flex-1" />
                <button
                  onClick={toggleBottom}
                  className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                  title="Close panel"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--text-secondary)]">Loading...</div>}>
                  {bottomTab === 'terminal' && <WebTerminal className="h-full" />}
                  {bottomTab === 'desktop' && <DesktopViewer className="h-full" />}
                </Suspense>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </BrowseContext.Provider>
  );
}
