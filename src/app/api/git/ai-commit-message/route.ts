import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentProjectPath } from '@/lib/giz-config';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json();

    // Get project root from current project config
    const projectRoot = getCurrentProjectPath() || process.cwd();

    // Get the diff for changed files
    let diff = '';
    if (files && files.length > 0) {
      // Get diff for selected files
      const { stdout } = await execAsync(
        `git diff --staged -- ${files.map((f: string) => `"${f}"`).join(' ')} 2>/dev/null || git diff -- ${files.map((f: string) => `"${f}"`).join(' ')}`,
        { cwd: projectRoot, maxBuffer: 1024 * 1024 }
      );
      diff = stdout;
    } else {
      // Get all staged diff or all unstaged diff
      try {
        const { stdout: staged } = await execAsync('git diff --staged', { cwd: projectRoot, maxBuffer: 1024 * 1024 });
        diff = staged;
      } catch {
        const { stdout: unstaged } = await execAsync('git diff', { cwd: projectRoot, maxBuffer: 1024 * 1024 });
        diff = unstaged;
      }
    }

    if (!diff.trim()) {
      // Try to get status for untracked files
      const { stdout: status } = await execAsync('git status --short', { cwd: projectRoot });
      if (status.trim()) {
        diff = `Changed files:\n${status}`;
      } else {
        return NextResponse.json({ error: 'No changes to commit' });
      }
    }

    // Truncate diff if too long
    const maxDiffLength = 8000;
    const truncatedDiff = diff.length > maxDiffLength
      ? diff.substring(0, maxDiffLength) + '\n... (diff truncated)'
      : diff;

    // Call Claude API to generate commit message
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a concise git commit message for these changes. Follow conventional commit format: type(scope): description. Types: feat, fix, docs, style, refactor, test, chore, perf. Keep under 72 characters. Return ONLY the commit message, nothing else.

Changes:
${truncatedDiff}`
        }
      ],
    });

    const message = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : 'chore: update files';

    return NextResponse.json({ message });
  } catch (error) {
    console.error('AI commit message error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate commit message'
    });
  }
}
