'use client';

import { motion } from 'framer-motion';
import { Folder, MessageSquare, TerminalSquare, Monitor } from 'lucide-react';
import { useTab, TabType } from './TabContext';
import { useIsKeyboardOpen } from '@/hooks/useMediaQuery';
import { useT } from '@/lib/i18n';

const tabConfigs: { id: TabType; icon: typeof Folder; labelKey: string }[] = [
  { id: 'browse', icon: Folder, labelKey: 'nav.browse' },
  { id: 'chat', icon: MessageSquare, labelKey: 'nav.chat' },
  { id: 'terminal', icon: TerminalSquare, labelKey: 'nav.terminal' },
  { id: 'desktop', icon: Monitor, labelKey: 'nav.desktop' },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useTab();
  const isKeyboardOpen = useIsKeyboardOpen();
  const { t } = useT();

  if (isKeyboardOpen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] bg-[var(--bg-primary)] border-t border-[var(--border-default)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="tablist"
    >
      <div className="flex items-center justify-around h-14">
        {tabConfigs.map((tab) => {
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
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
