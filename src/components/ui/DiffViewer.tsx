'use client';

import { useState, useMemo } from 'react';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import { DiffFile, DiffHighlighterLang } from '@git-diff-view/core';
import '@git-diff-view/react/styles/diff-view.css';
import { useThemeContext } from '@/components/layout/ThemeProvider';
import { SplitSquareHorizontal, AlignJustify, WrapText } from 'lucide-react';

interface DiffViewerProps {
  diff: string;
  fileName?: string;
  language?: string;
  className?: string;
}

// Parse unified diff to extract file info and hunks
function parseUnifiedDiff(diff: string): { oldFile: string; newFile: string; hunks: string[] } {
  const lines = diff.split('\n');
  let oldFile = '';
  let newFile = '';
  const hunks: string[] = [];
  let currentHunk: string[] = [];
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      oldFile = line.slice(4).replace(/^a\//, '');
    } else if (line.startsWith('+++ ')) {
      newFile = line.slice(4).replace(/^b\//, '');
    } else if (line.startsWith('@@')) {
      // Start of a new hunk
      if (currentHunk.length > 0) {
        hunks.push(currentHunk.join('\n'));
      }
      currentHunk = [line];
      inHunk = true;
    } else if (inHunk) {
      currentHunk.push(line);
    }
  }

  // Push the last hunk
  if (currentHunk.length > 0) {
    hunks.push(currentHunk.join('\n'));
  }

  return { oldFile, newFile, hunks: hunks.length > 0 ? hunks : [diff] };
}

// Detect language from filename - returns DiffHighlighterLang compatible string
function detectLanguage(fileName: string): DiffHighlighterLang {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, DiffHighlighterLang> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    html: 'xml',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
    graphql: 'graphql',
    vue: 'vue',
  };
  return langMap[ext] || 'plaintext';
}

export function DiffViewer({ diff, fileName, language, className = '' }: DiffViewerProps) {
  const { resolvedTheme } = useThemeContext();
  const [mode, setMode] = useState<DiffModeEnum>(DiffModeEnum.Split);
  const [wrap, setWrap] = useState(true);
  const highlight = true;

  const diffFile = useMemo(() => {
    if (!diff) return null;

    try {
      const { oldFile, newFile, hunks } = parseUnifiedDiff(diff);
      const detectedLang = (language as DiffHighlighterLang) || detectLanguage(fileName || newFile || oldFile || '');

      // Create DiffFile instance from unified diff
      const instance = DiffFile.createInstance({
        newFile: {
          fileName: newFile || fileName || 'file',
          fileLang: detectedLang,
          content: '',
        },
        oldFile: {
          fileName: oldFile || fileName || 'file',
          fileLang: detectedLang,
          content: '',
        },
        hunks,
      });

      // Initialize the diff file for rendering
      instance.init();

      return instance;
    } catch (e) {
      console.error('Failed to parse diff:', e);
      return null;
    }
  }, [diff, fileName, language]);

  if (!diff) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground text-sm ${className}`}>
        No changes to display
      </div>
    );
  }

  // Fallback to simple view if parsing fails
  if (!diffFile) {
    return <SimpleDiffViewer diff={diff} className={className} />;
  }

  return (
    <div className={`diff-viewer-container ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode(DiffModeEnum.Split)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === DiffModeEnum.Split
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
            title="Split view"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => setMode(DiffModeEnum.Unified)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === DiffModeEnum.Unified
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
            title="Unified view"
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unified</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
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

      {/* Diff View */}
      <div
        className="diff-view-wrapper overflow-auto"
        style={{
          maxHeight: 'calc(80vh - 120px)',
          colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light',
        }}
      >
        <DiffView
          diffFile={diffFile}
          diffViewMode={mode}
          diffViewTheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          diffViewWrap={wrap}
          diffViewHighlight={highlight}
          diffViewFontSize={13}
        />
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        .diff-view-wrapper {
          --diff-add-color: ${resolvedTheme === 'dark' ? 'rgba(46, 160, 67, 0.15)' : 'rgba(46, 160, 67, 0.2)'};
          --diff-del-color: ${resolvedTheme === 'dark' ? 'rgba(248, 81, 73, 0.15)' : 'rgba(248, 81, 73, 0.2)'};
          --diff-add-highlight-color: ${resolvedTheme === 'dark' ? 'rgba(46, 160, 67, 0.4)' : 'rgba(46, 160, 67, 0.4)'};
          --diff-del-highlight-color: ${resolvedTheme === 'dark' ? 'rgba(248, 81, 73, 0.4)' : 'rgba(248, 81, 73, 0.4)'};
        }

        .diff-view-wrapper .diff-line-num {
          color: var(--text-tertiary);
          font-size: 12px;
        }

        .diff-view-wrapper .diff-line-content {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .diff-view-wrapper .diff-split-line:hover,
        .diff-view-wrapper .diff-unified-line:hover {
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
}

// Simple fallback diff viewer
function SimpleDiffViewer({ diff, className = '' }: { diff: string; className?: string }) {
  const renderDiffLine = (line: string, index: number) => {
    const isAddition = line.startsWith('+') && !line.startsWith('+++');
    const isDeletion = line.startsWith('-') && !line.startsWith('---');
    const isHeader = line.startsWith('@@');
    const isFileHeader = line.startsWith('+++') || line.startsWith('---');

    let bgClass = '';
    let textClass = 'text-[var(--text-secondary)]';

    if (isAddition) {
      bgClass = 'bg-green-500/15';
      textClass = 'text-green-600 dark:text-green-400';
    } else if (isDeletion) {
      bgClass = 'bg-red-500/15';
      textClass = 'text-red-600 dark:text-red-400';
    } else if (isHeader) {
      bgClass = 'bg-blue-500/10';
      textClass = 'text-blue-600 dark:text-blue-400 font-medium';
    } else if (isFileHeader) {
      textClass = 'text-[var(--text-tertiary)] font-semibold';
    }

    return (
      <div
        key={index}
        className={`font-mono text-[13px] leading-5 px-3 py-px ${bgClass} ${textClass} whitespace-pre`}
      >
        {line || ' '}
      </div>
    );
  };

  return (
    <div className={`border border-[var(--border-default)] rounded-lg overflow-hidden ${className}`}>
      <div className="overflow-auto max-h-[60vh] bg-[var(--bg-tertiary)]">
        {diff.split('\n').map((line, index) => renderDiffLine(line, index))}
      </div>
    </div>
  );
}
