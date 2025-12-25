'use client';

import Link from 'next/link';
import { Icon } from '../ui/Icon';
import { useThemeContext } from './ThemeProvider';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { themeId, setTheme } = useThemeContext();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg0)]/55 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_60px_var(--shadow)] group-hover:border-[var(--accent)]/30 transition-colors">
              <Icon name="spark" className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div>
              <div className="font-display text-sm tracking-[0.12em]">REPOTUTOR</div>
              <div className="text-[11px] text-[var(--muted)] font-body">AI-Powered Docs</div>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* GitHub Link */}
          <a
            href="https://github.com/GizAI/repotutor"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/60 px-3 py-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            GitHub
          </a>

          {/* Theme Toggle */}
          <div className="hidden sm:inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)]/60 p-1 backdrop-blur">
            <button
              onClick={() => setTheme('noir')}
              className={`rounded-full px-3 py-1.5 text-[10px] tracking-[0.3em] uppercase transition ${
                themeId === 'noir'
                  ? 'bg-[var(--bg0)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Noir
            </button>
            <button
              onClick={() => setTheme('paper')}
              className={`rounded-full px-3 py-1.5 text-[10px] tracking-[0.3em] uppercase transition ${
                themeId === 'paper'
                  ? 'bg-[var(--bg0)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Paper
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden rounded-full border border-[var(--line)] bg-[var(--panel)]/60 p-2.5 backdrop-blur hover:bg-[var(--panel)]"
          >
            <Icon name="menu" className="h-5 w-5 text-[var(--muted)]" />
          </button>
        </div>
      </div>
    </header>
  );
}
