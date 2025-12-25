'use client';

import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import { useThemeContext } from '../layout/ThemeProvider';
import { THEMES } from '@/lib/themes';

interface MermaidClientProps {
  code: string;
}

export function MermaidClient({ code }: MermaidClientProps) {
  const id = useId().replace(/:/g, '_');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { themeId } = useThemeContext();
  const tokens = THEMES[themeId] ?? THEMES.noir;

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      fontFamily: 'Azeret Mono, monospace',
      themeVariables: {
        background: 'transparent',
        primaryColor: tokens.mermaidNodeFill,
        primaryTextColor: tokens.mermaidText,
        primaryBorderColor: tokens.mermaidNodeStroke,
        lineColor: tokens.mermaidLine,
        textColor: tokens.mermaidText,
      },
      flowchart: { curve: 'basis', padding: 12 },
    });
  }, [themeId, tokens]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { svg } = await mermaid.render(`m_${id}_${themeId}`, code);
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
  }, [code, id, themeId]);

  return (
    <div className="my-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/55 p-4 backdrop-blur overflow-x-auto">
      {error ? (
        <div className="text-xs text-[var(--danger)]">다이어그램 오류: {error}</div>
      ) : (
        <div ref={ref} className="mermaid-wrap" />
      )}
    </div>
  );
}
