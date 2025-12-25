'use client';

import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import { useThemeContext } from '../layout/ThemeProvider';

interface MermaidClientProps {
  code: string;
}

export function MermaidClient({ code }: MermaidClientProps) {
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
