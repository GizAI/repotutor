/**
 * Single Claude Session API
 *
 * Reads session content from Claude's filesystem.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { createReadStream } from 'fs';

interface ClaudeEntry {
  type: string;
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
  cwd?: string;
  gitBranch?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

// Validate session ID (UUID or agent-XX format, no path traversal)
function isValidSessionId(id: string): boolean {
  if (!id) return false;
  // Reject path traversal attempts
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return false;
  }
  // UUID format or agent-XX format
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const agentRegex = /^agent-[a-f0-9]{2}$/i;
  const shortIdRegex = /^[a-f0-9]{8}$/i;
  return uuidRegex.test(id) || agentRegex.test(id) || shortIdRegex.test(id);
}

// Find session file across all projects
async function findSessionFile(sessionId: string): Promise<string | null> {
  // Validate session ID format first
  if (!isValidSessionId(sessionId)) {
    return null;
  }

  const projectsDir = path.join(os.homedir(), '.claude', 'projects');

  try {
    const projects = await fs.readdir(projectsDir);

    for (const project of projects) {
      const filePath = path.join(projectsDir, project, `${sessionId}.jsonl`);

      // Extra safety: ensure resolved path is within projects directory
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(projectsDir)) {
        continue;
      }

      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // File doesn't exist in this project
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  return null;
}

// Parse full session content
async function parseFullSession(filePath: string): Promise<{
  messages: Message[];
  metadata: {
    cwd?: string;
    gitBranch?: string;
    model?: string;
  };
}> {
  const messages: Message[] = [];
  const metadata: { cwd?: string; gitBranch?: string; model?: string } = {};

  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let messageIndex = 0;

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line) as ClaudeEntry;

      // Extract metadata
      if (entry.cwd && !metadata.cwd) metadata.cwd = entry.cwd;
      if (entry.gitBranch && !metadata.gitBranch) metadata.gitBranch = entry.gitBranch;

      // Extract messages
      if ((entry.type === 'user' || entry.type === 'assistant') && entry.message) {
        let content = '';

        if (Array.isArray(entry.message.content)) {
          content = entry.message.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n');
        } else if (typeof entry.message.content === 'string') {
          content = entry.message.content;
        }

        if (content) {
          const msg: Message = {
            id: `msg-${messageIndex++}`,
            role: entry.type as 'user' | 'assistant',
            content,
            timestamp: entry.timestamp || new Date().toISOString(),
          };

          if (entry.type === 'assistant' && entry.message.model) {
            msg.model = entry.message.model;
            if (!metadata.model) metadata.model = entry.message.model;
          }

          messages.push(msg);
        }
      }
    } catch {
      // Skip invalid lines
    }
  }

  return { messages, metadata };
}

// GET /api/sessions/[id] - Get session details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Simple password auth
  const authHeader = request.headers.get('authorization');
  const password = process.env.REPOTUTOR_PASSWORD;

  if (password && authHeader !== `Bearer ${password}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const filePath = await findSessionFile(id);
  if (!filePath) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const { messages, metadata } = await parseFullSession(filePath);

    // Get file stats for timestamps
    const stats = await fs.stat(filePath);

    return NextResponse.json({
      session: {
        id,
        mode: 'claude-code',
        title: messages[0]?.content.slice(0, 50) || '(제목 없음)',
        messages,
        metadata,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to read session:', error);
    return NextResponse.json(
      { error: 'Failed to read session' },
      { status: 500 }
    );
  }
}

// PUT/POST/DELETE - Not supported (Claude manages sessions)
export async function PUT() {
  return NextResponse.json(
    { error: 'Modifying Claude sessions is not supported' },
    { status: 400 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Use the chat API to send messages' },
    { status: 400 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Deleting Claude sessions is not supported' },
    { status: 400 }
  );
}
