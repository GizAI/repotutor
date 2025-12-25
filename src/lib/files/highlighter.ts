/**
 * Syntax Highlighter using Shiki
 *
 * 코드에 구문 강조를 적용합니다.
 */

import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

// 지원 언어 목록 (Shiki bundled languages)
const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'markdown',
  'mdx',
  'css',
  'scss',
  'html',
  'yaml',
  'sql',
  'bash',
  'python',
  'go',
  'rust',
  'prisma',
  'dockerfile',
  'toml',
  'xml',
  'plaintext',
];

// Highlighter 초기화 (싱글톤)
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: SUPPORTED_LANGUAGES,
    });
  }
  return highlighterPromise;
}

export interface HighlightOptions {
  language?: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
}

export interface HighlightResult {
  html: string;
  language: string;
  theme: string;
}

// 코드 구문 강조
export async function highlightCode(
  code: string,
  options: HighlightOptions = {}
): Promise<HighlightResult> {
  const {
    language = 'plaintext',
    theme = 'dark',
    showLineNumbers = true,
  } = options;

  const highlighter = await getHighlighter();
  const themeId = theme === 'dark' ? 'github-dark' : 'github-light';

  // 지원되지 않는 언어는 plaintext로 폴백
  const lang = SUPPORTED_LANGUAGES.includes(language as BundledLanguage)
    ? (language as BundledLanguage)
    : 'plaintext';

  const html = highlighter.codeToHtml(code, {
    lang,
    theme: themeId,
  });

  return {
    html,
    language: lang,
    theme: themeId,
  };
}

// 언어 지원 여부 확인
export function isLanguageSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(language as BundledLanguage);
}

// 지원 언어 목록 반환
export function getSupportedLanguages(): string[] {
  return [...SUPPORTED_LANGUAGES];
}
