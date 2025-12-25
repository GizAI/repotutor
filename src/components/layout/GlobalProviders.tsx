'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { SearchModal, useSearchModal } from '@/components/search';
import { ChatBot, useChatBot } from '@/components/chat';

interface GlobalContextType {
  openSearch: () => void;
  openChat: () => void;
  toggleChat: () => void;
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
  const searchModal = useSearchModal();
  const chatBot = useChatBot();
  const pathname = usePathname();

  // Extract current file path from URL
  const currentPath = pathname.startsWith('/browse/')
    ? pathname.replace('/browse/', '')
    : undefined;

  return (
    <GlobalContext.Provider
      value={{
        openSearch: searchModal.open,
        openChat: chatBot.open,
        toggleChat: chatBot.toggle,
      }}
    >
      {children}

      {/* Global Search Modal */}
      <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />

      {/* AI ChatBot */}
      <ChatBot
        isOpen={chatBot.isOpen}
        onClose={chatBot.close}
        currentPath={currentPath}
      />

      {/* Floating Action Buttons */}
      <FloatingButtons
        onSearchClick={searchModal.open}
        onChatClick={chatBot.toggle}
        isChatOpen={chatBot.isOpen}
      />
    </GlobalContext.Provider>
  );
}

interface FloatingButtonsProps {
  onSearchClick: () => void;
  onChatClick: () => void;
  isChatOpen: boolean;
}

function FloatingButtons({ onSearchClick, onChatClick, isChatOpen }: FloatingButtonsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[80] flex flex-col gap-3 transition-transform duration-300 ${isChatOpen ? 'translate-x-[-440px] sm:translate-x-0' : ''}`}>
      {/* Search Button */}
      <button
        onClick={onSearchClick}
        className="group flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-full shadow-lg hover:border-[var(--accent)] hover:shadow-xl transition-all"
        title="검색 (Cmd+K)"
      >
        <svg className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">검색</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded">
          ⌘K
        </kbd>
      </button>

      {/* Chat Button */}
      <button
        onClick={onChatClick}
        className={`group flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${
          isChatOpen
            ? 'bg-[var(--accent)] text-[var(--bg-primary)] border border-transparent'
            : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--accent)] hover:shadow-xl'
        }`}
        title="AI 챗봇 (Cmd+/)"
      >
        <svg className={`w-5 h-5 ${isChatOpen ? '' : 'text-[var(--text-secondary)] group-hover:text-[var(--accent)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className={`hidden sm:inline text-sm ${isChatOpen ? '' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
          {isChatOpen ? '닫기' : 'AI 챗봇'}
        </span>
        {!isChatOpen && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded">
            ⌘/
          </kbd>
        )}
      </button>
    </div>
  );
}
