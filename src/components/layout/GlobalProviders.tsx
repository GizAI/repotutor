'use client';

import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelRight } from 'lucide-react';
import { SearchModal, useSearchModal } from '@/components/search';
import { ChatBot } from '@/components/chat';
import { TabProvider, TabBar, useTabSafe } from '@/components/navigation';
import { SocketProvider } from '@/hooks/useSocket';

// Lazy load terminal components
const WebTerminal = lazy(() => import('@/components/terminal/WebTerminal').then(m => ({ default: m.WebTerminal })));
const DesktopViewer = lazy(() => import('@/components/terminal/DesktopViewer').then(m => ({ default: m.DesktopViewer })));

// SSR-safe media query hook
function useIsMobileSafe(): { isMobile: boolean; mounted: boolean } {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia('(max-width: 1023px)');
    setIsMobile(media.matches);

    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return { isMobile, mounted };
}

interface GlobalContextType {
  openSearch: () => void;
  openChat: () => void;
  toggleChat: () => void;
  isChatOpen: boolean;
}

const GlobalContext = createContext<GlobalContextType | null>(null);

export function useGlobal() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobal must be used within GlobalProviders');
  }
  return context;
}

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <TabProvider>
        <GlobalProvidersInner>{children}</GlobalProvidersInner>
      </TabProvider>
    </SocketProvider>
  );
}

function GlobalProvidersInner({ children }: { children: React.ReactNode }) {
  const searchModal = useSearchModal();
  const pathname = usePathname();
  const { isMobile, mounted } = useIsMobileSafe();
  const tabContext = useTabSafe();

  // /browse 경로는 자체 레이아웃을 사용
  const isBrowsePage = pathname.startsWith('/browse');

  // 데스크톱: 기본으로 열려있음, 모바일: 탭으로 관리
  const [isAgentOpen, setIsAgentOpen] = useState(true);

  const currentPath = pathname.startsWith('/browse/')
    ? pathname.replace('/browse/', '')
    : undefined;

  const isChatTabActive = tabContext?.activeTab === 'chat';
  const isTerminalTabActive = tabContext?.activeTab === 'terminal';
  const isDesktopTabActive = tabContext?.activeTab === 'desktop';

  // 키보드 단축키 - /browse에서는 자체 처리하므로 스킵
  useEffect(() => {
    if (isBrowsePage) return; // browse 페이지는 자체 단축키 사용

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchModal.open();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        if (isMobile && tabContext) {
          tabContext.setActiveTab(tabContext.activeTab === 'chat' ? 'browse' : 'chat');
        } else {
          setIsAgentOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModal, isMobile, tabContext, isBrowsePage]);

  return (
    <GlobalContext.Provider
      value={{
        openSearch: searchModal.open,
        openChat: () => {
          if (isMobile && tabContext) {
            tabContext.setActiveTab('chat');
          } else {
            setIsAgentOpen(true);
          }
        },
        toggleChat: () => {
          if (isMobile && tabContext) {
            tabContext.setActiveTab(tabContext.activeTab === 'chat' ? 'browse' : 'chat');
          } else {
            setIsAgentOpen((prev) => !prev);
          }
        },
        isChatOpen: isMobile ? isChatTabActive ?? false : isAgentOpen,
      }}
    >
      {/* /browse 페이지는 자체 레이아웃 사용 */}
      {isBrowsePage ? (
        <>
          {children}
          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </>
      ) : !mounted ? (
        /* SSR/초기 로딩: 데스크톱 레이아웃으로 통일 (hydration 일치) */
        <div className="flex min-h-screen">
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      ) : isMobile ? (
        /* 모바일: 탭 기반 레이아웃 */
        <>
          <div
            className={tabContext?.activeTab === 'browse' ? 'block' : 'hidden'}
            style={{ paddingBottom: '3.5rem' }}
          >
            {children}
          </div>

          <AnimatePresence mode="wait">
            {isChatTabActive && (
              <motion.div
                key="chat-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-[var(--bg-primary)]"
                style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
              >
                <ChatBot
                  isOpen={true}
                  onClose={() => tabContext?.setActiveTab('browse')}
                  currentPath={currentPath}
                  fullScreen
                />
              </motion.div>
            )}
            {isTerminalTabActive && (
              <motion.div
                key="terminal-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-[var(--bg-primary)]"
                style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
              >
                <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--text-secondary)]">Loading...</div>}>
                  <WebTerminal className="h-full" />
                </Suspense>
              </motion.div>
            )}
            {isDesktopTabActive && (
              <motion.div
                key="desktop-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-[var(--bg-primary)]"
                style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
              >
                <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--text-secondary)]">Loading...</div>}>
                  <DesktopViewer className="h-full" />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          <TabBar />
          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </>
      ) : (
        /* 데스크톱: 분리 레이아웃 */
        <div className="flex min-h-screen">
          {/* 메인 콘텐츠 */}
          <div
            className="flex-1 min-w-0 transition-all duration-300"
            style={{ marginRight: isAgentOpen ? '420px' : '0' }}
          >
            {children}
          </div>

          {/* AI Agent 패널 */}
          <AnimatePresence>
            {isAgentOpen && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 h-screen w-[420px] z-[60] border-l border-[var(--border-default)] bg-[var(--bg-primary)]"
              >
                <ChatBot
                  isOpen={true}
                  onClose={() => setIsAgentOpen(false)}
                  currentPath={currentPath}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent 토글 버튼 (접혀있을 때) */}
          {!isAgentOpen && (
            <button
              onClick={() => setIsAgentOpen(true)}
              className="fixed right-4 bottom-6 z-[70] flex items-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-full shadow-lg hover:shadow-xl transition-all"
              title="AI 에이전트 열기 (⌘/)"
            >
              <PanelRight className="w-5 h-5" />
              <span className="text-sm font-medium">AI 에이전트</span>
            </button>
          )}

          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </div>
      )}
    </GlobalContext.Provider>
  );
}
