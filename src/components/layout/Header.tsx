'use client';

import Link from 'next/link';
import { Icon, type IconName } from '../ui/Icon';
import { useThemeContext } from './ThemeProvider';
import type { ThemeMode } from '@/lib/themes';

interface HeaderProps {
  onMenuClick?: () => void;
  repoName?: string;
}

const THEME_ICONS: Record<ThemeMode, IconName> = {
  dark: 'moon',
  light: 'sun',
  system: 'monitor',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

export function Header({ onMenuClick, repoName = 'RepoTutor' }: HeaderProps) {
  const { themeMode, setTheme, mounted } = useThemeContext();

  const themes: ThemeMode[] = ['dark', 'light', 'system'];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <Icon name="book" className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">{repoName}</span>
        </Link>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Browse Link */}
          <Link
            href="/browse"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
          >
            <Icon name="folder" className="h-4 w-4" />
            Browse
          </Link>

          {/* Search Button */}
          <button
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
            onClick={() => console.log('Open search')}
          >
            <Icon name="search" className="h-4 w-4" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden md:inline ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] font-mono text-[var(--text-tertiary)]">
              /
            </kbd>
          </button>

          {/* Theme Toggle - Segmented Control */}
          <div className="hidden sm:flex items-center p-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            {themes.map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`
                  flex items-center justify-center w-8 h-7 rounded-md transition-all duration-200
                  ${themeMode === mode
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }
                `}
                title={THEME_LABELS[mode]}
                aria-label={`Switch to ${THEME_LABELS[mode]} theme`}
              >
                {mounted ? (
                  <Icon name={THEME_ICONS[mode]} className="h-4 w-4" />
                ) : (
                  <div className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="Open menu"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
