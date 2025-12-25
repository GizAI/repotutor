import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getRepoPath(): string {
  return process.env.REPO_PATH || process.cwd();
}

export async function POST(request: NextRequest) {
  try {
    const repoPath = getRepoPath();

    // Get current branch
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: repoPath });
    const branch = branchOutput.trim();

    // Push to remote
    await execAsync(`git push -u origin "${branch}"`, { cwd: repoPath });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push error:', error);
    return NextResponse.json(
      { error: 'Failed to push', details: (error as Error).message },
      { status: 500 }
    );
  }
}
