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

interface CommitNode {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  email: string;
  date: string;
  relativeDate: string;
  branches: string[];
  tags: string[];
  isHead: boolean;
}

interface GraphData {
  commits: CommitNode[];
  branches: string[];
  currentBranch: string;
}

// GET: Get commit graph data
export async function GET(request: NextRequest) {
  try {
    const repoPath = getRepoPath();
    const gitDir = path.join(repoPath, '.git');

    if (!fs.existsSync(gitDir)) {
      return NextResponse.json({ error: 'Not a git repository' }, { status: 400 });
    }

    // Check if repo has commits
    try {
      await execAsync('git rev-parse HEAD', { cwd: repoPath });
    } catch {
      return NextResponse.json({
        commits: [],
        branches: [],
        currentBranch: 'main',
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const branch = searchParams.get('branch') || '--all';

    // Get current branch
    const { stdout: currentBranchOutput } = await execAsync(
      'git branch --show-current',
      { cwd: repoPath }
    );
    const currentBranch = currentBranchOutput.trim();

    // Get all branches
    const { stdout: branchesOutput } = await execAsync(
      'git branch -a --format="%(refname:short)"',
      { cwd: repoPath }
    );
    const branches = branchesOutput.split('\n').filter(Boolean);

    // Get commit graph with parent info
    // Format: hash|parents|author|email|date|relativeDate|subject|decorations
    const format = '%H|%P|%an|%ae|%ai|%ar|%s|%D';
    const branchArg = branch === '--all' ? '--all' : branch;

    const { stdout: logOutput } = await execAsync(
      `git log ${branchArg} --format="${format}" -n ${limit}`,
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );

    const commits: CommitNode[] = [];
    const lines = logOutput.split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 7) continue;

      const [hash, parentsStr, author, email, date, relativeDate, message, decorations = ''] = parts;
      const parents = parentsStr ? parentsStr.split(' ').filter(Boolean) : [];

      // Parse decorations to extract branches and tags
      const commitBranches: string[] = [];
      const tags: string[] = [];
      let isHead = false;

      if (decorations) {
        const decParts = decorations.split(', ');
        for (const dec of decParts) {
          if (dec === 'HEAD') {
            isHead = true;
          } else if (dec.startsWith('HEAD -> ')) {
            isHead = true;
            commitBranches.push(dec.replace('HEAD -> ', ''));
          } else if (dec.startsWith('tag: ')) {
            tags.push(dec.replace('tag: ', ''));
          } else if (dec.startsWith('origin/')) {
            // Remote branch
            commitBranches.push(dec);
          } else if (!dec.includes('->')) {
            // Local branch
            commitBranches.push(dec);
          }
        }
      }

      commits.push({
        hash,
        shortHash: hash.slice(0, 7),
        parents,
        message,
        author,
        email,
        date,
        relativeDate,
        branches: commitBranches,
        tags,
        isHead,
      });
    }

    const graphData: GraphData = {
      commits,
      branches,
      currentBranch,
    };

    return NextResponse.json(graphData);

  } catch (error) {
    console.error('Git graph error:', error);
    return NextResponse.json(
      { error: 'Failed to get commit graph', details: (error as Error).message },
      { status: 500 }
    );
  }
}
