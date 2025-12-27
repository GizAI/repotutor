'use client';

import { motion } from 'framer-motion';
import { Folder, MessageSquare, TerminalSquare, Monitor } from 'lucide-react';
import { useTab, TabType } from './TabContext';
import { useIsKeyboardOpen } from '@/hooks/useMediaQuery';

const tabs: { id: TabType; icon: typeof Folder; label: string }[] = [
  { id: 'browse', icon: Folder, label: '탐색' },
  { id: 'chat', icon: MessageSquare, label: 'AI' },
  { id: 'terminal', icon: TerminalSquare, label: '터미널' },
  { id: 'desktop', icon: Monitor, label: '데스크톱' },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useTab();
  const isKeyboardOpen = useIsKeyboardOpen();

  if (isKeyboardOpen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] bg-[var(--bg-primary)] border-t border-[var(--border-default)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="tablist"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`
                relative flex flex-col items-center justify-center gap-0.5
                flex-1 h-full
                transition-colors duration-150
                active:scale-95 touch-manipulation
                ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[var(--accent)] rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
