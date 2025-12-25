'use client';

import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Icon } from '../ui/Icon';
import { THEMES } from '@/lib/themes';

interface MermaidProps {
  code: string;
  title: string;
  themeId: string;
}

export function Mermaid({ code, title, themeId }: MermaidProps) {
  const id = useId().replace(/:/g, '_');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const tokens = THEMES[themeId] ?? THEMES.noir;

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      fontFamily: 'Azeret Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      themeVariables: {
        background: 'transparent',
        primaryColor: tokens.mermaidNodeFill,
        primaryTextColor: tokens.mermaidText,
        primaryBorderColor: tokens.mermaidNodeStroke,
        lineColor: tokens.mermaidLine,
        textColor: tokens.mermaidText,
        tertiaryColor: 'rgba(0,0,0,0)',
        nodeBorder: tokens.mermaidNodeStroke,
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
  }, [code, id, themeId]);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/55 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] grid place-items-center">
            <Icon name="wires" className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-[var(--ink)]">{title}</div>
            <div className="text-xs text-[var(--muted)]">Mermaid 다이어그램</div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] tracking-[0.26em] uppercase text-[var(--muted)]">diagram</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent2)]" />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg1)] p-3">
          <div className="text-xs font-mono text-[var(--danger)]">렌더링 오류: {error}</div>
          <pre className="mt-3 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-[var(--ink)]">{code}</pre>
        </div>
      ) : (
        <div ref={ref} className="mermaid-wrap overflow-x-auto" />
      )}
    </div>
  );
}
