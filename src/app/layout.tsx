import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider, Background, GlobalProviders } from '@/components/layout';

export const metadata: Metadata = {
  title: 'RepoTutor - 코드베이스 탐색 & AI 가이드',
  description: '리포지토리 구조를 탐색하고, AI와 함께 코드를 이해하세요.',
  keywords: ['RepoTutor', 'Code Explorer', 'AI', '코드 분석', '개발 가이드'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
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
