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
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const repoPath = getRepoPath();

    // Get recent commits with format: hash|author|date|message
    const { stdout } = await execAsync(
      `git log -${limit} --pretty=format:"%H|%an|%ar|%s"`,
      { cwd: repoPath }
    );

    const commits = stdout.split('\n').filter(Boolean).map((line) => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date, message };
    });

    return NextResponse.json({ commits });
  } catch (error) {
    console.error('Git commits error:', error);
    return NextResponse.json({ commits: [] });
  }
}
