'use client';

import { useState, useEffect, useCallback, createContext, useContext, lazy, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelRight } from 'lucide-react';
import { SearchModal, useSearchModal } from '@/components/search';
import { ChatBot } from '@/components/chat';
import { TabProvider, useTabSafe } from '@/components/navigation';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { SocketProvider } from '@/hooks/useSocket';
import { useT } from '@/lib/i18n';

// Lazy load components
const WebTerminal = lazy(() => import('@/components/terminal/WebTerminal').then(m => ({ default: m.WebTerminal })));
const DesktopViewer = lazy(() => import('@/components/terminal/DesktopViewer').then(m => ({ default: m.DesktopViewer })));
const GitPanel = lazy(() => import('@/components/git/GitPanel').then(m => ({ default: m.GitPanel })));
const MobileBrowseView = lazy(() => import('@/components/browser/MobileBrowseView').then(m => ({ default: m.MobileBrowseView })));

type MobileTab = 'browse' | 'chat' | 'terminal' | 'desktop' | 'git';

function getActiveTabFromPath(pathname: string): MobileTab {
  if (pathname.startsWith('/terminal')) return 'terminal';
  if (pathname.startsWith('/desktop')) return 'desktop';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/git')) return 'git';
  return 'browse';
}

function getBrowsePathFromUrl(pathname: string): string {
  if (pathname.startsWith('/browse/')) {
    return pathname.slice(8); // Remove '/browse/'
  }
  return '';
}

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
  // Mobile tab management (client-side for keep-alive)
  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  // Browse path for keep-alive
  browsePath: string;
  setBrowsePath: (path: string) => void;
  // Terminal auto-resize (shrink container when keyboard opens)
  terminalAutoResize: boolean;
  setTerminalAutoResize: (enabled: boolean) => void;
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
  const router = useRouter();
  const { isMobile, mounted } = useIsMobileSafe();
  const tabContext = useTabSafe();
  const { t } = useT();

  // Desktop: open by default, Mobile: managed by tabs
  const [isAgentOpen, setIsAgentOpen] = useState(true);

  // Terminal auto-resize state (shared with WebTerminal) - default OFF (fixed toolbar mode)
  const [terminalAutoResize, setTerminalAutoResize] = useState(false);

  // Client-side tab state for true keep-alive (no unmounting)
  const [mobileTab, setMobileTabState] = useState<MobileTab>('browse');
  const [visitedTabs, setVisitedTabs] = useState<Set<MobileTab>>(new Set(['browse']));
  const [inMobileTabMode, setInMobileTabMode] = useState(false);

  // Browse path state for keep-alive (client-side, not tied to URL)
  const [browsePath, setBrowsePathState] = useState<string>('');

  // Determine active tab and browse path from URL
  const activeTab = getActiveTabFromPath(pathname);
  const isBrowseRoute = pathname.startsWith('/browse');
  const isMobileTabRoute = !isBrowseRoute && (
    pathname.startsWith('/chat') ||
    pathname.startsWith('/terminal') ||
    pathname.startsWith('/desktop') ||
    pathname.startsWith('/git')
  );

  // Sync browse path from URL when on browse route
  useEffect(() => {
    if (isBrowseRoute) {
      setBrowsePathState(getBrowsePathFromUrl(pathname));
    }
  }, [isBrowseRoute, pathname]);

  // Tab setter - all tabs use history.replaceState for URL (no Next.js navigation)
  const setMobileTab = useCallback((tab: MobileTab) => {
    setMobileTabState(tab);
    setVisitedTabs(prev => prev.has(tab) ? prev : new Set([...prev, tab]));
    setInMobileTabMode(true);

    // Update URL without triggering navigation
    const url = tab === 'browse'
      ? (browsePath ? `/browse/${browsePath}` : '/browse')
      : `/${tab}`;
    window.history.replaceState(null, '', url);
  }, [browsePath]);

  // Browse path setter - updates URL and state
  const setBrowsePath = useCallback((path: string) => {
    setBrowsePathState(path);
    if (mobileTab === 'browse' && inMobileTabMode) {
      const url = path ? `/browse/${path}` : '/browse';
      window.history.replaceState(null, '', url);
    }
  }, [mobileTab, inMobileTabMode]);

  // Sync from URL on initial load and popstate (back/forward)
  useEffect(() => {
    const syncFromUrl = () => {
      const tab = getActiveTabFromPath(window.location.pathname);
      setMobileTabState(tab);
      setVisitedTabs(prev => prev.has(tab) ? prev : new Set([...prev, tab]));
      if (tab === 'browse') {
        setBrowsePathState(getBrowsePathFromUrl(window.location.pathname));
      }
      // Only set inMobileTabMode if we're on a mobile tab route
      if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/login')) {
        setInMobileTabMode(true);
      }
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  // Sync when entering via Next.js navigation
  useEffect(() => {
    if (isMobileTabRoute || isBrowseRoute) {
      setMobileTabState(activeTab);
      setVisitedTabs(prev => prev.has(activeTab) ? prev : new Set([...prev, activeTab]));
      setInMobileTabMode(true);
    }
  }, [isMobileTabRoute, isBrowseRoute, activeTab]);

  // Redirect mobile tab routes to /browse on desktop
  useEffect(() => {
    if (mounted && !isMobile && isMobileTabRoute) {
      router.replace('/browse');
    }
  }, [mounted, isMobile, isMobileTabRoute, router]);

  // Keyboard shortcuts
  useEffect(() => {
    // Skip keyboard shortcuts if in desktop browse mode (handled by browse layout)
    if (!isMobile && isBrowseRoute) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchModal.open();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        if (isMobile) {
          setMobileTab(mobileTab === 'chat' ? 'browse' : 'chat');
        } else {
          setIsAgentOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModal, isMobile, mobileTab, setMobileTab, isBrowseRoute]);

  // Dynamically update viewport meta tag based on terminal auto-resize setting
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    const baseContent = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    if (terminalAutoResize) {
      // Resize mode: let browser resize layout viewport with keyboard
      meta.setAttribute('content', `${baseContent}, interactive-widget=resizes-content`);
    } else {
      // Fixed toolbar mode: don't resize layout viewport
      meta.setAttribute('content', `${baseContent}, interactive-widget=resizes-visual`);
    }
    // Reset scroll position to prevent viewport jump
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [terminalAutoResize]);

  // Determine if we should use mobile keep-alive layout
  const useMobileKeepAlive = mounted && isMobile && (isMobileTabRoute || isBrowseRoute || inMobileTabMode);

  return (
    <GlobalContext.Provider
      value={{
        openSearch: searchModal.open,
        openChat: () => {
          if (isMobile) {
            setMobileTab('chat');
          } else {
            setIsAgentOpen(true);
          }
        },
        toggleChat: () => {
          if (isMobile) {
            setMobileTab(mobileTab === 'chat' ? 'browse' : 'chat');
          } else {
            setIsAgentOpen((prev) => !prev);
          }
        },
        isChatOpen: isMobile ? mobileTab === 'chat' : isAgentOpen,
        mobileTab,
        setMobileTab,
        browsePath,
        setBrowsePath,
        terminalAutoResize,
        setTerminalAutoResize,
      }}
    >
      {!mounted ? (
        /* SSR/initial loading: skeleton */
        <div className="flex min-h-dvh">
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      ) : useMobileKeepAlive ? (
        /* Mobile: keep-alive tab layout - uses 100dvh which auto-resizes with interactive-widget=resizes-content */
        <div className="flex flex-col h-dvh bg-[var(--bg-primary)]">
          <div className="flex-1 min-h-0 relative">
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)]">{t('common.loading')}</div>}>
              {/* All tabs stacked absolutely, visibility controlled by client state */}
              {(['browse', 'chat', 'terminal', 'desktop', 'git'] as const).map((tab) =>
                visitedTabs.has(tab) && (
                  <div
                    key={tab}
                    className="absolute inset-0 flex flex-col overflow-hidden"
                    style={{
                      display: mobileTab === tab ? 'flex' : 'none',
                      contain: 'strict',
                    }}
                  >
                    {tab === 'browse' && (
                      <MobileBrowseView
                        path={browsePath}
                        onNavigate={setBrowsePath}
                        onSearch={searchModal.open}
                      />
                    )}
                    {tab === 'chat' && <ChatBot isOpen onClose={() => setMobileTab('browse')} currentPath={browsePath} fullScreen />}
                    {tab === 'terminal' && <WebTerminal className="h-full" isActive={mobileTab === 'terminal'} />}
                    {tab === 'desktop' && <DesktopViewer className="h-full" />}
                    {tab === 'git' && <GitPanel isOpen onClose={() => setMobileTab('browse')} embedded />}
                  </div>
                )
              )}
            </Suspense>
          </div>
          <MobileTabBar />
          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </div>
      ) : isMobile ? (
        /* Mobile: non-tab route (home, login, etc.) */
        <>
          {children}
          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </>
      ) : isBrowseRoute ? (
        /* Desktop browse: use its own layout */
        <>
          {children}
          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </>
      ) : (
        /* Desktop: split layout for non-browse routes */
        <div className="flex min-h-dvh">
          <div
            className="flex-1 min-w-0 transition-all duration-300"
            style={{ marginRight: isAgentOpen ? '420px' : '0' }}
          >
            {children}
          </div>

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
                  currentPath={browsePath}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!isAgentOpen && (
            <button
              onClick={() => setIsAgentOpen(true)}
              className="fixed right-4 bottom-6 z-[70] flex items-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-full shadow-lg hover:shadow-xl transition-all"
              title={t('agent.openShortcut', { shortcut: '⌘/' })}
            >
              <PanelRight className="w-5 h-5" />
              <span className="text-sm font-medium">{t('agent.title')}</span>
            </button>
          )}

          <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
        </div>
      )}
    </GlobalContext.Provider>
  );
}
