'use client';

import { useState, useMemo, Fragment } from 'react';
import { parseDiff, Diff, Hunk, Decoration, ViewType } from 'react-diff-view';
import type { HunkData } from 'react-diff-view';
import { useThemeContext } from '@/components/layout/ThemeProvider';
import { SplitSquareHorizontal, AlignJustify, WrapText } from 'lucide-react';
import 'react-diff-view/style/index.css';

interface DiffViewerProps {
  diff: string;
  fileName?: string;
  className?: string;
}

export function DiffViewer({ diff, fileName, className = '' }: DiffViewerProps) {
  const { resolvedTheme } = useThemeContext();
  const [viewType, setViewType] = useState<ViewType>('unified');
  const [wrap, setWrap] = useState(true);

  const files = useMemo(() => {
    if (!diff || diff.trim() === '') {
      return [];
    }
    try {
      return parseDiff(diff, { nearbySequences: 'zip' });
    } catch (e) {
      console.error('Failed to parse diff:', e);
      return [];
    }
  }, [diff]);

  if (!diff || files.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground text-sm ${className}`}>
        No changes to display
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`diff-viewer-container ${isDark ? 'diff-dark' : ''} ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewType('split')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewType === 'split'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
            title="Split view"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => setViewType('unified')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewType === 'unified'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
            title="Unified view"
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unified</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {fileName && (
            <span className="text-xs font-mono text-[var(--text-tertiary)] truncate max-w-[200px]">
              {fileName}
            </span>
          )}
          <button
            onClick={() => setWrap(!wrap)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              wrap
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
            title="Toggle word wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div
        className={`overflow-auto bg-[var(--bg-tertiary)] ${wrap ? 'diff-wrap' : ''}`}
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {files.map((file, index) => (
          <div key={index} className="diff-file">
            {file.oldPath && file.newPath && (
              <div className="diff-file-header px-3 py-2 text-xs font-mono bg-[var(--bg-secondary)] border-b border-[var(--border-default)] text-[var(--text-secondary)]">
                {file.oldPath === file.newPath ? file.oldPath : `${file.oldPath} → ${file.newPath}`}
              </div>
            )}
            <Diff
              viewType={viewType}
              diffType={file.type}
              hunks={file.hunks}
              className="diff-table"
            >
              {(hunks: HunkData[]) =>
                hunks.flatMap((hunk) => [
                  <Decoration key={`decoration-${hunk.content}`}>
                    <div className="diff-hunk-header px-3 py-1 text-xs font-mono text-blue-500 bg-blue-500/10">
                      {hunk.content}
                    </div>
                  </Decoration>,
                  <Hunk key={`hunk-${hunk.content}`} hunk={hunk} />,
                ])
              }
            </Diff>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .diff-viewer-container .diff-table {
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
          font-size: 13px;
          line-height: 1.5;
          width: 100%;
        }

        .diff-viewer-container .diff-gutter {
          width: 50px;
          padding: 0 8px;
          text-align: right;
          color: var(--text-tertiary);
          user-select: none;
          background: var(--bg-secondary);
        }

        .diff-viewer-container .diff-code {
          padding: 0 12px;
        }

        .diff-viewer-container .diff-code-insert {
          background-color: rgba(34, 197, 94, 0.15);
        }

        .diff-viewer-container .diff-code-delete {
          background-color: rgba(239, 68, 68, 0.15);
        }

        .diff-viewer-container .diff-gutter-insert {
          background-color: rgba(34, 197, 94, 0.2);
          color: rgb(22, 163, 74);
        }

        .diff-viewer-container .diff-gutter-delete {
          background-color: rgba(239, 68, 68, 0.2);
          color: rgb(220, 38, 38);
        }

        .diff-dark .diff-code-insert {
          background-color: rgba(34, 197, 94, 0.1);
        }

        .diff-dark .diff-code-delete {
          background-color: rgba(239, 68, 68, 0.1);
        }

        .diff-dark .diff-gutter-insert {
          background-color: rgba(34, 197, 94, 0.15);
          color: rgb(74, 222, 128);
        }

        .diff-dark .diff-gutter-delete {
          background-color: rgba(239, 68, 68, 0.15);
          color: rgb(248, 113, 113);
        }

        .diff-wrap .diff-code {
          white-space: pre-wrap;
          word-break: break-all;
        }

        .diff-viewer-container .diff-line:hover .diff-code {
          background-color: rgba(0, 0, 0, 0.03);
        }

        .diff-dark .diff-line:hover .diff-code {
          background-color: rgba(255, 255, 255, 0.03);
        }

        .diff-viewer-container .diff-widget {
          background: var(--bg-tertiary);
        }
      `}</style>
    </div>
  );
}
