import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getCurrentProjectPath } from '@/lib/giz-config';

const execAsync = promisify(exec);

function getRepoPath(): string {
  return getCurrentProjectPath() || process.cwd();
}

interface StashEntry {
  index: number;
  message: string;
  branch: string;
  date: string;
  files: number;
}

// GET: List all stashes
export async function GET() {
  try {
    const repoPath = getRepoPath();
    const gitDir = path.join(repoPath, '.git');

    if (!fs.existsSync(gitDir)) {
      return NextResponse.json({ error: 'Not a git repository' }, { status: 400 });
    }

    // Get stash list with format: index|message|date
    const { stdout } = await execAsync(
      'git stash list --format="%gd|%s|%ar"',
      { cwd: repoPath }
    );

    const stashes: StashEntry[] = [];
    const lines = stdout.split('\n').filter(Boolean);

    for (const line of lines) {
      const [ref, message, date] = line.split('|');
      const indexMatch = ref.match(/stash@\{(\d+)\}/);
      const index = indexMatch ? parseInt(indexMatch[1]) : 0;

      // Extract branch from message (format: "WIP on branch: message" or "On branch: message")
      const branchMatch = message.match(/(?:WIP on|On) ([^:]+):/);
      const branch = branchMatch ? branchMatch[1] : '';
      const cleanMessage = message.replace(/^(?:WIP on|On) [^:]+: /, '');

      // Get file count for this stash
      let files = 0;
      try {
        const { stdout: diffOutput } = await execAsync(
          `git stash show stash@{${index}} --stat | tail -1`,
          { cwd: repoPath }
        );
        const filesMatch = diffOutput.match(/(\d+) files? changed/);
        files = filesMatch ? parseInt(filesMatch[1]) : 0;
      } catch {
        // Ignore errors getting file count
      }

      stashes.push({
        index,
        message: cleanMessage,
        branch,
        date,
        files,
      });
    }

    return NextResponse.json({ stashes });
  } catch (error) {
    console.error('Git stash list error:', error);
    return NextResponse.json(
      { error: 'Failed to list stashes', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: Create, apply, pop, or drop stash
export async function POST(request: NextRequest) {
  try {
    const repoPath = getRepoPath();
    const gitDir = path.join(repoPath, '.git');

    if (!fs.existsSync(gitDir)) {
      return NextResponse.json({ error: 'Not a git repository' }, { status: 400 });
    }

    const body = await request.json();
    const { action, index, message } = body;

    let command: string;
    let successMessage: string;

    switch (action) {
      case 'create':
        // Create new stash
        command = message
          ? `git stash push -m "${message.replace(/"/g, '\\"')}"`
          : 'git stash push';
        successMessage = 'Stash created';
        break;

      case 'apply':
        // Apply stash without removing
        command = index !== undefined ? `git stash apply stash@{${index}}` : 'git stash apply';
        successMessage = 'Stash applied';
        break;

      case 'pop':
        // Apply and remove stash
        command = index !== undefined ? `git stash pop stash@{${index}}` : 'git stash pop';
        successMessage = 'Stash popped';
        break;

      case 'drop':
        // Remove stash without applying
        if (index === undefined) {
          return NextResponse.json({ error: 'Index required for drop' }, { status: 400 });
        }
        command = `git stash drop stash@{${index}}`;
        successMessage = 'Stash dropped';
        break;

      case 'show':
        // Show stash diff
        const showIndex = index !== undefined ? index : 0;
        const { stdout: diffOutput } = await execAsync(
          `git stash show -p stash@{${showIndex}}`,
          { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
        );
        return NextResponse.json({ diff: diffOutput });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await execAsync(command, { cwd: repoPath });
    return NextResponse.json({ success: true, message: successMessage });

  } catch (error) {
    console.error('Git stash error:', error);
    const errorMessage = (error as Error).message;

    // Handle specific errors
    if (errorMessage.includes('No local changes to save')) {
      return NextResponse.json({ error: 'No changes to stash' }, { status: 400 });
    }
    if (errorMessage.includes('CONFLICT')) {
      return NextResponse.json({
        error: 'Conflict occurred while applying stash',
        hasConflict: true,
        details: errorMessage
      }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Stash operation failed', details: errorMessage },
      { status: 500 }
    );
  }
}
