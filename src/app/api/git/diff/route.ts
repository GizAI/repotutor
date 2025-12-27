import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentProjectPath } from '@/lib/giz-config';

const execAsync = promisify(exec);

function getRepoPath(): string {
  return getCurrentProjectPath() || process.cwd();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const repoPath = getRepoPath();

    let diffCommand = 'git diff';
    if (file) {
      // For specific file, get diff including untracked files
      diffCommand = `git diff -- "${file}" 2>/dev/null || git diff --no-index /dev/null "${file}" 2>/dev/null || cat "${file}"`;
    }

    const { stdout } = await execAsync(diffCommand, {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return NextResponse.json({ diff: stdout });
  } catch (error) {
    console.error('Git diff error:', error);
    return NextResponse.json(
      { error: 'Failed to get diff', diff: '' },
      { status: 500 }
    );
  }
}
