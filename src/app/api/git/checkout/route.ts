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
    const { branch } = await request.json();
    const repoPath = getRepoPath();

    if (!branch) {
      return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
    }

    await execAsync(`git checkout "${branch}"`, { cwd: repoPath });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to checkout branch', details: (error as Error).message },
      { status: 500 }
    );
  }
}
