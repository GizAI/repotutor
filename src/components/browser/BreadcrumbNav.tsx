'use client';

import Link from 'next/link';

interface BreadcrumbNavProps {
  path: string;
  repoName?: string;
  onNavigate?: (path: string) => void; // Optional callback for client-side navigation
}

export function BreadcrumbNav({ path, repoName = 'Repository', onNavigate }: BreadcrumbNavProps) {
  const segments = path ? path.split('/').filter(Boolean) : [];

  const NavItem = ({ href, children, className }: { href: string; children: React.ReactNode; className: string }) => {
    if (onNavigate) {
      const browsePath = href.replace('/browse/', '').replace('/browse', '');
      return (
        <button onClick={() => onNavigate(browsePath)} className={className}>
          {children}
        </button>
      );
    }
    return <Link href={href} className={className}>{children}</Link>;
  };

  return (
    <nav className="flex items-center gap-1 text-xs lg:text-sm font-mono overflow-x-auto scrollbar-thin pb-1">
      {/* Root link */}
      <NavItem
        href="/browse"
        className="shrink-0 px-1.5 lg:px-2 py-1 rounded-md text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors whitespace-nowrap"
      >
        {repoName}
      </NavItem>

      {/* Path segments */}
      {segments.map((segment, index) => {
        const segmentPath = segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;

        return (
          <span
            key={segmentPath}
            className="flex items-center gap-1 shrink-0"
          >
            <span className="text-[var(--text-secondary)]">/</span>
            {isLast ? (
              <span className="px-1.5 lg:px-2 py-1 text-[var(--text-primary)] whitespace-nowrap">
                {segment}
              </span>
            ) : (
              <NavItem
                href={`/browse/${segmentPath}`}
                className="px-1.5 lg:px-2 py-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors whitespace-nowrap"
              >
                {segment}
              </NavItem>
            )}
          </span>
        );
      })}
    </nav>
  );
}
