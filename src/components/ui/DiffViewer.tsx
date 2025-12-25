'use client';

interface DiffViewerProps {
  diff: string;
  fileName?: string;
  wrapText?: boolean;
  className?: string;
}

export function DiffViewer({ diff, fileName, wrapText = true, className = '' }: DiffViewerProps) {
  if (!diff) {
    return (
      <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
        No diff available
      </div>
    );
  }

  const renderDiffLine = (line: string, index: number) => {
    const isAddition = line.startsWith('+') && !line.startsWith('+++');
    const isDeletion = line.startsWith('-') && !line.startsWith('---');
    const isHeader = line.startsWith('@@');
    const isFileHeader = line.startsWith('+++') || line.startsWith('---');

    let bgClass = '';
    let textClass = 'text-[var(--text-secondary)]';

    if (isAddition) {
      bgClass = 'bg-green-500/10';
      textClass = 'text-green-600 dark:text-green-400';
    } else if (isDeletion) {
      bgClass = 'bg-red-500/10';
      textClass = 'text-red-600 dark:text-red-400';
    } else if (isHeader) {
      bgClass = 'bg-blue-500/10';
      textClass = 'text-blue-600 dark:text-blue-400';
    } else if (isFileHeader) {
      textClass = 'text-[var(--text-tertiary)] font-semibold';
    }

    return (
      <div
        key={index}
        className={`font-mono text-xs px-3 py-0.5 ${bgClass} ${textClass} ${
          wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
        }`}
      >
        {line || ' '}
      </div>
    );
  };

  return (
    <div className={`diff-viewer border border-[var(--border-default)] rounded-lg overflow-hidden ${className}`}>
      {fileName && (
        <div className="px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)]">
          {fileName}
        </div>
      )}
      <div className="max-h-[400px] overflow-y-auto bg-[var(--bg-tertiary)]">
        {diff.split('\n').map((line, index) => renderDiffLine(line, index))}
      </div>
    </div>
  );
}
