export type Language = 'en' | 'ko' | 'ja' | 'zh';

export interface TranslationStore {
  language: Language;
  translations: Record<string, unknown>;
  loading: boolean;
  initialized: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  loadTranslations: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

export const DEFAULT_LANGUAGE: Language = 'en';
