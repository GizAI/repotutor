'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { THEMES, type Theme } from '../themes';

type ThemeId = 'noir' | 'paper';

export function useTheme() {
  const [themeId, setThemeId] = useState<ThemeId>('noir');
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const stored = localStorage.getItem('reson-docs-theme') as ThemeId | null;
    if (stored && THEMES[stored]) {
      setThemeId(stored);
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem('reson-docs-theme', id);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(themeId === 'noir' ? 'paper' : 'noir');
  }, [themeId, setTheme]);

  const theme: Theme = THEMES[themeId] ?? THEMES.noir;

  return {
    themeId,
    theme,
    setTheme,
    toggleTheme,
    mounted,
  };
}
