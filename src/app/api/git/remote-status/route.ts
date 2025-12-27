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

    // Check if remote exists
    let hasRemote = false;
    let remoteName = '';
    try {
      const { stdout } = await execAsync('git remote', { cwd: repoPath });
      const remotes = stdout.trim().split('\n').filter(Boolean);
      hasRemote = remotes.length > 0;
      remoteName = remotes[0] || 'origin';
    } catch {
      return NextResponse.json({ hasRemote: false });
    }

    if (!hasRemote) {
      return NextResponse.json({ hasRemote: false });
    }

    // Fetch from remote (silently)
    try {
      await execAsync(`git fetch ${remoteName}`, { cwd: repoPath });
    } catch {
      // Ignore fetch errors
    }

    // Get current branch
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: repoPath });
    const branch = branchOutput.trim();

    // Check if branch has upstream
    let hasUpstream = false;
    try {
      await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: repoPath });
      hasUpstream = true;
    } catch {
      hasUpstream = false;
    }

    if (!hasUpstream) {
      return NextResponse.json({
        hasRemote: true,
        remoteName,
        hasUpstream: false,
        ahead: 0,
        behind: 0,
      });
    }

    // Get ahead/behind counts
    const { stdout: statusOutput } = await execAsync(
      `git rev-list --left-right --count ${branch}...${remoteName}/${branch}`,
      { cwd: repoPath }
    );

    const [ahead, behind] = statusOutput.trim().split('\t').map(Number);

    return NextResponse.json({
      hasRemote: true,
      remoteName,
      hasUpstream: true,
      ahead: ahead || 0,
      behind: behind || 0,
      isUpToDate: ahead === 0 && behind === 0,
    });
  } catch (error) {
    console.error('Remote status error:', error);
    return NextResponse.json({ hasRemote: false });
  }
}
