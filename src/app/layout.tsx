import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider, Background } from '@/components/layout';

export const metadata: Metadata = {
  title: 'RepoTutor - AI-Powered Documentation',
  description: 'Transform any codebase into beautiful, interactive documentation with AI-powered analysis.',
  keywords: ['documentation', 'AI', 'code analysis', 'MDX', 'Mermaid', 'learning'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Background />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
