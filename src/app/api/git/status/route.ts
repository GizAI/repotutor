import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// Get the repository root path
function getRepoPath(): string {
  // Default to current working directory or configured path
  const repoPath = process.env.REPO_PATH || process.cwd();
  return repoPath;
}

export async function GET(request: NextRequest) {
  try {
    const repoPath = getRepoPath();

    // Check if .git directory exists
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) {
      return NextResponse.json({
        error: 'Not a git repository',
        details: 'No .git directory found in the project root',
      });
    }

    // Get current branch
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: repoPath });
    const branch = branchOutput.trim();

    // Check if there are any commits
    try {
      await execAsync('git rev-parse HEAD', { cwd: repoPath });
    } catch {
      return NextResponse.json({
        branch: branch || 'main',
        hasCommits: false,
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
      });
    }

    // Get status with porcelain format for easy parsing
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: repoPath });

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];
    const untracked: string[] = [];

    const lines = statusOutput.split('\n').filter(Boolean);
    for (const line of lines) {
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status.includes('M')) {
        modified.push(file);
      } else if (status.includes('A')) {
        added.push(file);
      } else if (status.includes('D')) {
        deleted.push(file);
      } else if (status === '??') {
        untracked.push(file);
      }
    }

    return NextResponse.json({
      branch,
      hasCommits: true,
      modified,
      added,
      deleted,
      untracked,
    });
  } catch (error) {
    console.error('Git status error:', error);
    return NextResponse.json(
      { error: 'Failed to get git status', details: (error as Error).message },
      { status: 500 }
    );
  }
}
