'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatedCard } from '@/components/ui';
import { MarkdownViewer, parseFrontmatter, type HeadingItem, type DocFrontmatter } from './MarkdownViewer';
import { DocNavigation, DocHeader, TableOfContents, type DocLink } from './DocNavigation';

interface FileViewerProps {
  path: string;
  theme?: 'dark' | 'light';
  siblings?: DocLink[];
}

interface FileData {
  path: string;
  name: string;
  content: string;
  highlightedHtml?: string;
  language: string;
  size: number;
  lines: number;
  extension: string;
}

const MARKDOWN_EXTENSIONS = ['.md', '.mdx', '.markdown'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];
const PDF_EXTENSION = '.pdf';

function getFileType(path: string): 'markdown' | 'image' | 'pdf' | 'code' {
  const lowerPath = path.toLowerCase();
  if (MARKDOWN_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'markdown';
  if (IMAGE_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return 'image';
  if (lowerPath.endsWith(PDF_EXTENSION)) return 'pdf';
  return 'code';
}

export function FileViewer({ path, theme = 'dark', siblings = [] }: FileViewerProps) {
  const [data, setData] = useState<FileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [frontmatter, setFrontmatter] = useState<DocFrontmatter>({});

  const fileType = getFileType(path);
  const isBinary = fileType === 'image' || fileType === 'pdf';
  const isMarkdown = fileType === 'markdown';

  useEffect(() => {
    // For binary files (images, PDFs), we don't fetch content through API
    if (isBinary) {
      setData({
        path,
        name: path.split('/').pop() || path,
        content: '',
        language: fileType,
        size: 0,
        lines: 0,
        extension: path.split('.').pop() || '',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const highlightParam = fileType === 'markdown' ? 'false' : 'true';

    fetch(`/api/file/${path}?highlight=${highlightParam}&theme=${theme}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || 'Failed to load file');
          });
        }
        return res.json();
      })
      .then((fileData) => {
        setData(fileData);
        // Parse frontmatter for markdown files
        if (isMarkdown && fileData.content) {
          const { frontmatter: fm } = parseFrontmatter(fileData.content);
          setFrontmatter(fm);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, theme, fileType, isBinary, isMarkdown]);

  const handleCopy = async () => {
    if (data && data.content) {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleHeadingsExtracted = useCallback((extractedHeadings: HeadingItem[]) => {
    setHeadings(extractedHeadings);
  }, []);

  if (loading) {
    return (
      <AnimatedCard>
        <div className="flex items-center justify-center py-12 lg:py-20">
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <LoadingSpinner />
            <span className="text-sm">Loading file...</span>
          </div>
        </div>
      </AnimatedCard>
    );
  }

  if (error) {
    return (
      <AnimatedCard>
        <div className="flex flex-col items-center justify-center py-12 lg:py-20 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-sm text-[var(--text-secondary)]">{error}</div>
        </div>
      </AnimatedCard>
    );
  }

  if (!data) return null;

  // Image viewer
  if (fileType === 'image') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <FileHeader name={data.name} type="image" />
        <AnimatedCard>
          <div className="flex flex-col items-center">
            <div className="relative max-w-full overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-2">
              {/* Checkered background for transparency */}
              <div
                className="absolute inset-2 rounded"
                style={{
                  backgroundImage: 'linear-gradient(45deg, var(--border-default) 25%, transparent 25%), linear-gradient(-45deg, var(--border-default) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border-default) 75%), linear-gradient(-45deg, transparent 75%, var(--border-default) 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />
              <img
                src={`/api/file/${path}?raw=true`}
                alt={data.name}
                className="relative max-w-full h-auto max-h-[70vh] object-contain"
                loading="lazy"
              />
            </div>
            <a
              href={`/api/file/${path}?raw=true`}
              download={data.name}
              className="mt-4 text-xs px-3 py-1.5 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
            >
              Download Image
            </a>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // PDF viewer
  if (fileType === 'pdf') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <FileHeader name={data.name} type="pdf" />
        <AnimatedCard>
          <div className="flex flex-col items-center">
            {/* PDF embed for desktop */}
            <div className="hidden sm:block w-full">
              <iframe
                src={`/api/file/${path}?raw=true`}
                className="w-full h-[70vh] rounded-lg border border-[var(--border-default)]"
                title={data.name}
              />
            </div>
            {/* Mobile: download link */}
            <div className="sm:hidden flex flex-col items-center py-8">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-sm text-[var(--text-secondary)] mb-4 text-center">
                PDF preview is not available on mobile.<br />
                Please download to view.
              </p>
            </div>
            <a
              href={`/api/file/${path}?raw=true`}
              download={data.name}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-xs px-3 py-1.5 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
            >
              Download PDF
            </a>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // Markdown/MDX viewer with GitBook features
  if (fileType === 'markdown') {
    const hasDocFeatures = frontmatter.title || siblings.length > 0;

    return (
      <div className="space-y-3 lg:space-y-4 max-w-full min-w-0">
        {/* File info bar */}
        <AnimatedCard>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{data.name}</div>
              <div className="flex items-center gap-2 text-[9px] lg:text-[10px] text-[var(--text-secondary)]">
                <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">{data.language}</span>
                <span className="hidden sm:inline">{data.lines} lines</span>
                <span>{formatSize(data.size)}</span>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="self-start sm:self-auto text-[10px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Raw'}
            </button>
          </div>
        </AnimatedCard>

        {/* Main content area with optional TOC sidebar */}
        <div className="flex gap-6">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatedCard>
              {/* Doc header if frontmatter exists */}
              {hasDocFeatures && frontmatter.title && (
                <DocHeader
                  title={frontmatter.title}
                  description={frontmatter.description}
                  category={frontmatter.category}
                  icon={frontmatter.icon}
                />
              )}

              {/* Markdown content */}
              <MarkdownViewer
                content={data.content}
                onHeadingsExtracted={handleHeadingsExtracted}
              />

              {/* Prev/Next navigation */}
              {siblings.length > 0 && (
                <DocNavigation currentPath={path} siblings={siblings} />
              )}
            </AnimatedCard>
          </div>

          {/* TOC sidebar - desktop only */}
          {headings.length > 2 && (
            <aside className="hidden xl:block w-48 shrink-0">
              <div className="sticky top-6">
                <AnimatedCard>
                  <TableOfContents headings={headings} />
                </AnimatedCard>
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // Code viewer (default)
  return (
    <div className="space-y-3 lg:space-y-4">
      <AnimatedCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">{data.name}</div>
            <div className="flex items-center gap-2 text-[9px] lg:text-[10px] text-[var(--text-secondary)]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">{data.language}</span>
              <span className="hidden sm:inline">{data.lines} lines</span>
              <span>{formatSize(data.size)}</span>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="self-start sm:self-auto text-[10px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </AnimatedCard>

      <div
        className="rounded-lg lg:rounded-xl border border-[var(--border-default)] overflow-hidden"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        {data.highlightedHtml ? (
          <div
            className="overflow-x-auto p-3 lg:p-4 text-[11px] lg:text-sm font-mono leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: data.highlightedHtml }}
          />
        ) : (
          <pre className="p-3 lg:p-4 text-[11px] lg:text-sm font-mono overflow-x-auto text-[var(--text-primary)]">
            <code>{data.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

function FileHeader({ name, type }: { name: string; type: 'image' | 'pdf' }) {
  const icon = type === 'image' ? '🖼️' : '📄';
  const label = type === 'image' ? 'Image' : 'PDF Document';

  return (
    <AnimatedCard>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{name}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">{label}</div>
        </div>
      </div>
    </AnimatedCard>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
