'use client';

import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Icon } from '../ui/Icon';

interface MermaidProps {
  code: string;
  title: string;
  isDark?: boolean;
}

export function Mermaid({ code, title, isDark = true }: MermaidProps) {
  const id = useId().replace(/:/g, '_');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Mermaid colors based on theme
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
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      themeVariables: {
        background: 'transparent',
        primaryColor: colors.nodeFill,
        primaryTextColor: colors.text,
        primaryBorderColor: colors.nodeStroke,
        lineColor: colors.line,
        textColor: colors.text,
        tertiaryColor: 'rgba(0,0,0,0)',
        nodeBorder: colors.nodeStroke,
      },
      flowchart: { curve: 'basis', padding: 12 },
    });
  }, [isDark, colors.nodeFill, colors.text, colors.nodeStroke, colors.line]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const themeKey = isDark ? 'dark' : 'light';
        const { svg } = await mermaid.render(`m_${id}_${themeKey}`, code);
        if (cancelled) return;
        if (ref.current) {
          ref.current.innerHTML = svg;
          const el = ref.current.querySelector('svg');
          if (el) {
            el.setAttribute('width', '100%');
            el.style.maxWidth = '100%';
            el.style.filter = 'drop-shadow(0 14px 26px rgba(0,0,0,.45))';
          }
        }
      } catch (e) {
        if (!cancelled) setError(String((e as Error)?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, id, isDark]);

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] grid place-items-center">
            <Icon name="wires" className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
            <div className="text-xs text-[var(--text-tertiary)]">Mermaid 다이어그램</div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] tracking-[0.26em] uppercase text-[var(--text-tertiary)]">diagram</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
          <div className="text-xs font-mono text-[var(--error)]">렌더링 오류: {error}</div>
          <pre className="mt-3 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--text-primary)]">{code}</pre>
        </div>
      ) : (
        <div ref={ref} className="mermaid-wrap overflow-x-auto" />
      )}
    </div>
  );
}
