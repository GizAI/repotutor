'use client';

import { useMemo } from 'react';
import { createTwoFilesPatch } from 'diff';
import { ToolCall } from '../types';
import { DiffViewer } from '@/components/ui/DiffViewer';

interface EditViewProps {
  tool: ToolCall;
}

export function EditView({ tool }: EditViewProps) {
  const { filePath, oldString, newString, replaceAll } = useMemo(() => {
    try {
      const input = JSON.parse(tool.input || '{}');
      return {
        filePath: input.file_path || '',
        oldString: input.old_string || '',
        newString: input.new_string || '',
        replaceAll: input.replace_all || false,
      };
    } catch {
      return { filePath: '', oldString: '', newString: '', replaceAll: false };
    }
  }, [tool.input]);

  // Generate unified diff
  const unifiedDiff = useMemo(() => {
    if (!oldString && !newString) return '';
    const fileName = filePath || 'file';
    return createTwoFilesPatch(fileName, fileName, oldString, newString, '', '');
  }, [filePath, oldString, newString]);

  if (!oldString && !newString) {
    return (
      <div className="px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
        No changes to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Replace all badge */}
      {replaceAll && (
        <div className="flex items-center gap-2 text-[10px] px-2">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[9px]">
            replace all occurrences
          </span>
        </div>
      )}

      {/* Diff viewer - compact version */}
      <div className="max-h-48 overflow-hidden rounded-lg border border-[var(--border-default)]">
        <DiffViewer diff={unifiedDiff} fileName={filePath} className="[&_.diff-viewer-container]:max-h-48" />
      </div>
    </div>
  );
}
