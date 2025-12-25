'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { DocsLayout } from '@/components/layout';
import { Card, AnimatedCard, Chip, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import type { DocMeta } from '@/lib/mdx';

interface HomePageClientProps {
  docs: DocMeta[];
  repoName?: string;
  repoDescription?: string;
}

export function HomePageClient({ docs, repoName = 'Repository', repoDescription }: HomePageClientProps) {
  return (
    <DocsLayout docs={docs}>
      <div className="space-y-8">
        {/* Hero */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
          className="py-4"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
            className="flex flex-wrap items-center gap-2"
          >
            <Chip variant="accent">RepoTutor</Chip>
            <Chip>AI-Powered</Chip>
          </motion.div>

          <motion.h1
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            className="mt-6 text-display-lg text-[var(--text-primary)]"
          >
            {repoName}
          </motion.h1>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            className="mt-4 text-body-lg text-[var(--text-secondary)] max-w-2xl"
          >
            {repoDescription || 'Intelligent documentation system for code exploration. Browse source files, ask questions, and get AI-generated insights.'}
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              href="/browse"
              className="btn btn-primary px-5 py-2.5"
            >
              Browse Files
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link
              href="/getting-started"
              className="btn btn-secondary px-5 py-2.5"
            >
              Documentation
            </Link>
          </motion.div>
        </motion.div>

        {/* Key Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon="folder"
            title="File Browser"
            description="Navigate the entire codebase with syntax-highlighted file viewing."
          />
          <FeatureCard
            icon="search"
            title="Smart Search"
            description="Full-text search across all files. Find anything instantly."
          />
          <FeatureCard
            icon="spark"
            title="AI Assistant"
            description="Ask questions and get intelligent answers about the code."
          />
        </div>

        {/* How It Works */}
        <Card padding="lg">
          <h2 className="text-heading text-[var(--text-primary)] mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Step number={1} title="Browse the Code">
              Navigate through the file tree, open any file to see syntax-highlighted source code.
            </Step>
            <Step number={2} title="Search Everything">
              Use the search to find definitions, usages, and patterns across all files.
            </Step>
            <Step number={3} title="Ask Questions">
              Open the AI chat panel and ask about architecture or specific functions.
            </Step>
            <Step number={4} title="Generate Docs">
              Get AI-generated documentation for any file or module on demand.
            </Step>
          </div>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/browse" className="group">
            <Card hover className="h-full">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
                  <Icon name="folder" className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="text-body-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    Source Code
                  </h3>
                  <p className="mt-1 text-caption text-[var(--text-secondary)]">
                    Browse all files and directories in the repository
                  </p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/overview" className="group">
            <Card hover className="h-full">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)]">
                  <Icon name="book" className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <div>
                  <h3 className="text-body-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    Documentation
                  </h3>
                  <p className="mt-1 text-caption text-[var(--text-secondary)]">
                    Read the project documentation and guides
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </DocsLayout>
  );
}

function FeatureCard({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <AnimatedCard hover>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
          <Icon name={icon} className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <h3 className="text-body-lg font-medium text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 text-caption text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
    </AnimatedCard>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white text-xs font-semibold">
        {number}
      </div>
      <div>
        <div className="font-medium text-[var(--text-primary)]">{title}</div>
        <div className="text-caption text-[var(--text-secondary)] mt-1">{children}</div>
      </div>
    </div>
  );
}
