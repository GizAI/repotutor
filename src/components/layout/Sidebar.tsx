'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '../ui/Icon';
import { Card } from '../ui/Card';
import type { DocMeta } from '@/lib/mdx';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  docs?: DocMeta[];
}

export function Sidebar({ isOpen = true, onClose, docs = [] }: SidebarProps) {
  const [search, setSearch] = useState('');
  const pathname = usePathname();
  const sections = docs;

  const filtered = search.trim()
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase())
      )
    : sections;

  const currentSlug = pathname.split('/').pop() || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 z-50 h-full w-80 overflow-y-auto bg-[var(--bg0)] p-4 md:sticky md:top-20 md:z-0 md:h-[calc(100vh-96px)] md:w-auto md:bg-transparent"
          >
            {/* Mobile Close */}
            <div className="mb-4 flex items-center justify-between md:hidden">
              <span className="font-display text-sm tracking-wide">Navigation</span>
              <button
                onClick={onClose}
                className="rounded-full border border-[var(--line)] bg-[var(--panel)] p-2"
              >
                <Icon name="close" className="h-4 w-4 text-[var(--muted)]" />
              </button>
            </div>

            <div className="space-y-4">
              <Card glow className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] tracking-[0.24em] uppercase text-[var(--muted)]">
                      Documentation
                    </span>
                    <div className="mt-2 text-sm font-semibold">Select a topic</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)] font-body">
                      Click any section to navigate
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="mt-4">
                  <label className="text-[10px] tracking-[0.28em] uppercase text-[var(--muted)]">Search</label>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg1)] px-3 py-2">
                    <Icon name="search" className="h-4 w-4 text-[var(--muted)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search docs..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
                    />
                  </div>
                </div>

                {/* Navigation Items */}
                <nav className="mt-4 space-y-1">
                  {filtered.map((section) => (
                    <NavItem
                      key={section.slug}
                      section={section}
                      active={currentSlug === section.slug || (pathname === '/' && section.slug === 'welcome')}
                      onClick={onClose}
                    />
                  ))}
                </nav>
              </Card>

              {/* Quick Links */}
              <Card className="p-4">
                <div className="text-xs font-semibold mb-3">Quick Links</div>
                <div className="space-y-2 text-[11px] text-[var(--muted)]">
                  <a
                    href="https://github.com/GizAI/repotutor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-[var(--ink)] transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    GitHub
                  </a>
                  <a
                    href="https://github.com/GizAI/repotutor/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-[var(--ink)] transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent2)]" />
                    Report Issue
                  </a>
                </div>
              </Card>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

interface NavItemProps {
  section: DocMeta;
  active: boolean;
  onClick?: () => void;
}

function NavItem({ section, active, onClick }: NavItemProps) {
  return (
    <Link
      href={`/${section.slug}`}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
        active
          ? 'bg-[var(--panel)] text-[var(--ink)] shadow-[0_18px_50px_var(--shadow)]'
          : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)]/45'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition ${
          active ? 'bg-[var(--accent)]' : 'bg-[var(--line)] group-hover:bg-[var(--accent2)]'
        }`}
      />
      <div className="flex-1 min-w-0">
        <span className="text-xs tracking-wide block truncate">{section.title}</span>
        <span className="text-[10px] text-[var(--muted)] block truncate">{section.description}</span>
      </div>
      <Icon name={section.icon as IconName} className="h-4 w-4 shrink-0 opacity-50" />
    </Link>
  );
}
