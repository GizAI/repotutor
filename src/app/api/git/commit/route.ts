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
    const { message, files } = await request.json();
    const repoPath = getRepoPath();

    if (!message) {
      return NextResponse.json({ error: 'Commit message required' }, { status: 400 });
    }

    // Stage files
    if (files && files.length > 0) {
      for (const file of files) {
        await execAsync(`git add "${file}"`, { cwd: repoPath });
      }
    } else {
      // Stage all changes
      await execAsync('git add -A', { cwd: repoPath });
    }

    // Commit
    const escapedMessage = message.replace(/"/g, '\\"');
    await execAsync(`git commit -m "${escapedMessage}"`, { cwd: repoPath });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Commit error:', error);
    return NextResponse.json(
      { error: 'Failed to commit', details: (error as Error).message },
      { status: 500 }
    );
  }
}
