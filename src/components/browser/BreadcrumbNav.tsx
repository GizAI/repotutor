'use client';

import Link from 'next/link';

interface BreadcrumbNavProps {
  path: string;
  repoName?: string;
}

export function BreadcrumbNav({ path, repoName = 'Repository' }: BreadcrumbNavProps) {
  const segments = path ? path.split('/').filter(Boolean) : [];

  return (
    <nav className="flex items-center gap-1 text-xs lg:text-sm font-mono overflow-x-auto scrollbar-thin pb-1">
      {/* Root link */}
      <Link
        href="/browse"
        className="shrink-0 px-1.5 lg:px-2 py-1 rounded-md text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors whitespace-nowrap"
      >
        {repoName}
      </Link>

      {/* Path segments */}
      {segments.map((segment, index) => {
        const segmentPath = segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;

        return (
          <span
            key={segmentPath}
            className="flex items-center gap-1 shrink-0"
          >
            <span className="text-[var(--muted)]">/</span>
            {isLast ? (
              <span className="px-1.5 lg:px-2 py-1 text-[var(--ink)] whitespace-nowrap">
                {segment}
              </span>
            ) : (
              <Link
                href={`/browse/${segmentPath}`}
                className="px-1.5 lg:px-2 py-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg1)] transition-colors whitespace-nowrap"
              >
                {segment}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
