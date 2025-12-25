/**
 * Unified Chat API
 *
 * Single endpoint for both AI modes with full session support.
 * NDJSON streaming for real-time UI updates.
 */

import { NextRequest } from 'next/server';
import { getRepoConfig } from '@/lib/repo-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

interface ChatRequest {
  message: string;
  mode: 'claude-code' | 'deepagents';
  sessionId?: string;      // Resume existing session
  currentPath?: string;    // Current file being viewed
  history?: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Check auth - accept either cookie or Authorization header
  const password = process.env.REPOTUTOR_PASSWORD;

  if (password) {
    const authCookie = request.cookies.get('repotutor_auth');
    const authHeader = request.headers.get('authorization');

    const cookieValid = authCookie?.value === password;
    const headerValid = authHeader === `Bearer ${password}`;

    if (!cookieValid && !headerValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body: ChatRequest = await request.json();
    const { message, mode, sessionId, currentPath, history = [] } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config = getRepoConfig();

    // Create stream
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        try {
          if (mode === 'claude-code') {
            // Claude Code mode - full SDK power
            await streamClaudeCode({
              message,
              currentPath,
              sessionId,
              config,
              send,
            });
          } else {
            // DeepAgents mode - LangGraph
            await streamDeepAgents({
              message,
              currentPath,
              history,
              sessionId,
              config,
              send,
            });
          }

          controller.close();
        } catch (error) {
          send({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Claude Code streaming with full SDK features
async function streamClaudeCode(params: {
  message: string;
  currentPath?: string;
  sessionId?: string;
  config: ReturnType<typeof getRepoConfig>;
  send: (data: unknown) => void;
}) {
  const { message, currentPath, sessionId, config, send } = params;

  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  // Build prompt with context
  let prompt = message;
  if (currentPath) {
    prompt = `[현재 파일: ${currentPath}]\n\n${message}`;
  }

  const queryResult = query({
    prompt,
    options: {
      cwd: config.rootPath,
      includePartialMessages: true,

      // Session management
      resume: sessionId,
      persistSession: true,

      // System prompt
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `
## RepoTutor 컨텍스트
리포지토리: ${config.name}
${config.description ? `설명: ${config.description}` : ''}

항상 한국어로 응답하세요.
`,
      },

      // Full tool access
      tools: { type: 'preset', preset: 'claude_code' },

      // Limits
      maxTurns: 30,
      maxBudgetUsd: 1.0,
      enableFileCheckpointing: true,
    },
  });

  // Stream SDK messages
  for await (const sdkMsg of queryResult) {
    const m = sdkMsg as Record<string, unknown>;

    switch (m.type) {
      case 'system':
        if (m.subtype === 'init') {
          send({
            type: 'init',
            data: {
              model: m.model,
              tools: m.tools,
              sessionId: m.session_id,
            },
          });
        }
        break;

      case 'stream_event': {
        const event = m.event as Record<string, unknown>;

        if (event.type === 'content_block_delta') {
          const delta = event.delta as Record<string, unknown>;

          if (delta.type === 'text_delta') {
            send({ type: 'text', data: delta.text });
          } else if (delta.type === 'thinking_delta') {
            send({ type: 'thinking', data: delta.thinking });
          } else if (delta.type === 'input_json_delta') {
            send({ type: 'tool_input', data: delta.partial_json });
          }
        } else if (event.type === 'content_block_start') {
          const block = event.content_block as Record<string, unknown>;

          if (block.type === 'tool_use') {
            send({
              type: 'tool_start',
              data: { name: block.name, id: block.id },
            });
          }
        }
        break;
      }

      case 'tool_progress':
        send({
          type: 'tool_progress',
          data: {
            id: m.tool_use_id,
            name: m.tool_name,
            elapsed: m.elapsed_time_seconds,
          },
        });
        break;

      case 'result':
        send({
          type: 'result',
          data: {
            sessionId: m.session_id,
            costUsd: m.total_cost_usd,
            turns: m.num_turns,
            isError: m.is_error,
          },
        });
        break;
    }
  }
}

// DeepAgents streaming with LangGraph
async function streamDeepAgents(params: {
  message: string;
  currentPath?: string;
  history: Array<{ role: string; content: string }>;
  sessionId?: string;
  config: ReturnType<typeof getRepoConfig>;
  send: (data: unknown) => void;
}) {
  const { message, currentPath, history, sessionId, config, send } = params;

  const { ChatAnthropic } = await import('@langchain/anthropic');
  const { ChatOpenAI } = await import('@langchain/openai');
  const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
  const { MemorySaver } = await import('@langchain/langgraph');
  const { HumanMessage, AIMessage } = await import('@langchain/core/messages');
  const { repoTools } = await import('@/lib/agent/tools');

  // Choose model
  let model;
  let modelName: string;

  if (process.env.ANTHROPIC_API_KEY) {
    model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0.3,
    });
    modelName = 'claude-sonnet-4';
  } else if (process.env.OPENAI_API_KEY) {
    model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.3,
    });
    modelName = 'gpt-4o';
  } else {
    throw new Error('API key 없음');
  }

  // Memory saver
  const memorySaver = new MemorySaver();

  // System prompt
  const systemPrompt = `RepoTutor AI입니다.
리포지토리: ${config.name}
${config.description ? `설명: ${config.description}` : ''}

사용자의 코드베이스 탐색을 도와주세요. 한국어로 응답하세요.`;

  // Create agent
  const agent = createReactAgent({
    llm: model,
    tools: repoTools,
    messageModifier: systemPrompt,
    checkpointer: memorySaver,
  });

  // Build messages
  const messages: (HumanMessage | AIMessage)[] = [];

  for (const h of history) {
    if (h.role === 'user') {
      messages.push(new HumanMessage(h.content));
    } else if (h.role === 'assistant') {
      messages.push(new AIMessage(h.content));
    }
  }

  let fullMessage = message;
  if (currentPath) {
    fullMessage = `[현재 파일: ${currentPath}]\n\n${message}`;
  }
  messages.push(new HumanMessage(fullMessage));

  // Thread ID
  const threadId = sessionId || `thread-${Date.now()}`;

  // Send init
  send({
    type: 'init',
    data: {
      model: modelName,
      tools: repoTools.map((t) => t.name),
      sessionId: threadId,
    },
  });

  // Stream
  const stream = await agent.stream(
    { messages },
    {
      configurable: { thread_id: threadId },
      streamMode: 'values',
    }
  );

  let lastContent = '';
  let toolCount = 0;

  for await (const chunk of stream) {
    const msgs = chunk.messages || [];
    const lastMsg = msgs[msgs.length - 1];

    if (!lastMsg) continue;

    // Tool calls
    if (lastMsg.tool_calls?.length > 0) {
      for (const tc of lastMsg.tool_calls) {
        toolCount++;
        send({
          type: 'tool_start',
          data: { name: tc.name, id: tc.id || `tool-${toolCount}` },
        });
      }
    }

    // Text content
    const content = lastMsg.content;
    if (typeof content === 'string' && content !== lastContent) {
      const newContent = content.slice(lastContent.length);
      if (newContent) {
        send({ type: 'text', data: newContent });
      }
      lastContent = content;
    }
  }

  // Result
  send({
    type: 'result',
    data: {
      sessionId: threadId,
      costUsd: 0,
      turns: messages.length,
      isError: false,
    },
  });
}
