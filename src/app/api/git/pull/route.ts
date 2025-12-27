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
    const repoPath = getRepoPath();

    await execAsync('git pull', { cwd: repoPath });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pull error:', error);
    return NextResponse.json(
      { error: 'Failed to pull', details: (error as Error).message },
      { status: 500 }
    );
  }
}
