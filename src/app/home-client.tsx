'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { DocsLayout } from '@/components/layout';
import { Card, AnimatedCard, Chip, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui/Icon';
import type { DocMeta } from '@/lib/mdx';

interface HomePageClientProps {
  docs: DocMeta[];
}

export function HomePageClient({ docs }: HomePageClientProps) {
  return (
    <DocsLayout docs={docs}>
      <div className="space-y-10">
        {/* Hero */}
        <Card glow className="p-6 sm:p-8">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
              <div className="flex flex-wrap items-center gap-2">
                <Chip>AI-Powered</Chip>
                <Chip>MDX</Chip>
                <Chip>Mermaid</Chip>
                <Chip>Interactive</Chip>
              </div>
            </motion.div>

            <motion.h1
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="mt-5 font-display text-3xl sm:text-5xl leading-[1.04] text-[var(--ink)]"
            >
              RepoTutor
              <span className="block text-[var(--muted)] font-body text-lg sm:text-xl mt-3">
                Transform any codebase into beautiful, interactive documentation
              </span>
            </motion.h1>

            <motion.p
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="mt-4 text-sm text-[var(--muted)] font-body max-w-2xl"
            >
              Just add MDX files to <code className="bg-[var(--panel)] px-1.5 py-0.5 rounded text-[var(--accent)]">content/</code> folder.
              Mermaid diagrams, interactive components, and code highlighting are all auto-applied.
            </motion.p>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className="mt-6 flex flex-wrap gap-3"
            >
              <Link
                href="/welcome"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-5 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
              >
                Get Started
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/GizAI/repotutor"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/60 px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
              >
                GitHub
              </a>
            </motion.div>
          </motion.div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon="code"
            title="MDX Powered"
            description="Write in Markdown with React components inline."
          />
          <FeatureCard
            icon="wires"
            title="Auto Diagrams"
            description="Mermaid code blocks render as beautiful diagrams."
          />
          <FeatureCard
            icon="spark"
            title="Component Library"
            description="Card, Callout, Grid, Steps and more ready to use."
          />
        </div>

        {/* How it works */}
        <AnimatedCard>
          <h2 className="font-display text-xl text-[var(--ink)] mb-4">Quick Start</h2>
          <div className="space-y-4">
            <Step number={1} title="Initialize">
              <code className="text-[var(--accent)]">npx repotutor init</code> in your project
            </Step>
            <Step number={2} title="Add Content">
              Create MDX files in <code className="text-[var(--accent)]">content/</code> folder
            </Step>
            <Step number={3} title="Run">
              <code className="text-[var(--accent)]">npm run dev</code> and open localhost:3000
            </Step>
          </div>
        </AnimatedCard>

        {/* Example */}
        <AnimatedCard>
          <h2 className="font-display text-xl text-[var(--ink)] mb-4">Example MDX</h2>
          <div className="rounded-xl terminal p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-[var(--ink)]">{`---
title: Architecture
description: System overview
icon: spark
order: 1
---

# Architecture

\`\`\`mermaid
flowchart LR
  A[Client] --> B[API]
  B --> C[Database]
\`\`\`

<Callout type="tip" title="Tip">
  Mermaid blocks auto-render as diagrams!
</Callout>

<Grid cols={2}>
  <Feature icon="bolt" title="Fast">
    Built with Next.js 15 + Turbopack
  </Feature>
  <Feature icon="shield" title="Type Safe">
    Full TypeScript support
  </Feature>
</Grid>`}</pre>
          </div>
        </AnimatedCard>
      </div>
    </DocsLayout>
  );
}

function FeatureCard({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <AnimatedCard hover>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg1)]">
          <Icon name={icon} className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
          <p className="mt-1 text-[11px] text-[var(--muted)]">{description}</p>
        </div>
      </div>
    </AnimatedCard>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold">
        {number}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--ink)]">{title}</div>
        <div className="text-[11px] text-[var(--muted)] mt-1">{children}</div>
      </div>
    </div>
  );
}
