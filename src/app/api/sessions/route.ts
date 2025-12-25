/**
 * Claude Sessions API
 *
 * Reads sessions directly from Claude's filesystem (~/.claude/projects/)
 * No database needed - uses Claude Code's native session storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { createReadStream } from 'fs';

interface ClaudeMessage {
  type: 'user' | 'assistant';
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }> | string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  timestamp?: string;
  sessionId?: string;
}

interface SessionSummary {
  id: string;
  mode: 'claude-code';
  title: string;
  preview: string;
  messageCount: number;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

// Get Claude projects directory
function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

// Parse a session JSONL file to extract summary info
async function parseSessionFile(filePath: string): Promise<{
  title: string;
  preview: string;
  messageCount: number;
  model?: string;
  createdAt: string;
  updatedAt: string;
} | null> {
  try {
    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let title = '';
    let preview = '';
    let messageCount = 0;
    let model: string | undefined;
    let createdAt = '';
    let updatedAt = '';

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line) as ClaudeMessage;

        // Track timestamps
        if (entry.timestamp) {
          if (!createdAt) createdAt = entry.timestamp;
          updatedAt = entry.timestamp;
        }

        // Count user/assistant messages
        if (entry.type === 'user' && entry.message) {
          messageCount++;

          // Get title from first user message
          if (!title && entry.message.content) {
            const content = Array.isArray(entry.message.content)
              ? entry.message.content.find(c => c.type === 'text')?.text || ''
              : entry.message.content;
            title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
          }
        }

        if (entry.type === 'assistant' && entry.message) {
          messageCount++;

          // Get model from first assistant message
          if (!model && entry.message.model) {
            model = entry.message.model;
          }

          // Get preview from last assistant message
          if (entry.message.content) {
            const content = Array.isArray(entry.message.content)
              ? entry.message.content.find(c => c.type === 'text')?.text || ''
              : entry.message.content;
            preview = content.slice(0, 100);
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    if (messageCount === 0) return null;

    return {
      title: title || '(제목 없음)',
      preview,
      messageCount,
      model,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

// Validate path segment (no path traversal)
function isValidPathSegment(segment: string): boolean {
  if (!segment) return false;
  // Reject path traversal attempts
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    return false;
  }
  // Only allow alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]+$/.test(segment);
}

// GET /api/sessions - List Claude sessions from filesystem
export async function GET(request: NextRequest) {
  // Check auth - accept either cookie or Authorization header
  const password = process.env.REPOTUTOR_PASSWORD;

  if (password) {
    const authCookie = request.cookies.get('repotutor_auth');
    const authHeader = request.headers.get('authorization');

    const cookieValid = authCookie?.value === password;
    const headerValid = authHeader === `Bearer ${password}`;

    if (!cookieValid && !headerValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '30');
  const projectPath = searchParams.get('project'); // e.g., "-home-reson-reson"

  // Validate projectPath if provided
  if (projectPath && !isValidPathSegment(projectPath)) {
    return NextResponse.json({ error: 'Invalid project path' }, { status: 400 });
  }

  try {
    const projectsDir = getClaudeProjectsDir();

    // List all projects
    const projects = await fs.readdir(projectsDir);

    const sessions: SessionSummary[] = [];

    for (const project of projects) {
      // Skip if specific project requested and doesn't match
      if (projectPath && project !== projectPath) continue;

      const projectDir = path.join(projectsDir, project);
      const stat = await fs.stat(projectDir);

      if (!stat.isDirectory()) continue;

      // Read all session files in this project
      const files = await fs.readdir(projectDir);
      const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of sessionFiles) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(projectDir, file);

        const summary = await parseSessionFile(filePath);
        if (summary) {
          sessions.push({
            id: sessionId,
            mode: 'claude-code',
            ...summary,
          });
        }
      }
    }

    // Sort by updated time, newest first
    sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Apply limit
    const limited = sessions.slice(0, limit);

    return NextResponse.json({
      sessions: limited,
      total: sessions.length,
    });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions', sessions: [] },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Not needed (Claude creates sessions automatically)
export async function POST() {
  return NextResponse.json(
    { error: 'Sessions are created automatically by Claude' },
    { status: 400 }
  );
}

// DELETE /api/sessions - Not supported (don't delete Claude's sessions)
export async function DELETE() {
  return NextResponse.json(
    { error: 'Deleting Claude sessions is not supported' },
    { status: 400 }
  );
}
