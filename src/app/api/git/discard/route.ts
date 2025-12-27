import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentProjectPath } from '@/lib/giz-config';

const execAsync = promisify(exec);

function getRepoPath(): string {
  return getCurrentProjectPath() || process.cwd();
}

export async function POST(request: NextRequest) {
  try {
    const { file } = await request.json();
    const repoPath = getRepoPath();

    if (!file) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // Discard changes for specific file
    await execAsync(`git checkout -- "${file}"`, { cwd: repoPath });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Discard error:', error);
    return NextResponse.json(
      { error: 'Failed to discard changes', details: (error as Error).message },
      { status: 500 }
    );
  }
}
