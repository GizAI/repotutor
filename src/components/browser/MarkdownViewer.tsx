'use client';

import { useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import type { Components } from 'react-markdown';

// KaTeX CSS
import 'katex/dist/katex.min.css';

export interface DocFrontmatter {
  title?: string;
  description?: string;
  icon?: string;
  order?: number;
  category?: string;
}

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface MarkdownViewerProps {
  content: string;
  className?: string;
  onHeadingsExtracted?: (headings: HeadingItem[]) => void;
}

// Mermaid initialization
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'var(--font-mono)',
  });
}

// Parse frontmatter from content
export function parseFrontmatter(content: string): { frontmatter: DocFrontmatter; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterStr = match[1];
  const frontmatter: DocFrontmatter = {};

  frontmatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim();
      (frontmatter as Record<string, string | number>)[key.trim()] =
        key.trim() === 'order' ? parseInt(value, 10) : value;
    }
  });

  return {
    frontmatter,
    content: content.slice(match[0].length),
  };
}

// Convert MDX-like components to HTML
function preprocessMdxContent(content: string): string {
  let processed = content;

  // Convert <Callout> to blockquote with data attributes
  processed = processed.replace(
    /<Callout\s+type="(\w+)"(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/Callout>/g,
    (_, type, title, inner) => {
      const titlePart = title ? `**${title}**\n\n` : '';
      const icon = type === 'info' ? 'ℹ️' : type === 'warning' ? '⚠️' : type === 'tip' ? '💡' : type === 'error' ? '❌' : '📌';
      return `<div class="callout callout-${type}"><div class="callout-icon">${icon}</div><div class="callout-content">${titlePart}${inner.trim()}</div></div>`;
    }
  );

  // Convert <Steps> and <Step>
  processed = processed.replace(
    /<Steps>([\s\S]*?)<\/Steps>/g,
    (_, inner) => {
      let stepIndex = 0;
      const stepsContent = inner.replace(
        /<Step\s+title="([^"]*)">([\s\S]*?)<\/Step>/g,
        (_: string, title: string, stepInner: string) => {
          stepIndex++;
          return `<div class="step"><div class="step-number">${stepIndex}</div><div class="step-content"><div class="step-title">${title}</div>${stepInner.trim()}</div></div>`;
        }
      );
      return `<div class="steps">${stepsContent}</div>`;
    }
  );

  // Convert <Grid> and <Feature>
  processed = processed.replace(
    /<Grid\s+cols=\{(\d+)\}>([\s\S]*?)<\/Grid>/g,
    (_, cols, inner) => {
      const gridContent = inner.replace(
        /<Feature\s+icon="([^"]*)"(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/Feature>/g,
        (_: string, icon: string, title: string, featureInner: string) => {
          const iconEmoji = getIconEmoji(icon);
          return `<div class="feature"><div class="feature-icon">${iconEmoji}</div><div class="feature-title">${title || ''}</div><div class="feature-desc">${featureInner.trim()}</div></div>`;
        }
      );
      return `<div class="grid grid-cols-${cols}">${gridContent}</div>`;
    }
  );

  return processed;
}

function getIconEmoji(icon: string): string {
  const icons: Record<string, string> = {
    code: '💻',
    database: '🗄️',
    wires: '🔌',
    book: '📖',
    rocket: '🚀',
    gear: '⚙️',
    lock: '🔒',
    globe: '🌐',
    zap: '⚡',
    check: '✅',
  };
  return icons[icon] || '📦';
}

// Extract headings from content
function extractHeadings(content: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const regex = /^(#{2,4})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '');
    headings.push({ id, text, level });
  }

  return headings;
}

