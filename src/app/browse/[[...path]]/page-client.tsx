'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileViewer } from '@/components/browser';
import { Card } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useBrowseContext } from '../BrowseContext';
import type { FileTree as FileTreeType } from '@/lib/files/reader';

interface BrowsePageClientProps {
  repoName: string;
}

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
}

interface DocSibling {
  path: string;
  title: string;
  order?: number;
}

export function BrowsePageClient({ repoName }: BrowsePageClientProps) {
  const pathname = usePathname();
  const { entries } = useBrowseContext();
  const [pathInfo, setPathInfo] = useState<FileEntry | null>(null);
  const [siblings, setSiblings] = useState<DocSibling[]>([]);
  const [loading, setLoading] = useState(false);

  // URL에서 현재 경로 추출
  const currentPath = useMemo(() => {
    if (pathname.startsWith('/browse/')) {
      return decodeURIComponent(pathname.slice(8));
    }
    return '';
  }, [pathname]);

  const isFile = pathInfo?.type === 'file';
  const isDirectory = !pathInfo || pathInfo.type === 'directory';

  // 경로 변경 시 pathInfo와 siblings 업데이트
  useEffect(() => {
    if (!currentPath) {
      setPathInfo(null);
      setSiblings([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // pathInfo 가져오기 - 확장자가 있으면 파일로 간주
    const hasExtension = currentPath.includes('.') && currentPath.split('.').pop()!.length <= 5;

    if (hasExtension) {
      // 파일로 간주
      setPathInfo({
        name: currentPath.split('/').pop() || currentPath,
        path: currentPath,
        type: 'file',
        extension: currentPath.split('.').pop(),
      });
      setLoading(false);
    } else {
      // 디렉토리 확인
      fetch(`/api/files/?path=${encodeURIComponent(currentPath)}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.pathInfo) {
            setPathInfo(data.pathInfo);
          } else {
            // 파일일 수 있음
            setPathInfo({
              name: currentPath.split('/').pop() || currentPath,
              path: currentPath,
              type: 'file',
              extension: currentPath.split('.').pop(),
            });
          }
        })
        .catch(() => {
          setPathInfo({
            name: currentPath.split('/').pop() || currentPath,
            path: currentPath,
            type: 'file',
            extension: currentPath.split('.').pop(),
          });
        })
        .finally(() => setLoading(false));
    }

    // 마크다운 파일이면 siblings 로드
    const ext = currentPath.split('.').pop()?.toLowerCase();
    if (ext && ['md', 'mdx', 'markdown'].includes(ext)) {
      fetch(`/api/files/siblings/?path=${encodeURIComponent(currentPath)}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : { siblings: [] })
        .then(data => setSiblings(data.siblings || []))
        .catch(() => setSiblings([]));
    } else {
      setSiblings([]);
    }
  }, [currentPath]);

  // Content rendering
  if (loading) {
    return (
      <Card padding="lg">
        <div className="flex items-center justify-center py-12 lg:py-20">
          <div className="text-sm text-[var(--text-secondary)]">Loading...</div>
        </div>
      </Card>
    );
  }

  if (isFile && currentPath) {
    return <FileViewer path={currentPath} siblings={siblings} />;
  }

  if (isDirectory) {
    return <DirectoryView entries={entries} currentPath={currentPath} repoName={repoName} />;
  }

  return (
    <Card padding="lg">
      <div className="flex flex-col items-center justify-center py-12 lg:py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] mb-4">
          <Icon name="folder" className="h-6 w-6 text-[var(--text-tertiary)]" />
        </div>
        <div className="text-body-lg font-medium text-[var(--text-primary)]">Path not found</div>
        <div className="text-caption text-[var(--text-secondary)] mt-2">
          The requested path does not exist.
        </div>
        <Link
          href="/browse"
          className="mt-4 text-sm text-[var(--accent)] hover:underline"
        >
          Go to root
        </Link>
      </div>
    </Card>
  );
}

interface DirectoryViewProps {
  entries: FileTreeType[] | null;
  currentPath: string;
  repoName: string;
}

function findEntriesForPath(entries: FileTreeType[], targetPath: string): FileTreeType[] {
  if (!targetPath) return entries;

  const pathParts = targetPath.split('/');
  let current = entries;

  for (const part of pathParts) {
    const found = current.find(e => e.name === part && e.type === 'directory');
    if (found?.children) {
      current = found.children;
    } else {
      return [];
    }
  }

  return current;
}

function DirectoryView({ entries, currentPath, repoName }: DirectoryViewProps) {
  const directChildren = entries ? findEntriesForPath(entries, currentPath) : [];

  if (directChildren.length === 0) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center justify-center py-12 lg:py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] mb-4">
            <Icon name="folder" className="h-6 w-6 text-[var(--text-tertiary)]" />
          </div>
          <div className="text-body-lg font-medium text-[var(--text-primary)]">Empty directory</div>
          <div className="text-caption text-[var(--text-secondary)] mt-2">
            This directory has no visible files.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-full min-w-0">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-body-lg font-medium text-[var(--text-primary)] truncate min-w-0">
            {currentPath || repoName}
          </h2>
          <span className="text-caption text-[var(--text-secondary)] shrink-0">
            {countItems(directChildren)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {directChildren.map((entry) => (
            <Link
              key={entry.path}
              href={`/browse/${entry.path}`}
              scroll={false}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] transition-all"
            >
              {entry.type === 'directory' ? (
                <FolderIcon />
              ) : (
                <FileIcon extension={entry.extension || ''} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {entry.name}
                </div>
                {entry.type === 'file' && entry.size !== undefined && (
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {formatSize(entry.size)}
                  </div>
                )}
                {entry.type === 'directory' && entry.children && (
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    {entry.children.length} items
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function countItems(entries: FileTreeType[]): string {
  const dirs = entries.filter((e) => e.type === 'directory').length;
  const files = entries.filter((e) => e.type === 'file').length;
  const parts = [];
  if (dirs > 0) parts.push(`${dirs} folder${dirs > 1 ? 's' : ''}`);
  if (files > 0) parts.push(`${files} file${files > 1 ? 's' : ''}`);
  return parts.join(', ') || 'Empty';
}

function FolderIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
      <Icon name="folder" className="h-4 w-4 text-[var(--accent)]" />
    </div>
  );
}

function FileIcon({ extension }: { extension: string }) {
  const color = getFileColor(extension);
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}15` }}
    >
      <svg
        className="h-4 w-4"
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
    </div>
  );
}

function getFileColor(extension: string): string {
  const ext = extension.replace('.', '').toLowerCase();
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
  return colors[ext] || 'var(--text-tertiary)';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
