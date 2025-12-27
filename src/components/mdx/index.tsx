'use client';

import { ReactNode, useEffect, useRef, useState, useId } from 'react';
import { motion } from 'framer-motion';
import mermaid from 'mermaid';
import {
  Sparkles, Zap, ShieldCheck, Network, Layers, Code2, BookOpen,
  Folder, FolderCode, Terminal as TerminalIcon, GitBranch, type LucideIcon
} from 'lucide-react';
import { useThemeContext } from '../layout/ThemeProvider';

const ICON_MAP: Record<string, LucideIcon> = {
  spark: Sparkles,
  wires: Network,
  shield: ShieldCheck,
  bolt: Zap,
  layers: Layers,
  code: Code2,
  book: BookOpen,
  folder: Folder,
  'folder-code': FolderCode,
  terminal: TerminalIcon,
  gitBranch: GitBranch,
};

// Heading components with anchor links
function createHeading(level: 1 | 2 | 3 | 4) {
  const sizes = {
    1: 'text-3xl sm:text-4xl mt-0 mb-6',
    2: 'text-2xl sm:text-3xl mt-12 mb-4',
    3: 'text-xl sm:text-2xl mt-8 mb-3',
    4: 'text-lg mt-6 mb-2',
  };

  return function Heading({ children, id }: { children: ReactNode; id?: string }) {
    const Tag = `h${level}` as const;
    return (
      <Tag id={id} className={`font-display text-[var(--text-primary)] scroll-mt-24 group ${sizes[level]}`}>
        {children}
        {id && (
          <a
            href={`#${id}`}
            className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity text-[var(--accent)]"
          >
            #
          </a>
        )}
      </Tag>
    );
  };
}

// Paragraph
function P({ children }: { children: ReactNode }) {
  return <p className="text-[var(--text-secondary)] font-body leading-relaxed mb-4">{children}</p>;
}

// Strong/Bold
function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-[var(--text-primary)] font-semibold">{children}</strong>;
}

// Links
function A({ href, children }: { href?: string; children: ReactNode }) {
  const isExternal = href?.startsWith('http');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline underline-offset-2 transition-colors"
    >
      {children}
      {isExternal && <span className="ml-1 text-xs">↗</span>}
    </a>
  );
}

// Lists
function Ul({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 my-4 ml-4">{children}</ul>;
}

function Ol({ children }: { children: ReactNode }) {
  return <ol className="space-y-2 my-4 ml-4 list-decimal">{children}</ol>;
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[var(--text-secondary)]">
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
      <span>{children}</span>
    </li>
  );
}

// Blockquote
function Blockquote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="border-l-3 border-[var(--accent)] pl-4 my-6 italic text-[var(--text-secondary)]">
      {children}
    </blockquote>
  );
}

// Horizontal Rule
function Hr() {
  return <hr className="border-none h-px bg-[var(--border-default)] my-8" />;
}

// Inline Code
function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-sm font-mono text-[var(--text-primary)]">
      {children}
    </code>
  );
}

// Code Block with syntax highlighting placeholder and Mermaid support
function Pre({ children }: { children: ReactNode }) {
  const codeElement = children as React.ReactElement<{ className?: string; children?: string }>;
  const className = codeElement?.props?.className || '';
  const content = codeElement?.props?.children || '';
  const language = className.replace('language-', '');

  // Check if it's a mermaid diagram
  if (language === 'mermaid') {
    return <MermaidDiagram code={String(content).trim()} />;
  }

  return (
    <div className="relative my-6 rounded-xl terminal overflow-hidden">
      {language && (
        <div className="absolute top-3 right-3 text-[10px] tracking-[0.2em] uppercase text-[var(--text-secondary)]">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm font-mono text-[var(--text-primary)] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

// Mermaid Diagram
function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/:/g, '_');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useThemeContext();

  // Mermaid colors based on theme
  const isDark = resolvedTheme === 'dark';
  const colors = {
    nodeFill: isDark ? '#1c1917' : '#f5f5f4',
    nodeStroke: isDark ? '#44403c' : '#d6d3d1',
    text: isDark ? '#e7e5e4' : '#1c1917',
    line: isDark ? '#57534e' : '#a8a29e',
  };

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      fontFamily: 'JetBrains Mono, monospace',
      themeVariables: {
        background: 'transparent',
        primaryColor: colors.nodeFill,
        primaryTextColor: colors.text,
        primaryBorderColor: colors.nodeStroke,
        lineColor: colors.line,
        textColor: colors.text,
      },
      flowchart: { curve: 'basis', padding: 12 },
    });
  }, [resolvedTheme, colors.nodeFill, colors.text, colors.nodeStroke, colors.line]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { svg } = await mermaid.render(`m_${id}_${resolvedTheme}`, code);
        if (cancelled) return;
        if (ref.current) {
          ref.current.innerHTML = svg;
          const el = ref.current.querySelector('svg');
          if (el) {
            el.setAttribute('width', '100%');
            el.style.maxWidth = '100%';
          }
        }
      } catch (e) {
        if (!cancelled) setError(String((e as Error)?.message ?? e));
      }
    })();

    return () => { cancelled = true; };
  }, [code, id, resolvedTheme]);

  return (
    <div className="my-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 overflow-x-auto">
      {error ? (
        <div className="text-xs text-[var(--error)]">다이어그램 오류: {error}</div>
      ) : (
        <div ref={ref} className="mermaid-wrap" />
      )}
    </div>
  );
}

