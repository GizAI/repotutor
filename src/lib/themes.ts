/**
 * Obsidian Theme System
 * Supports: dark, light, system
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface Theme {
  id: ThemeMode;
  name: string;
  icon: 'moon' | 'sun' | 'monitor';
}

export const THEMES: Theme[] = [
  { id: 'dark', name: 'Dark', icon: 'moon' },
  { id: 'light', name: 'Light', icon: 'sun' },
  { id: 'system', name: 'System', icon: 'monitor' },
];

export const DEFAULT_THEME: ThemeMode = 'dark';

export function getThemeById(id: ThemeMode): Theme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

/**
 * Resolves 'system' theme to actual dark/light based on OS preference
 */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Storage key for persisting theme preference
 */
export const THEME_STORAGE_KEY = 'repotutor-theme';
