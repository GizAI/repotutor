'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language, TranslationStore, DEFAULT_LANGUAGE } from './types';

// Cache for loaded translations
const translationsCache: Record<Language, Record<string, unknown>> = {} as Record<Language, Record<string, unknown>>;

// Detect browser language
function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  const browserLang = navigator.language.split('-')[0];
  const supported: Language[] = ['en', 'ko', 'ja', 'zh'];

  if (supported.includes(browserLang as Language)) {
    return browserLang as Language;
  }

  return DEFAULT_LANGUAGE;
}

// Fetch translations from public folder
async function fetchTranslations(lang: Language): Promise<Record<string, unknown>> {
  // Return cached if available
  if (translationsCache[lang]) {
    return translationsCache[lang];
  }

  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) {
      console.warn(`Failed to load translations for ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
      if (lang !== DEFAULT_LANGUAGE) {
        return fetchTranslations(DEFAULT_LANGUAGE);
      }
      return {};
    }
    const data = await res.json();
    translationsCache[lang] = data;
    return data;
  } catch (error) {
    console.error(`Error loading translations for ${lang}:`, error);
    if (lang !== DEFAULT_LANGUAGE) {
      return fetchTranslations(DEFAULT_LANGUAGE);
    }
    return {};
  }
}

// Get nested value from object by dot-notation key
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const keys = key.split('.');
  let value: unknown = obj;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  return typeof value === 'string' ? value : undefined;
}

export const useTranslation = create<TranslationStore>()(
  persist(
    (set, get) => ({
      language: DEFAULT_LANGUAGE,
      translations: {},
      loading: false,
      initialized: false,

      setLanguage: async (lang: Language) => {
        const { loadTranslations } = get();
        set({ language: lang });
        await loadTranslations(lang);
      },

      loadTranslations: async (lang: Language) => {
        set({ loading: true });
        const translations = await fetchTranslations(lang);
        set({ translations, loading: false, initialized: true });
      },

      t: (key: string, params?: Record<string, string | number>): string => {
        const { translations } = get();
        let value = getNestedValue(translations as Record<string, unknown>, key);

        // Fallback to key if not found
        if (value === undefined) {
          return key;
        }

        // Replace parameters
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            value = value!.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }

        return value;
      },
    }),
    {
      name: 'giz-code-language',
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        // Load translations after hydration
        if (state) {
          const lang = state.language || detectBrowserLanguage();
          state.loadTranslations(lang);
        }
      },
    }
  )
);

// Hook to initialize translations on first render
export function useInitTranslations() {
  const { initialized, loading, language, loadTranslations } = useTranslation();

  if (!initialized && !loading && typeof window !== 'undefined') {
    loadTranslations(language);
  }
}

// Simple hook for components that just need t()
export function useT() {
  const t = useTranslation((state) => state.t);
  return { t };
}
