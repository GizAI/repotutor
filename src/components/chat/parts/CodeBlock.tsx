'use client';

import { useState, useCallback } from 'react';

const langColors: Record<string, string> = {
  typescript: '#3178c6', ts: '#3178c6', javascript: '#f7df1e', js: '#f7df1e',
  python: '#3776ab', py: '#3776ab', rust: '#dea584', go: '#00add8',
  java: '#ed8b00', kotlin: '#7f52ff', swift: '#f05138', c: '#555555',
  cpp: '#00599c', csharp: '#239120', bash: '#89e051', sh: '#89e051',
  json: '#cbcb41', yaml: '#cb171e', sql: '#f29111', html: '#e34c26',
  css: '#264de4', scss: '#cc6699', markdown: '#519aba', md: '#519aba',
};

export function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match?.[1] || '';
  const code = String(children).replace(/\n$/, '');

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // Inline code
  if (!match) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--accent)] font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-[var(--border-default)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColors[lang.toLowerCase()] || 'var(--text-secondary)' }} />
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase">{lang}</span>
        </div>
        <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          {copied ? (
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-[var(--bg-secondary)] text-[var(--text-primary)]">
        <code className="text-[12px] font-mono leading-relaxed" {...props}>{children}</code>
      </pre>
    </div>
  );
}
