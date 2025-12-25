'use client';

import Link from 'next/link';
import { useMemo } from 'react';

export interface DocLink {
  path: string;
  title: string;
  order?: number;
}

interface DocNavigationProps {
  currentPath: string;
  siblings: DocLink[];
}

export function DocNavigation({ currentPath, siblings }: DocNavigationProps) {
  const { prev, next } = useMemo(() => {
    // Sort by order, then by filename
    const sorted = [...siblings].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.path.localeCompare(b.path);
    });

    const currentIndex = sorted.findIndex(s => s.path === currentPath);

    return {
      prev: currentIndex > 0 ? sorted[currentIndex - 1] : null,
      next: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null,
    };
  }, [currentPath, siblings]);

  if (!prev && !next) return null;

  return (
    <nav className="mt-12 pt-8 border-t border-[var(--border-default)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Previous */}
        {prev ? (
          <Link
            href={`/browse/${prev.path}`}
            className="group flex flex-col p-4 rounded-xl border border-[var(--border-default)] hover:border-[var(--accent)]/50 hover:bg-[var(--panel-soft)] transition-all"
          >
            <span className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              이전
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
              {prev.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {/* Next */}
        {next ? (
          <Link
            href={`/browse/${next.path}`}
            className="group flex flex-col p-4 rounded-xl border border-[var(--border-default)] hover:border-[var(--accent)]/50 hover:bg-[var(--panel-soft)] transition-all text-right sm:items-end"
          >
            <span className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1 justify-end">
              다음
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
              {next.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}

// Table of Contents component
interface TableOfContentsProps {
  headings: { id: string; text: string; level: number }[];
  activeId?: string;
}

export function TableOfContents({ headings, activeId }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <nav className="space-y-1">
      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        목차
      </h4>
      <ul className="space-y-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`
                block text-xs py-1 transition-colors
                ${heading.level === 2 ? 'pl-0' : heading.level === 3 ? 'pl-3' : 'pl-6'}
                ${activeId === heading.id
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Document header with metadata
interface DocHeaderProps {
  title: string;
  description?: string;
  category?: string;
  icon?: string;
}

export function DocHeader({ title, description, category, icon }: DocHeaderProps) {
  const iconEmoji = getIconEmoji(icon);

  return (
    <header className="mb-8 pb-6 border-b border-[var(--border-default)]">
      {category && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{iconEmoji}</span>
          <span className="text-xs font-medium text-[var(--accent)] uppercase tracking-wider">
            {category}
          </span>
        </div>
      )}
      <h1 className="text-2xl lg:text-4xl font-display font-bold text-[var(--text-primary)] mb-3">
        {title}
      </h1>
      {description && (
        <p className="text-sm lg:text-base text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      )}
    </header>
  );
}

function getIconEmoji(icon?: string): string {
  if (!icon) return '📄';
  const icons: Record<string, string> = {
    book: '📖',
    code: '💻',
    database: '🗄️',
    wires: '🔌',
    rocket: '🚀',
    gear: '⚙️',
    lock: '🔒',
    globe: '🌐',
    zap: '⚡',
    check: '✅',
    folder: '📁',
    file: '📄',
    warning: '⚠️',
    info: 'ℹ️',
    tip: '💡',
  };
  return icons[icon] || '📄';
}