// Custom Components for MDX

// Card component
export function Card({ children, glow }: { children: ReactNode; glow?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/70 p-5 my-6 backdrop-blur-md shadow-[0_0_0_1px_rgba(0,0,0,.35),0_40px_120px_var(--shadow-lg)] ${glow ? 'overflow-hidden' : ''}`}
    >
      {glow && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-70 [mask-image:radial-gradient(120px_120px_at_20%_10%,black,transparent)]">
          <div className="h-full w-full rounded-2xl bg-[conic-gradient(from_120deg_at_20%_10%,var(--accent),transparent_20%,var(--accent-hover),transparent_60%,var(--accent))]" />
        </div>
      )}
      <div className="relative">{children}</div>
    </motion.div>
  );
}

// Callout/Alert component
export function Callout({ type = 'info', title, children }: { type?: 'info' | 'warning' | 'tip'; title?: string; children: ReactNode }) {
  const styles = {
    info: 'border-[var(--accent)]/30 bg-[var(--accent)]/5',
    warning: 'border-[var(--accent-hover)]/30 bg-[var(--accent-hover)]/5',
    tip: 'border-green-500/30 bg-green-500/5',
  };
  const icons: Record<string, LucideIcon> = {
    info: Sparkles,
    warning: Zap,
    tip: ShieldCheck,
  };

  const IconComponent = icons[type];

  return (
    <div className={`my-6 rounded-xl border ${styles[type]} p-4`}>
      <div className="flex items-start gap-3">
        <IconComponent className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
        <div>
          {title && <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</div>}
          <div className="text-[11px] text-[var(--text-secondary)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Grid component for layouts
export function Grid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };
  return <div className={`grid grid-cols-1 ${gridCols[cols]} gap-4 my-6`}>{children}</div>;
}

// Feature card for grid items
export function Feature({ icon, title, children }: { icon?: string; title: string; children: ReactNode }) {
  const IconComponent = icon ? ICON_MAP[icon] : null;
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]/70 p-4">
      <div className="flex items-center gap-2 mb-2">
        {IconComponent && <IconComponent className="h-4 w-4 text-[var(--accent)]" />}
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
      </div>
      <div className="text-[11px] text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}

// Terminal/Code block with title
export function Terminal({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6 rounded-xl terminal p-4">
      {title && (
        <div className="mb-3 text-[10px] tracking-[0.26em] uppercase text-[var(--text-secondary)]">{title}</div>
      )}
      <pre className="overflow-auto text-xs text-[var(--text-primary)] font-mono leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

// Chip/Badge
export function Chip({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'accent' }) {
  const styles = {
    default: 'border-[var(--border-default)] bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)]',
    accent: 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] tracking-[0.24em] uppercase ${styles[variant]}`}>
      {children}
    </span>
  );
}

// Steps component for tutorials
export function Steps({ children }: { children: ReactNode }) {
  return <div className="my-6 space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-default)]">{children}</div>;
}

export function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 relative">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold z-10">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</div>
        <div className="text-[11px] text-[var(--text-secondary)]">{children}</div>
      </div>
    </div>
  );
}

// Import visualizations
import {
  ArchitectureDiagram,
  FlowDiagram,
  ComparisonTable,
  StatsGrid,
  Timeline,
  Tabs,
  Accordion,
  InteractiveCode,
} from './visualizations';

// Export all components for MDX
export const mdxComponents = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  p: P,
  strong: Strong,
  a: A,
  ul: Ul,
  ol: Ol,
  li: Li,
  blockquote: Blockquote,
  hr: Hr,
  code: InlineCode,
  pre: Pre,
  // Custom components
  Card,
  Callout,
  Grid,
  Feature,
  Terminal,
  Chip,
  Steps,
  Step,
  // Visualizations
  ArchitectureDiagram,
  FlowDiagram,
  ComparisonTable,
  StatsGrid,
  Timeline,
  Tabs,
  Accordion,
  InteractiveCode,
};

// Re-export visualization components for direct imports
export {
  ArchitectureDiagram,
  FlowDiagram,
  ComparisonTable,
  StatsGrid,
  Timeline,
  Tabs,
  Accordion,
  InteractiveCode,
};
