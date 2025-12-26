'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatedCard, Icon } from '@/components/ui';
import { MarkdownViewer, parseFrontmatter, type HeadingItem, type DocFrontmatter } from './MarkdownViewer';
import { DocNavigation, DocHeader, TableOfContents, type DocLink } from './DocNavigation';
import { useThemeContext } from '@/components/layout/ThemeProvider';

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

type FileCategory = 'markdown' | 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'binary';

// Simple file category detection based on extension
function getFileCategory(path: string): FileCategory {
  const ext = path.split('.').pop()?.toLowerCase() || '';

  // Markdown
  if (['md', 'mdx', 'markdown'].includes(ext)) return 'markdown';

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'tif'].includes(ext)) return 'image';

  // Video
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv', 'flv', 'wmv'].includes(ext)) return 'video';

  // Audio
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext)) return 'audio';

  // PDF
  if (ext === 'pdf') return 'pdf';

  // Binary files (not displayable as text)
  if (['zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib',
       'woff', 'woff2', 'ttf', 'eot', 'otf',
       'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'binary';

  // Default to code (text-based)
  return 'code';
}

export function FileViewer({ path, siblings = [] }: FileViewerProps) {
  const [data, setData] = useState<FileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [frontmatter, setFrontmatter] = useState<DocFrontmatter>({});
  const { resolvedTheme } = useThemeContext();

  const theme = resolvedTheme === 'light' ? 'light' : 'dark';
  const category = getFileCategory(path);
  const isMediaOrBinary = ['image', 'video', 'audio', 'pdf', 'binary'].includes(category);
  const isMarkdown = category === 'markdown';

  useEffect(() => {
    // For media/binary files, we serve directly via raw API
    if (isMediaOrBinary) {
      setData({
        path,
        name: path.split('/').pop() || path,
        content: '',
        language: category,
        size: 0,
        lines: 0,
        extension: path.split('.').pop() || '',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const highlightParam = isMarkdown ? 'false' : 'true';

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
        if (isMarkdown && fileData.content) {
          const { frontmatter: fm } = parseFrontmatter(fileData.content);
          setFrontmatter(fm);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, theme, category, isMediaOrBinary, isMarkdown]);

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

  const rawUrl = `/api/file/${path}?raw=true`;
  const fileName = data.name;

  // Image viewer
  if (category === 'image') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <MediaHeader name={fileName} icon="🖼️" label="Image" />
        <AnimatedCard>
          <div className="flex flex-col items-center">
            <div className="relative max-w-full overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-2">
              <div
                className="absolute inset-2 rounded"
                style={{
                  backgroundImage: 'linear-gradient(45deg, var(--border-default) 25%, transparent 25%), linear-gradient(-45deg, var(--border-default) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border-default) 75%), linear-gradient(-45deg, transparent 75%, var(--border-default) 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />
              <img
                src={rawUrl}
                alt={fileName}
                className="relative max-w-full h-auto max-h-[70vh] object-contain"
                loading="lazy"
              />
            </div>
            <DownloadButton url={rawUrl} name={fileName} />
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // Video viewer
  if (category === 'video') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <MediaHeader name={fileName} icon="🎬" label="Video" />
        <AnimatedCard>
          <div className="flex flex-col items-center">
            <video
              src={rawUrl}
              controls
              className="w-full max-h-[70vh] rounded-lg bg-black"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
            <DownloadButton url={rawUrl} name={fileName} />
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // Audio viewer
  if (category === 'audio') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <MediaHeader name={fileName} icon="🎵" label="Audio" />
        <AnimatedCard>
          <div className="flex flex-col items-center py-8">
            <div className="w-full max-w-md">
              <audio src={rawUrl} controls className="w-full" preload="metadata">
                Your browser does not support the audio tag.
              </audio>
            </div>
            <DownloadButton url={rawUrl} name={fileName} />
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // PDF viewer
  if (category === 'pdf') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <MediaHeader name={fileName} icon="📄" label="PDF Document" />
        <AnimatedCard>
          <div className="flex flex-col items-center">
            <div className="hidden sm:block w-full">
              <iframe
                src={rawUrl}
                className="w-full h-[70vh] rounded-lg border border-[var(--border-default)]"
                title={fileName}
              />
            </div>
            <div className="sm:hidden flex flex-col items-center py-8">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-sm text-[var(--text-secondary)] mb-4 text-center">
                PDF preview is not available on mobile.<br />
                Please download to view.
              </p>
            </div>
            <DownloadButton url={rawUrl} name={fileName} />
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // Binary files (download only)
  if (category === 'binary') {
    return (
      <div className="space-y-3 lg:space-y-4">
        <MediaHeader name={fileName} icon="📦" label="Binary File" />
        <AnimatedCard>
          <div className="flex flex-col items-center py-12">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-sm text-[var(--text-secondary)] mb-2 text-center">
              This file cannot be previewed.
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mb-4">
              {data.extension.toUpperCase()} file
            </p>
            <a
              href={rawUrl}
              download={fileName}
              className="text-xs px-4 py-2 rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              Download {fileName}
            </a>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  // Markdown viewer
  if (category === 'markdown') {
    const hasDocFeatures = !!(frontmatter.title || siblings.length > 0);

    return (
      <MarkdownLayout
        fileName={fileName}
        data={data}
        copied={copied}
        onCopy={handleCopy}
        headings={headings}
        onHeadingsExtracted={handleHeadingsExtracted}
        frontmatter={frontmatter}
        hasDocFeatures={hasDocFeatures}
        siblings={siblings}
        path={path}
      />
    );
  }

  // Code viewer (default)
  return (
    <div className="space-y-3 lg:space-y-4">
      <AnimatedCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">{fileName}</div>
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

// Helper components
function MediaHeader({ name, icon, label }: { name: string; icon: string; label: string }) {
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

function DownloadButton({ url, name }: { url: string; name: string }) {
  return (
    <a
      href={url}
      download={name}
      className="mt-4 text-xs px-3 py-1.5 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
    >
      Download
    </a>
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

// Markdown Layout with collapsible sticky TOC
interface MarkdownLayoutProps {
  fileName: string;
  data: {
    language: string;
    lines: number;
    size: number;
    content: string;
  };
  copied: boolean;
  onCopy: () => void;
  headings: HeadingItem[];
  onHeadingsExtracted: (headings: HeadingItem[]) => void;
  frontmatter: DocFrontmatter;
  hasDocFeatures: boolean;
  siblings: DocLink[];
  path: string;
}

function MarkdownLayout({
  fileName,
  data,
  copied,
  onCopy,
  headings,
  onHeadingsExtracted,
  frontmatter,
  hasDocFeatures,
  siblings,
  path,
}: MarkdownLayoutProps) {
  const [isTocCollapsed, setIsTocCollapsed] = useState(false);
  const hasToc = headings.length > 2;

  // Load TOC collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('toc-collapsed');
    if (stored !== null) {
      setIsTocCollapsed(stored === 'true');
    }
  }, []);

  const toggleToc = useCallback(() => {
    setIsTocCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('toc-collapsed', String(newValue));
      return newValue;
    });
  }, []);

  return (
    <div className="space-y-3 lg:space-y-4 max-w-full min-w-0">
      {/* Header bar */}
      <AnimatedCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{fileName}</div>
            <div className="flex items-center gap-2 text-[9px] lg:text-[10px] text-[var(--text-secondary)]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">{data.language}</span>
              <span className="hidden sm:inline">{data.lines} lines</span>
              <span>{formatSize(data.size)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* TOC Toggle Button - only show on screens where TOC is visible */}
            {hasToc && (
              <button
                onClick={toggleToc}
                className="hidden lg:flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
                title={isTocCollapsed ? 'Show table of contents' : 'Hide table of contents'}
              >
                <Icon name="toc" className="h-3 w-3" />
                <span>{isTocCollapsed ? 'Show TOC' : 'Hide TOC'}</span>
              </button>
            )}
            <button
              onClick={onCopy}
              className="self-start sm:self-auto text-[10px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Raw'}
            </button>
          </div>
        </div>
      </AnimatedCard>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <AnimatedCard>
            {hasDocFeatures && frontmatter.title && (
              <DocHeader
                title={frontmatter.title}
                description={frontmatter.description}
                category={frontmatter.category}
                icon={frontmatter.icon}
              />
            )}
            <MarkdownViewer
              content={data.content}
              onHeadingsExtracted={onHeadingsExtracted}
            />
            {siblings.length > 0 && (
              <DocNavigation currentPath={path} siblings={siblings} />
            )}
          </AnimatedCard>
        </div>

        {/* Sticky collapsible TOC */}
        {hasToc && !isTocCollapsed && (
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-4">
              <AnimatedCard>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Contents
                  </h4>
                  <button
                    onClick={toggleToc}
                    className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
                    title="Hide table of contents"
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </button>
                </div>
                <TableOfContents headings={headings} />
              </AnimatedCard>
            </div>
          </aside>
        )}

        {/* Collapsed TOC indicator - vertical bar on the right edge */}
        {hasToc && isTocCollapsed && (
          <button
            onClick={toggleToc}
            className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-30
              flex-col items-center justify-center
              w-8 py-4 rounded-lg
              bg-[var(--bg-secondary)] border border-[var(--border-default)]
              text-[var(--text-tertiary)] hover:text-[var(--text-primary)]
              hover:bg-[var(--hover-bg)] hover:border-[var(--border-strong)]
              transition-all shadow-lg"
            title="Show table of contents"
          >
            <Icon name="toc" className="h-4 w-4 mb-1" />
            <span className="text-[9px] font-medium" style={{ writingMode: 'vertical-rl' }}>TOC</span>
          </button>
        )}
      </div>
    </div>
  );
}
