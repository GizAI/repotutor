'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

interface FileTreeProps {
  entries: FileEntry[];
  basePath?: string;
  onNavigate?: () => void;
}

const STORAGE_KEY = 'filetree-expanded-paths';

// Helper to get all parent paths of a given path
function getParentPaths(path: string): string[] {
  const parts = path.split('/');
  const parents: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    parents.push(parts.slice(0, i).join('/'));
  }
  return parents;
}

// Load expanded paths from localStorage
function loadExpandedPaths(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {}
  return new Set();
}

// Save expanded paths to localStorage
function saveExpandedPaths(paths: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...paths]));
  } catch {}
}

export function FileTree({ entries, basePath = '/browse', onNavigate }: FileTreeProps) {
  const pathname = usePathname();

  // Extract current file path from pathname
  const currentPath = useMemo(() => {
    if (pathname.startsWith(basePath + '/')) {
      return pathname.slice(basePath.length + 1);
    }
    return '';
  }, [pathname, basePath]);

  // SSR-safe: 초기값은 빈 Set, useEffect에서 localStorage 로드
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // 마운트 시 localStorage에서 펼침 상태 로드 + 현재 경로 부모 폴더 펼침
  useEffect(() => {
    const saved = loadExpandedPaths();
    if (currentPath) {
      getParentPaths(currentPath).forEach((p) => saved.add(p));
    }
    setExpandedPaths(saved);
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // currentPath 변경 시 해당 파일의 부모 폴더들 자동 펼침
  useEffect(() => {
    if (mounted && currentPath) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        getParentPaths(currentPath).forEach((p) => next.add(p));
        saveExpandedPaths(next);
        return next;
      });
    }
  }, [currentPath, mounted]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      saveExpandedPaths(next);
      return next;
    });
  }, []);

  return (
    <div className="text-sm font-mono">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          basePath={basePath}
          depth={0}
          onNavigate={onNavigate}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          currentPath={currentPath}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  entry: FileEntry;
  basePath: string;
  depth: number;
  onNavigate?: () => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  currentPath: string;
}

function FileTreeNode({
  entry,
  basePath,
  depth,
  onNavigate,
  expandedPaths,
  toggleExpand,
  currentPath
}: FileTreeNodeProps) {
  const pathname = usePathname();
  const nodeRef = useRef<HTMLAnchorElement>(null);
  const isActive = pathname === `${basePath}/${entry.path}`;
  const isExpanded = expandedPaths.has(entry.path);
  const isInPath = currentPath.startsWith(entry.path + '/') || currentPath === entry.path;

  // Scroll active item into view on mount
  useEffect(() => {
    if (isActive && nodeRef.current) {
      setTimeout(() => {
        nodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isActive]);

  const paddingLeft = depth * 16 + 8;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => toggleExpand(entry.path)}
          className={`flex w-full items-center gap-1.5 py-1.5 lg:py-1 px-2 rounded-md transition-colors text-left active:bg-[var(--bg-tertiary)] ${
            isInPath ? 'bg-[var(--accent)]/5' : 'hover:bg-[var(--bg-tertiary)]'
          }`}
          style={{ paddingLeft }}
        >
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-[var(--text-secondary)] text-[10px]"
          >
            ▶
          </motion.span>
          <FolderIcon isOpen={isExpanded} />
          <span className={`truncate text-xs lg:text-sm ${isInPath ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
            {entry.name}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && entry.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {entry.children.map((child) => (
                <FileTreeNode
                  key={child.path}
                  entry={child}
                  basePath={basePath}
                  depth={depth + 1}
                  onNavigate={onNavigate}
                  expandedPaths={expandedPaths}
                  toggleExpand={toggleExpand}
                  currentPath={currentPath}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      ref={nodeRef}
      href={`${basePath}/${entry.path}`}
      onClick={onNavigate}
      className={`flex items-center gap-1.5 py-1.5 lg:py-1 px-2 rounded-md transition-colors active:scale-[0.98] ${
        isActive
          ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
          : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
      }`}
      style={{ paddingLeft: paddingLeft + 14 }}
    >
      <FileIcon extension={getExtension(entry.name)} />
      <span className="truncate text-xs lg:text-sm">{entry.name}</span>
    </Link>
  );
}

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-[var(--accent)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {isOpen ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
      )}
    </svg>
  );
}

function FileIcon({ extension }: { extension: string }) {
  const color = getFileColor(extension);

  return (
    <svg
      className="h-4 w-4 shrink-0"
      style={{ color }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getFileColor(extension: string): string {
  const colors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f7df1e',
    jsx: '#61dafb',
    json: '#cbcb41',
    md: '#519aba',
    mdx: '#f9ac00',
    css: '#264de4',
    scss: '#cc6699',
    html: '#e34c26',
    prisma: '#2d3748',
    sql: '#f29111',
    py: '#3776ab',
    go: '#00add8',
    rs: '#dea584',
    yaml: '#cb171e',
    yml: '#cb171e',
    sh: '#89e051',
    bash: '#89e051',
  };

  return colors[extension.toLowerCase()] || 'var(--text-secondary)';
}
