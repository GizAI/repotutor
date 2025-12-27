'use client';

import Link from 'next/link';
import { Code2, Folder, Search, Moon, Sun, Monitor, Menu, LucideIcon } from 'lucide-react';
import { useThemeContext } from './ThemeProvider';
import { useGlobal } from './GlobalProviders';
import { RepoSelector } from './RepoSelector';
import { useT } from '@/lib/i18n';
import type { ThemeMode } from '@/lib/themes';

interface Project {
  id: string;
  name: string;
  path: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
  repoName?: string;
  currentProject?: Project | null;
}

const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

export function Header({ onMenuClick, repoName = 'Giz Code', currentProject }: HeaderProps) {
  const { themeMode, cycleTheme, mounted } = useThemeContext();
  const { openSearch } = useGlobal();
  const { t } = useT();

  const getThemeModeLabel = (mode: ThemeMode) => {
    const labels: Record<ThemeMode, string> = {
      light: t('header.themeLight'),
      dark: t('header.themeDark'),
      system: t('header.themeSystem'),
    };
    return labels[mode];
  };

  const ThemeIcon = THEME_ICONS[themeMode];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo + RepoSelector */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
              <Code2 className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline font-semibold text-[var(--text-primary)]">{repoName}</span>
          </Link>
          <div className="h-5 w-px bg-[var(--border-default)] hidden sm:block" />
          <RepoSelector currentProject={currentProject} />
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-1">
          {/* Browse Link */}
          <Link
            href="/browse"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
          >
            <Folder className="h-4 w-4" />
            <span className="hidden md:inline">Browse</span>
          </Link>

          {/* Search Button */}
          <button
            onClick={openSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
            title={t('header.searchPlaceholder', { shortcut: '⌘K' })}
          >
            <Search className="h-4 w-4" />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] font-mono text-[var(--text-tertiary)]">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={cycleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            title={t('header.theme', { mode: getThemeModeLabel(themeMode) })}
          >
            {mounted ? <ThemeIcon className="h-4 w-4" /> : <div className="h-4 w-4" />}
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
