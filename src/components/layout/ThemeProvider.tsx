'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTheme } from '@/lib/hooks/useTheme';
import { THEMES, type Theme } from '@/lib/themes';

interface ThemeContextType {
  themeId: string;
  theme: Theme;
  setTheme: (id: 'noir' | 'paper') => void;
  toggleTheme: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeState = useTheme();

  return (
    <ThemeContext.Provider value={themeState}>
      <div data-theme={themeState.themeId} className="min-h-screen text-[var(--ink)]">
        <style>{`
          [data-theme='noir'] {
            --bg0: ${THEMES.noir.bg0};
            --bg1: ${THEMES.noir.bg1};
            --panel: ${THEMES.noir.panel};
            --panel-soft: ${THEMES.noir.panelSoft};
            --line: ${THEMES.noir.line};
            --ink: ${THEMES.noir.ink};
            --muted: ${THEMES.noir.muted};
            --accent: ${THEMES.noir.accent};
            --accent2: ${THEMES.noir.accent2};
            --danger: ${THEMES.noir.danger};
            --shadow: ${THEMES.noir.shadow};
          }
          [data-theme='paper'] {
            --bg0: ${THEMES.paper.bg0};
            --bg1: ${THEMES.paper.bg1};
            --panel: ${THEMES.paper.panel};
            --panel-soft: ${THEMES.paper.panelSoft};
            --line: ${THEMES.paper.line};
            --ink: ${THEMES.paper.ink};
            --muted: ${THEMES.paper.muted};
            --accent: ${THEMES.paper.accent};
            --accent2: ${THEMES.paper.accent2};
            --danger: ${THEMES.paper.danger};
            --shadow: ${THEMES.paper.shadow};
          }
        `}</style>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
