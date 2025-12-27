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
    const repoPath = getRepoPath();

    // Get all local branches
    const { stdout } = await execAsync('git branch --format="%(refname:short)"', { cwd: repoPath });
    const branches = stdout.split('\n').filter(Boolean);

    // Get current branch
    const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: repoPath });

    return NextResponse.json({
      branches,
      current: currentBranch.trim(),
    });
  } catch (error) {
    console.error('Git branches error:', error);
    return NextResponse.json(
      { error: 'Failed to get branches', branches: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { branch } = await request.json();
    const repoPath = getRepoPath();

    if (!branch) {
      return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
    }

    // Create and checkout new branch
    await execAsync(`git checkout -b "${branch}"`, { cwd: repoPath });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { error: 'Failed to create branch', details: (error as Error).message },
      { status: 500 }
    );
  }
}
