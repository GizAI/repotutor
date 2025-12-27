import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { getCurrentProjectPath } from '@/lib/giz-config';

const execAsync = promisify(exec);

function getRepoPath(): string {
  return getCurrentProjectPath() || process.cwd();
}

interface ConflictHunk {
  id: number;
  startLine: number;
  endLine: number;
  current: string;
  incoming: string;
  base?: string;
}

interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
}

// Parse conflict markers from file content
function parseConflicts(content: string): ConflictHunk[] {
  const hunks: ConflictHunk[] = [];
  const lines = content.split('\n');

  let currentHunk: Partial<ConflictHunk> | null = null;
  let section: 'current' | 'base' | 'incoming' | null = null;
  let currentContent: string[] = [];
  let baseContent: string[] = [];
  let incomingContent: string[] = [];
  let hunkId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('<<<<<<<')) {
      // Start of conflict
      currentHunk = {
        id: hunkId++,
        startLine: i + 1,
        current: '',
        incoming: '',
      };
      section = 'current';
      currentContent = [];
      baseContent = [];
      incomingContent = [];
    } else if (line.startsWith('|||||||')) {
      // Base section (diff3 style)
      section = 'base';
      if (currentHunk) {
        currentHunk.current = currentContent.join('\n');
      }
    } else if (line.startsWith('=======')) {
      // Separator between current/base and incoming
      section = 'incoming';
      if (currentHunk) {
        if (baseContent.length > 0) {
          currentHunk.base = baseContent.join('\n');
        } else {
          currentHunk.current = currentContent.join('\n');
        }
      }
    } else if (line.startsWith('>>>>>>>')) {
      // End of conflict
      if (currentHunk) {
        currentHunk.incoming = incomingContent.join('\n');
        currentHunk.endLine = i + 1;
        hunks.push(currentHunk as ConflictHunk);
      }
      currentHunk = null;
      section = null;
    } else if (section === 'current') {
      currentContent.push(line);
    } else if (section === 'base') {
      baseContent.push(line);
    } else if (section === 'incoming') {
      incomingContent.push(line);
    }
  }

  return hunks;
}

// GET: List all conflict files and their hunks
export async function GET() {
  try {
    const repoPath = getRepoPath();

    // Check for merge in progress
    const mergeHeadPath = path.join(repoPath, '.git', 'MERGE_HEAD');
    const hasMerge = await fs.access(mergeHeadPath).then(() => true).catch(() => false);

    // Get list of unmerged files
    const { stdout: statusOutput } = await execAsync(
      'git status --porcelain',
      { cwd: repoPath }
    );

    const conflictFiles: ConflictFile[] = [];
    const lines = statusOutput.split('\n').filter(Boolean);

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3);

      // UU = both modified (conflict)
      // AA = both added (conflict)
      // DD = both deleted (conflict)
      if (status === 'UU' || status === 'AA' || status === 'DU' || status === 'UD') {
        const fullPath = path.join(repoPath, filePath);

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const hunks = parseConflicts(content);

          if (hunks.length > 0) {
            conflictFiles.push({
              path: filePath,
              hunks,
            });
          }
        } catch {
          // File might be deleted in one version
          conflictFiles.push({
            path: filePath,
            hunks: [],
          });
        }
      }
    }

    return NextResponse.json({
      hasConflicts: conflictFiles.length > 0,
      hasMergeInProgress: hasMerge,
      files: conflictFiles,
      totalConflicts: conflictFiles.reduce((sum, f) => sum + f.hunks.length, 0),
    });

  } catch (error) {
    console.error('Git conflicts error:', error);
    return NextResponse.json(
      { error: 'Failed to get conflicts', details: (error as Error).message },
      { status: 500 }
    );
  }
}
