'use client';

import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { DocMeta } from '@/lib/mdx';

interface DocsLayoutProps {
  children: React.ReactNode;
  docs?: DocMeta[];
}

export function DocsLayout({ children, docs = [] }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[320px_1fr]">
        {/* Desktop Sidebar - Always visible */}
        <div className="hidden md:block">
          <Sidebar isOpen={true} docs={docs} />
        </div>

        {/* Mobile Sidebar - Toggleable */}
        <div className="md:hidden">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} docs={docs} />
        </div>

        {/* Main Content */}
        <main className="min-w-0 pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}