export function MarkdownViewer({ content, className = '', onHeadingsExtracted }: MarkdownViewerProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Parse and preprocess content
  const { processedContent, headings } = useMemo(() => {
    const { content: mainContent } = parseFrontmatter(content);
    const processedContent = preprocessMdxContent(mainContent);
    const headings = extractHeadings(mainContent);
    return { processedContent, headings };
  }, [content]);

  // Notify parent about headings
  useEffect(() => {
    if (onHeadingsExtracted) {
      onHeadingsExtracted(headings);
    }
  }, [headings, onHeadingsExtracted]);

  // Render mermaid diagrams after component mounts
  useEffect(() => {
    if (mermaidRef.current) {
      const mermaidBlocks = mermaidRef.current.querySelectorAll('.mermaid-block');
      mermaidBlocks.forEach(async (block, index) => {
        const code = block.getAttribute('data-code');
        if (code) {
          try {
            const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, code);
            block.innerHTML = svg;
            block.classList.add('mermaid-rendered');
          } catch (err) {
            console.error('Mermaid render error:', err);
            block.innerHTML = `<pre class="text-red-400 text-xs">${code}</pre>`;
          }
        }
      });
    }
  }, [processedContent]);

  const components: Components = {
    // Headings with anchor links
    h1: ({ children }) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '');
      return (
        <h1 id={id} className="group text-2xl lg:text-3xl font-display font-bold text-[var(--text-primary)] mt-8 mb-4 pb-2 border-b border-[var(--border-default)]">
          <a href={`#${id}`} className="no-underline hover:text-[var(--accent)]">{children}</a>
        </h1>
      );
    },
    h2: ({ children }) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '');
      return (
        <h2 id={id} className="group text-xl lg:text-2xl font-display font-semibold text-[var(--text-primary)] mt-8 mb-3 pb-2 border-b border-[var(--border-default)]">
          <a href={`#${id}`} className="no-underline hover:text-[var(--accent)]">{children}</a>
        </h2>
      );
    },
    h3: ({ children }) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '');
      return (
        <h3 id={id} className="group text-lg lg:text-xl font-display font-semibold text-[var(--text-primary)] mt-6 mb-2">
          <a href={`#${id}`} className="no-underline hover:text-[var(--accent)]">{children}</a>
        </h3>
      );
    },
    h4: ({ children }) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/(^-|-$)/g, '');
      return (
        <h4 id={id} className="text-base lg:text-lg font-display font-medium text-[var(--text-primary)] mt-4 mb-2">
          <a href={`#${id}`} className="no-underline hover:text-[var(--accent)]">{children}</a>
        </h4>
      );
    },

    // Paragraphs
    p: ({ children }) => (
      <p className="text-sm lg:text-base text-[var(--text-primary)] leading-relaxed mb-4">
        {children}
      </p>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline underline-offset-2 transition-colors"
      >
        {children}
      </a>
    ),

    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-inside space-y-1 mb-4 text-sm lg:text-base text-[var(--text-primary)] ml-4">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-1 mb-4 text-sm lg:text-base text-[var(--text-primary)] ml-4">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">{children}</li>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[var(--accent)] pl-4 py-2 my-4 bg-[var(--panel-soft)] rounded-r-lg italic text-[var(--text-secondary)]">
        {children}
      </blockquote>
    ),

    // Code blocks
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      // Check if this is inside a pre tag (block code) vs inline
      const isInlineCode = !props.node?.position ||
        (props.node?.position?.start?.line === props.node?.position?.end?.line &&
         !codeString.includes('\n'));

      // Mermaid diagram
      if (language === 'mermaid') {
        return (
          <div
            className="mermaid-block my-4 lg:my-6 p-3 lg:p-4 bg-[var(--bg-tertiary)] rounded-lg lg:rounded-xl border border-[var(--border-default)] overflow-x-auto"
            data-code={codeString}
          />
        );
      }

      // Inline code (single line, no language class, not multiline)
      if (isInlineCode && !className) {
        return (
          <code className="px-1 lg:px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent)] text-[0.85em] lg:text-[0.9em] font-mono break-all">
            {children}
          </code>
        );
      }

      // Code block (with or without language)
      return (
        <div className="relative group my-3 lg:my-4 -mx-4 sm:mx-0">
          {language && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] lg:text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-70 z-10">
              {language}
            </div>
          )}
          <pre className="p-3 lg:p-4 bg-[var(--bg-tertiary)] sm:rounded-lg lg:rounded-xl border-y sm:border border-[var(--border-default)] overflow-x-auto scrollbar-thin">
            <code className="text-[10px] sm:text-[11px] lg:text-sm font-mono text-[var(--text-primary)] leading-snug whitespace-pre block">
              {children}
            </code>
          </pre>
        </div>
      );
    },

    // Pre wrapper - just pass through, code handles all styling
    pre: ({ children }) => <>{children}</>,

    // Tables
    table: ({ children }) => (
      <div className="my-4 lg:my-6 -mx-4 sm:mx-0 overflow-x-auto scrollbar-thin">
        <div className="inline-block min-w-full sm:rounded-lg lg:rounded-xl border-y sm:border border-[var(--border-default)]">
          <table className="min-w-full text-xs lg:text-sm">
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-[var(--border-default)]">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-[var(--bg-tertiary)] transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-3 lg:px-4 py-2 lg:py-3 text-left font-semibold text-[var(--text-primary)] whitespace-nowrap">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 lg:px-4 py-2 lg:py-3 text-[var(--text-primary)]">{children}</td>
    ),

    // Horizontal rule
    hr: () => (
      <hr className="my-8 border-t border-[var(--border-default)]" />
    ),

    // Images
    img: ({ src, alt }) => (
      <figure className="my-6">
        <img
          src={src}
          alt={alt || ''}
          className="rounded-xl border border-[var(--border-default)] max-w-full h-auto"
          loading="lazy"
        />
        {alt && (
          <figcaption className="mt-2 text-center text-xs text-[var(--text-secondary)]">
            {alt}
          </figcaption>
        )}
      </figure>
    ),

    // Strong and emphasis
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    // Strikethrough
    del: ({ children }) => (
      <del className="line-through text-[var(--text-secondary)]">{children}</del>
    ),

    // Custom div handling for our preprocessed components
    div: ({ className, children, ...props }) => {
      // Callout
      if (className?.startsWith('callout')) {
        const type = className.replace('callout callout-', '');
        const bgColor = type === 'info' ? 'bg-blue-500/10 border-blue-500/30' :
                       type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                       type === 'tip' ? 'bg-green-500/10 border-green-500/30' :
                       type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                       'bg-[var(--panel-soft)] border-[var(--border-default)]';
        return (
          <div className={`my-4 p-4 rounded-lg border ${bgColor} flex gap-3`}>
            {children}
          </div>
        );
      }

      // Callout icon
      if (className === 'callout-icon') {
        return <div className="text-xl shrink-0">{children}</div>;
      }

      // Callout content
      if (className === 'callout-content') {
        return <div className="text-sm text-[var(--text-primary)] flex-1 min-w-0 [&>p:last-child]:mb-0">{children}</div>;
      }

      // Steps container
      if (className === 'steps') {
        return <div className="my-6 space-y-4">{children}</div>;
      }

      // Individual step
      if (className === 'step') {
        return (
          <div className="flex gap-4 p-4 rounded-lg bg-[var(--panel-soft)] border border-[var(--border-default)]">
            {children}
          </div>
        );
      }

      // Step number
      if (className === 'step-number') {
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--bg-primary)] flex items-center justify-center font-bold text-sm shrink-0">
            {children}
          </div>
        );
      }

      // Step content
      if (className === 'step-content') {
        return <div className="flex-1 min-w-0 [&>p:last-child]:mb-0">{children}</div>;
      }

      // Step title
      if (className === 'step-title') {
        return <div className="font-semibold text-[var(--text-primary)] mb-2">{children}</div>;
      }

      // Grid
      if (className?.startsWith('grid grid-cols-')) {
        const cols = className.split('-').pop();
        return (
          <div className={`my-4 grid gap-3 grid-cols-1 sm:grid-cols-2 ${cols === '3' ? 'lg:grid-cols-3' : ''}`}>
            {children}
          </div>
        );
      }

      // Feature card
      if (className === 'feature') {
        return (
          <div className="p-4 rounded-lg bg-[var(--panel-soft)] border border-[var(--border-default)] hover:border-[var(--accent)]/50 transition-colors">
            {children}
          </div>
        );
      }

      // Feature icon
      if (className === 'feature-icon') {
        return <div className="text-2xl mb-2">{children}</div>;
      }

      // Feature title
      if (className === 'feature-title') {
        return <div className="font-semibold text-[var(--text-primary)] mb-1">{children}</div>;
      }

      // Feature description
      if (className === 'feature-desc') {
        return <div className="text-xs text-[var(--text-secondary)]">{children}</div>;
      }

      return <div className={className} {...props}>{children}</div>;
    },
  };

  return (
    <div ref={mermaidRef} className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
