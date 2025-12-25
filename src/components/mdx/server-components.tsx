import { ReactNode } from 'react';
import { MermaidClient } from './MermaidClient';

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
      <Tag id={id} className={`font-display text-[var(--ink)] scroll-mt-24 group ${sizes[level]}`}>
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
  return <p className="text-[var(--muted)] font-body leading-relaxed mb-4">{children}</p>;
}

// Strong/Bold
function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-[var(--ink)] font-semibold">{children}</strong>;
}

// Links
function A({ href, children }: { href?: string; children: ReactNode }) {
  const isExternal = href?.startsWith('http');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-[var(--accent)] hover:text-[var(--accent2)] underline underline-offset-2 transition-colors"
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
    <li className="flex items-start gap-2 text-[var(--muted)]">
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
      <span>{children}</span>
    </li>
  );
}

// Blockquote
function Blockquote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="border-l-3 border-[var(--accent)] pl-4 my-6 italic text-[var(--muted)]">
      {children}
    </blockquote>
  );
}

// Horizontal Rule
function Hr() {
  return <hr className="border-none h-px bg-[var(--line)] my-8" />;
}

// Inline Code
function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="bg-[var(--panel)] border border-[var(--line)] rounded px-1.5 py-0.5 text-sm font-mono text-[var(--ink)]">
      {children}
    </code>
  );
}

// Code Block with Mermaid support
function Pre({ children }: { children: ReactNode }) {
  const codeElement = children as React.ReactElement;
  const className = codeElement?.props?.className || '';
  const content = codeElement?.props?.children || '';
  const language = className.replace('language-', '');

  // Render mermaid diagrams using client component
  if (language === 'mermaid') {
    return <MermaidClient code={String(content).trim()} />;
  }

  return (
    <div className="relative my-6 rounded-xl terminal overflow-hidden">
      {language && (
        <div className="absolute top-3 right-3 text-[10px] tracking-[0.2em] uppercase text-[var(--muted)]">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm font-mono text-[var(--ink)] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

// Card component (simplified - no motion)
function Card({ children, glow }: { children: ReactNode; glow?: boolean }) {
  return (
    <div
      className={`relative rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 my-6 backdrop-blur-md shadow-[0_0_0_1px_rgba(0,0,0,.35),0_40px_120px_var(--shadow)] ${glow ? 'overflow-hidden' : ''}`}
    >
      {glow && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-70 [mask-image:radial-gradient(120px_120px_at_20%_10%,black,transparent)]">
          <div className="h-full w-full rounded-2xl bg-[conic-gradient(from_120deg_at_20%_10%,var(--accent),transparent_20%,var(--accent2),transparent_60%,var(--accent))]" />
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

// Callout/Alert component (simplified - using emoji instead of Icon)
function Callout({ type = 'info', title, children }: { type?: 'info' | 'warning' | 'tip'; title?: string; children: ReactNode }) {
  const styles = {
    info: 'border-[var(--accent)]/30 bg-[var(--accent)]/5',
    warning: 'border-[var(--accent2)]/30 bg-[var(--accent2)]/5',
    tip: 'border-green-500/30 bg-green-500/5',
  };
  const icons: Record<string, string> = {
    info: '💡',
    warning: '⚠️',
    tip: '✅',
  };

  return (
    <div className={`my-6 rounded-xl border ${styles[type]} p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{icons[type]}</span>
        <div>
          {title && <div className="text-sm font-semibold text-[var(--ink)] mb-1">{title}</div>}
          <div className="text-[11px] text-[var(--muted)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Grid component for layouts
function Grid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };
  return <div className={`grid grid-cols-1 ${gridCols[cols]} gap-4 my-6`}>{children}</div>;
}

// Feature card for grid items (simplified - using emoji instead of Icon)
function Feature({ icon, title, children }: { icon?: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg1)]/70 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-sm font-semibold text-[var(--ink)]">{title}</span>
      </div>
      <div className="text-[11px] text-[var(--muted)]">{children}</div>
    </div>
  );
}

// Terminal/Code block with title
function Terminal({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6 rounded-xl terminal p-4">
      {title && (
        <div className="mb-3 text-[10px] tracking-[0.26em] uppercase text-[var(--muted)]">{title}</div>
      )}
      <pre className="overflow-auto text-xs text-[var(--ink)] font-mono leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

// Chip/Badge
function Chip({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'accent' }) {
  const styles = {
    default: 'border-[var(--line)] bg-[rgba(255,255,255,0.04)] text-[var(--muted)]',
    accent: 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] tracking-[0.24em] uppercase ${styles[variant]}`}>
      {children}
    </span>
  );
}

// Steps component for tutorials
function Steps({ children }: { children: ReactNode }) {
  return <div className="my-6 space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--line)]">{children}</div>;
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 relative">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold z-10">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <div className="text-sm font-semibold text-[var(--ink)] mb-1">{title}</div>
        <div className="text-[11px] text-[var(--muted)]">{children}</div>
      </div>
    </div>
  );
}

// Simplified visualization components for server rendering
function ArchitectureDiagram({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/55 p-6">
      <div className="text-center text-[var(--muted)]">{children}</div>
    </div>
  );
}

function FlowDiagram({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/55 p-6">
      <div className="text-center text-[var(--muted)]">{children}</div>
    </div>
  );
}

function ComparisonTable({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-sm text-[var(--muted)]">{children}</table>
    </div>
  );
}

function StatsGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">{children}</div>;
}

function Timeline({ children }: { children: ReactNode }) {
  return <div className="my-6 space-y-4">{children}</div>;
}

function Tabs({ children }: { children: ReactNode }) {
  return <div className="my-6">{children}</div>;
}

function Accordion({ children }: { children: ReactNode }) {
  return <div className="my-6 space-y-2">{children}</div>;
}

function InteractiveCode({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 rounded-xl terminal p-4">
      <pre className="text-xs text-[var(--ink)] font-mono">{children}</pre>
    </div>
  );
}

// Export all components for MDX
export const serverMdxComponents = {
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
  // Simplified visualizations
  ArchitectureDiagram,
  FlowDiagram,
  ComparisonTable,
  StatsGrid,
  Timeline,
  Tabs,
  Accordion,
  InteractiveCode,
};
