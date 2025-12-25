'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '../ui/Icon';
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
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto bg-[var(--bg-primary)] border-r border-[var(--border-default)] p-4 md:sticky md:top-16 md:z-0 md:h-[calc(100vh-64px)] md:w-64 md:border-r-0 md:bg-transparent"
          >
            {/* Mobile Header */}
            <div className="mb-4 flex items-center justify-between md:hidden">
              <span className="text-sm font-medium text-[var(--text-primary)]">Navigation</span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2">
                <Icon name="search" className="h-4 w-4 text-[var(--text-tertiary)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {filtered.map((section) => (
                <NavItem
                  key={section.slug}
                  section={section}
                  active={currentSlug === section.slug || (pathname === '/' && section.slug === 'getting-started')}
                  onClick={onClose}
                />
              ))}
            </nav>

            {/* Quick Links */}
            <div className="mt-6 pt-4 border-t border-[var(--border-default)]">
              <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-3">
                Quick Links
              </div>
              <div className="space-y-1">
                <a
                  href="https://reson.buzz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  Reson App
                </a>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]" />
                  GitHub
                </a>
              </div>
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
      className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
      }`}
    >
      <Icon
        name={section.icon as IconName}
        className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium block truncate">{section.title}</span>
      </div>
    </Link>
  );
}
