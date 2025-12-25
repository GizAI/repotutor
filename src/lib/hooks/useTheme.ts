'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type ThemeMode,
  type ResolvedTheme,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  resolveTheme,
} from '../themes';

interface UseThemeReturn {
  /** Current theme mode (dark/light/system) */
  themeMode: ThemeMode;
  /** Resolved theme for rendering (dark/light) */
  resolvedTheme: ResolvedTheme;
  /** Set theme mode */
  setTheme: (mode: ThemeMode) => void;
  /** Cycle through themes: dark -> light -> system -> dark */
  cycleTheme: () => void;
  /** Whether the component has mounted (for SSR) */
  mounted: boolean;
  /** Whether system prefers dark mode */
  systemPrefersDark: boolean;
}

export function useTheme(): UseThemeReturn {
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  // Initialize from localStorage and listen for system preference
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Get stored preference
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (stored && ['dark', 'light', 'system'].includes(stored)) {
      setThemeMode(stored);
    }

    // Get system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);

    // Listen for system preference changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    setMounted(true);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const resolved = resolveTheme(themeMode, systemPrefersDark);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [themeMode, systemPrefersDark, mounted]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['dark', 'light', 'system'];
    const currentIndex = order.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  }, [themeMode, setTheme]);

  const resolvedTheme = resolveTheme(themeMode, systemPrefersDark);

  return {
    themeMode,
    resolvedTheme,
    setTheme,
    cycleTheme,
    mounted,
    systemPrefersDark,
  };
}
