export interface Theme {
  id: string;
  name: string;
  bg0: string;
  bg1: string;
  panel: string;
  panelSoft: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  danger: string;
  shadow: string;
  mermaidLine: string;
  mermaidNodeFill: string;
  mermaidNodeStroke: string;
  mermaidText: string;
}

export const THEMES: Record<string, Theme> = {
  noir: {
    id: 'noir',
    name: 'Noir Lime',
    bg0: '#070A09',
    bg1: '#0E1411',
    panel: 'rgba(16, 22, 19, 0.86)',
    panelSoft: 'rgba(16, 22, 19, 0.55)',
    line: 'rgba(255,255,255,0.10)',
    ink: 'rgba(241, 248, 244, 0.95)',
    muted: 'rgba(201, 214, 207, 0.68)',
    accent: '#A9FF00',
    accent2: '#FF5A00',
    danger: '#FF3B3B',
    shadow: 'rgba(0,0,0,.55)',
    mermaidLine: '#A9FF00',
    mermaidNodeFill: 'rgba(16, 22, 19, 0.86)',
    mermaidNodeStroke: 'rgba(255,255,255,0.14)',
    mermaidText: 'rgba(241, 248, 244, 0.95)',
  },
  paper: {
    id: 'paper',
    name: 'Paper Terminal',
    bg0: '#FBF5E6',
    bg1: '#F2E8D2',
    panel: 'rgba(255, 255, 255, 0.72)',
    panelSoft: 'rgba(255, 255, 255, 0.55)',
    line: 'rgba(16, 22, 19, 0.18)',
    ink: 'rgba(16, 22, 19, 0.92)',
    muted: 'rgba(16, 22, 19, 0.60)',
    accent: '#0A7CFF',
    accent2: '#FF2D55',
    danger: '#C4161C',
    shadow: 'rgba(0,0,0,.18)',
    mermaidLine: '#0A7CFF',
    mermaidNodeFill: 'rgba(255, 255, 255, 0.72)',
    mermaidNodeStroke: 'rgba(16, 22, 19, 0.18)',
    mermaidText: 'rgba(16, 22, 19, 0.92)',
  },
};

export function getThemeCSS(theme: Theme): string {
  return `
    --bg0: ${theme.bg0};
    --bg1: ${theme.bg1};
    --panel: ${theme.panel};
    --panel-soft: ${theme.panelSoft};
    --line: ${theme.line};
    --ink: ${theme.ink};
    --muted: ${theme.muted};
    --accent: ${theme.accent};
    --accent2: ${theme.accent2};
    --danger: ${theme.danger};
    --shadow: ${theme.shadow};
  `;
}
