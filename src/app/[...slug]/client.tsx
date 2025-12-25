'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MDXProvider } from '@mdx-js/react';
import { DocsLayout } from '@/components/layout';
import { Card, Chip } from '@/components/ui';
import { mdxComponents } from '@/components/mdx';
import type { Doc, DocMeta } from '@/lib/mdx';

interface DocPageClientProps {
  doc: Doc;
  adjacent: { prev: DocMeta | null; next: DocMeta | null };
  docs: DocMeta[];
  children: ReactNode;
}

export function DocPageClient({ doc, adjacent, docs, children }: DocPageClientProps) {
  return (
    <DocsLayout docs={docs}>
      <article className="space-y-8">
        {/* Hero */}
        <Card glow className="p-6 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {doc.category && <Chip variant="accent">{doc.category}</Chip>}
            <h1 className="mt-4 font-display text-3xl sm:text-4xl text-[var(--ink)]">
              {doc.title}
            </h1>
            {doc.description && (
              <p className="mt-3 text-sm text-[var(--muted)] font-body max-w-2xl">
                {doc.description}
              </p>
            )}
          </motion.div>
        </Card>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="prose-custom"
        >
          <MDXProvider components={mdxComponents}>
            {children}
          </MDXProvider>
        </motion.div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8 border-t border-[var(--line)]">
          {adjacent.prev ? (
            <Link
              href={`/${adjacent.prev.slug}`}
              className="group rounded-xl border border-[var(--line)] bg-[var(--panel)]/50 p-4 hover:border-[var(--accent)]/30 transition-colors"
            >
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">← 이전</div>
              <div className="text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                {adjacent.prev.title}
              </div>
            </Link>
          ) : (
            <div />
          )}
          {adjacent.next && (
            <Link
              href={`/${adjacent.next.slug}`}
              className="group rounded-xl border border-[var(--line)] bg-[var(--panel)]/50 p-4 hover:border-[var(--accent)]/30 transition-colors text-right"
            >
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1">다음 →</div>
              <div className="text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                {adjacent.next.title}
              </div>
            </Link>
          )}
        </div>
      </article>
    </DocsLayout>
  );
}
