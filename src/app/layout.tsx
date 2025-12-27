import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider, Background, GlobalProviders } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Giz Code - 코드베이스 탐색 & AI 가이드',
  description: '리포지토리 구조를 탐색하고, AI와 함께 코드를 이해하세요.',
  keywords: ['Giz Code', 'Code Explorer', 'AI', '코드 분석', '개발 가이드'],
};

// Viewport with interactive-widget=resizes-visual (default: fixed toolbar mode)
// Can be dynamically changed to resizes-content when auto-resize is enabled
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-visual',
};

// Inline script to prevent theme flash - runs before React hydration
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('repotutor-theme');
    var theme = 'dark';
    if (stored === 'light') {
      theme = 'light';
    } else if (stored === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <Background />
          <GlobalProviders>
            {children}
          </GlobalProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
