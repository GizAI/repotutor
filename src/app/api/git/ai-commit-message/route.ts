import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json();

    // Get project root from env or use current directory
    const projectRoot = process.env.PROJECT_ROOT || process.cwd();

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

    // Call OpenAI to generate commit message
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that generates concise, conventional git commit messages.
Follow these rules:
1. Use conventional commit format: type(scope): description
2. Types: feat, fix, docs, style, refactor, test, chore, perf
3. Keep the message under 72 characters
4. Be specific but concise
5. Focus on what changed and why, not how
6. Return ONLY the commit message, nothing else`
        },
        {
          role: 'user',
          content: `Generate a git commit message for these changes:\n\n${truncatedDiff}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const message = completion.choices[0]?.message?.content?.trim() || 'chore: update files';

    return NextResponse.json({ message });
  } catch (error) {
    console.error('AI commit message error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to generate commit message'
    });
  }
}
