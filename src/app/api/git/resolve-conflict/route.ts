import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { getCurrentProjectPath } from '@/lib/giz-config';

const execAsync = promisify(exec);

function getRepoPath(): string {
  return getCurrentProjectPath() || process.cwd();
}

interface ResolveRequest {
  file: string;
  hunkId: number;
  resolution: 'current' | 'incoming' | 'both' | 'manual';
  content?: string; // For manual resolution
}

// POST: Resolve a single conflict hunk
export async function POST(request: NextRequest) {
  try {
    const repoPath = getRepoPath();
    const body: ResolveRequest = await request.json();
    const { file, hunkId, resolution, content } = body;

    if (!file) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const fullPath = path.join(repoPath, file);
    let fileContent: string;

    try {
      fileContent = await fs.readFile(fullPath, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Find and replace the specific conflict hunk
    const lines = fileContent.split('\n');
    const newLines: string[] = [];

    let inConflict = false;
    let currentHunkId = 0;
    let section: 'current' | 'base' | 'incoming' | null = null;
    let currentContent: string[] = [];
    let baseContent: string[] = [];
    let incomingContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        section = 'current';
        currentContent = [];
        baseContent = [];
        incomingContent = [];
      } else if (line.startsWith('|||||||') && inConflict) {
        section = 'base';
      } else if (line.startsWith('=======') && inConflict) {
        section = 'incoming';
      } else if (line.startsWith('>>>>>>>') && inConflict) {
        // End of conflict - resolve based on hunkId
        if (currentHunkId === hunkId) {
          // Apply resolution
          switch (resolution) {
            case 'current':
              newLines.push(...currentContent);
              break;
            case 'incoming':
              newLines.push(...incomingContent);
              break;
            case 'both':
              newLines.push(...currentContent);
              if (currentContent.length > 0 && incomingContent.length > 0) {
                newLines.push(''); // Add separator
              }
              newLines.push(...incomingContent);
              break;
            case 'manual':
              if (content !== undefined) {
                newLines.push(...content.split('\n'));
              }
              break;
          }
        } else {
          // Keep this conflict unresolved
          newLines.push('<<<<<<<');
          newLines.push(...currentContent);
          if (baseContent.length > 0) {
            newLines.push('|||||||');
            newLines.push(...baseContent);
          }
          newLines.push('=======');
          newLines.push(...incomingContent);
          newLines.push(line); // Keep the >>>>>>> marker
        }

        inConflict = false;
        section = null;
        currentHunkId++;
      } else if (inConflict) {
        // Collect content for current section
        if (section === 'current') {
          currentContent.push(line);
        } else if (section === 'base') {
          baseContent.push(line);
        } else if (section === 'incoming') {
          incomingContent.push(line);
        }
      } else {
        // Normal line, keep as is
        newLines.push(line);
      }
    }

    // Write back to file
    await fs.writeFile(fullPath, newLines.join('\n'));

    // Check if file still has conflicts
    const updatedContent = await fs.readFile(fullPath, 'utf-8');
    const hasRemainingConflicts = updatedContent.includes('<<<<<<<');

    // If no more conflicts, stage the file
    if (!hasRemainingConflicts) {
      await execAsync(`git add "${file}"`, { cwd: repoPath });
    }

    return NextResponse.json({
      success: true,
      hasRemainingConflicts,
      message: hasRemainingConflicts
        ? 'Hunk resolved, more conflicts remain'
        : 'File fully resolved and staged',
    });

  } catch (error) {
    console.error('Resolve conflict error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve conflict', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT: Resolve entire file with a strategy
export async function PUT(request: NextRequest) {
  try {
    const repoPath = getRepoPath();
    const body = await request.json();
    const { file, strategy } = body;

    if (!file) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    let command: string;

    switch (strategy) {
      case 'ours':
        command = `git checkout --ours "${file}" && git add "${file}"`;
        break;
      case 'theirs':
        command = `git checkout --theirs "${file}" && git add "${file}"`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 });
    }

    await execAsync(command, { cwd: repoPath });

    return NextResponse.json({
      success: true,
      message: `File resolved using ${strategy} strategy`,
    });

  } catch (error) {
    console.error('Resolve file error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve file', details: (error as Error).message },
      { status: 500 }
    );
  }
}
