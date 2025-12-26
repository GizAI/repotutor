'use client';

import { createContext, useContext } from 'react';
import type { FileTree as FileTreeType } from '@/lib/files/reader';

// Context to share file tree and current path with children
export interface BrowseContextType {
  entries: FileTreeType[] | null;
  currentPath: string;
}

export const BrowseContext = createContext<BrowseContextType>({ entries: null, currentPath: '' });

export function useBrowseContext() {
  return useContext(BrowseContext);
}
