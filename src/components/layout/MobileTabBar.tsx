'use client';

import { Code2, Sparkles, GitBranch, Terminal, Monitor, LucideIcon } from 'lucide-react';
import { useGlobal } from './GlobalProviders';

type MobileTab = 'browse' | 'chat' | 'terminal' | 'desktop' | 'git';

const TABS: { id: MobileTab; icon: LucideIcon }[] = [
  { id: 'browse', icon: Code2 },
  { id: 'chat', icon: Sparkles },
  { id: 'git', icon: GitBranch },
  { id: 'terminal', icon: Terminal },
  { id: 'desktop', icon: Monitor },
];

export function MobileTabBar() {
  const { mobileTab, setMobileTab } = useGlobal();

  return (
    <nav className="shrink-0 h-10 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <div className="flex h-full items-center justify-around">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex items-center justify-center flex-1 h-full ${
                mobileTab === tab.id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <TabIcon className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
