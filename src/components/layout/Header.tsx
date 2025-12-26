'use client';

import Link from 'next/link';
import { Icon, type IconName } from '../ui/Icon';
import { useThemeContext } from './ThemeProvider';
import { useGlobal } from './GlobalProviders';
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

export function Header({ onMenuClick, repoName = 'RepoTutor' }: HeaderProps) {
  const { themeMode, cycleTheme, mounted } = useThemeContext();
  const { openSearch } = useGlobal();

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
        <div className="flex items-center gap-1">
          {/* Browse Link - 데스크톱만 */}
          <Link
            href="/browse"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
          >
            <Icon name="folder" className="h-4 w-4" />
            <span className="hidden md:inline">Browse</span>
          </Link>

          {/* Search Button - 항상 표시 */}
          <button
            onClick={openSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
            title="검색 (⌘K)"
          >
            <Icon name="search" className="h-4 w-4" />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] font-mono text-[var(--text-tertiary)]">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle - 항상 표시 */}
          <button
            onClick={cycleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            title={`테마: ${themeMode}`}
          >
            {mounted ? (
              <Icon name={THEME_ICONS[themeMode]} className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </button>

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
