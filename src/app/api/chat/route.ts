/**
 * Chat API
 *
 * Single endpoint for AI modes with full session support.
 * NDJSON streaming for real-time UI updates.
 *
 * Features:
 * - Claude Agent SDK with MCP support
 * - DeepAgents (LangGraph) mode
 * - Abort/cancel support
 * - Session management
 * - chrome-devtools-mcp for browser automation
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
  model?: string;          // Model selection (optional)
  maxTurns?: number;       // Override max turns
  maxBudget?: number;      // Override max budget USD
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
    const { message, mode, sessionId, currentPath, history = [], model, maxTurns, maxBudget } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config = getRepoConfig();

    // Create abort controller linked to request signal
    const abortController = new AbortController();

    // Link to request signal for client-side cancellation
    request.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    // Create stream
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
          } catch {
            // Stream closed, ignore
          }
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
              abortController,
              model,
              maxTurns,
              maxBudget,
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
              abortSignal: abortController.signal,
            });
          }

          controller.close();
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            send({
              type: 'aborted',
              data: { message: 'Request cancelled' },
            });
          } else {
            send({
              type: 'error',
              data: {
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            });
          }
          controller.close();
        }
      },
      cancel() {
        abortController.abort();
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
  abortController: AbortController;
  model?: string;
  maxTurns?: number;
  maxBudget?: number;
}) {
  const { message, currentPath, sessionId, config, send, abortController, model, maxTurns, maxBudget } = params;

  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  // Build prompt with context
  let prompt = message;
  if (currentPath) {
    prompt = `[현재 파일: ${currentPath}]\n\n${message}`;
  }

  // Track timing
  const startTime = Date.now();

  const queryResult = query({
    prompt,
    options: {
      cwd: config.rootPath,
      includePartialMessages: true,

      // Abort support
      abortController,

      // Session management
      resume: sessionId,
      persistSession: true,

      // Model selection (if provided)
      ...(model && { model }),

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

      // Full tool access with MCP servers
      tools: { type: 'preset', preset: 'claude_code' },

      // MCP servers for browser automation (Chrome on VNC display)
      mcpServers: {
        'chrome-devtools': {
          command: 'npx',
          args: ['chrome-devtools-mcp@latest'],
          env: {
            DISPLAY: process.env.VNC_DISPLAY || ':10',
            CHROME_REMOTE_DEBUGGING_PORT: process.env.CHROME_CDP_PORT || '9333',
          },
        },
      },

      // Limits (with overrides)
      maxTurns: maxTurns ?? 30,
      maxBudgetUsd: maxBudget ?? 1.0,
      enableFileCheckpointing: true,

      // Permission mode - bypass prompts for all tools including MCP
      permissionMode: 'bypassPermissions',

      // Hook events for monitoring
      hooks: {
        PreToolUse: [{
          hooks: [async (input: Record<string, unknown>) => {
            send({
              type: 'hook',
              data: {
                event: 'PreToolUse',
                tool: input.tool_name,
                timestamp: Date.now(),
              },
            });
            return { continue: true };
          }],
        }],
        PostToolUse: [{
          hooks: [async (input: Record<string, unknown>) => {
            send({
              type: 'hook',
              data: {
                event: 'PostToolUse',
                tool: input.tool_name,
                timestamp: Date.now(),
              },
            });
            return {};
          }],
        }],
        SessionStart: [{
          hooks: [async () => {
            send({
              type: 'hook',
              data: {
                event: 'SessionStart',
                timestamp: Date.now(),
              },
            });
            return {};
          }],
        }],
        SessionEnd: [{
          hooks: [async (input: Record<string, unknown>) => {
            send({
              type: 'hook',
              data: {
                event: 'SessionEnd',
                reason: input.reason,
                timestamp: Date.now(),
              },
            });
            return {};
          }],
        }],
      },
    },
  });

  // Track active content blocks
  let currentBlockType: string | null = null;
  let currentBlockId: string | null = null;

  // Stream SDK messages - handle ALL event types
  for await (const sdkMsg of queryResult) {
    // Check for abort
    if (abortController.signal.aborted) {
      try {
        queryResult.interrupt();
      } catch {
        // Ignore interrupt errors
      }
      break;
    }

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
              cwd: m.cwd,
            },
          });
        } else if (m.subtype === 'status') {
          // Context compaction status
          send({
            type: 'status',
            data: {
              status: m.status, // 'compacting' or null
            },
          });
        } else if (m.subtype === 'compact_boundary') {
          send({
            type: 'compact',
            data: {
              trigger: m.trigger,
              preTokens: m.pre_tokens,
            },
          });
        }
        break;

      case 'stream_event': {
        const event = m.event as Record<string, unknown>;

        // Message lifecycle events
        if (event.type === 'message_start') {
          const msg = event.message as Record<string, unknown>;
          send({
            type: 'message_start',
            data: {
              id: msg?.id,
              model: msg?.model,
              role: msg?.role,
            },
          });
        } else if (event.type === 'message_stop') {
          send({ type: 'message_stop', data: {} });
        } else if (event.type === 'message_delta') {
          const delta = event.delta as Record<string, unknown>;
          send({
            type: 'message_delta',
            data: {
              stopReason: delta?.stop_reason,
            },
          });
        }

        // Content block lifecycle
        else if (event.type === 'content_block_start') {
          const block = event.content_block as Record<string, unknown>;
          const index = event.index;
          currentBlockType = block.type as string;
          currentBlockId = block.id as string || `block-${index}`;

          if (block.type === 'tool_use') {
            send({
              type: 'tool_start',
              data: {
                name: block.name,
                id: block.id,
                index,
              },
            });
          } else if (block.type === 'thinking') {
            send({
              type: 'thinking_start',
              data: { index },
            });
          } else if (block.type === 'text') {
            send({
              type: 'text_start',
              data: { index },
            });
          } else if (block.type === 'mcp_tool_use') {
            send({
              type: 'mcp_tool_start',
              data: {
                serverName: block.server_name,
                toolName: block.name,
                id: block.id,
              },
            });
          } else if (block.type === 'server_tool_use') {
            send({
              type: 'server_tool_start',
              data: {
                name: block.name,
                id: block.id,
              },
            });
          }
        } else if (event.type === 'content_block_stop') {
          if (currentBlockType === 'thinking') {
            send({ type: 'thinking_stop', data: {} });
          } else if (currentBlockType === 'text') {
            send({ type: 'text_stop', data: {} });
          } else if (currentBlockType === 'tool_use') {
            send({ type: 'tool_end', data: { id: currentBlockId } });
          }
          currentBlockType = null;
          currentBlockId = null;
        }

        // Content deltas
        else if (event.type === 'content_block_delta') {
          const delta = event.delta as Record<string, unknown>;

          if (delta.type === 'text_delta') {
            send({ type: 'text', data: delta.text });
          } else if (delta.type === 'thinking_delta') {
            send({ type: 'thinking', data: delta.thinking });
          } else if (delta.type === 'input_json_delta') {
            send({ type: 'tool_input', data: delta.partial_json });
          } else if (delta.type === 'signature_delta') {
            send({ type: 'signature', data: delta.signature });
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

      case 'assistant':
        // Full assistant message - useful for history
        send({
          type: 'assistant_message',
          data: {
            id: m.message_id,
          },
        });
        break;

      case 'user':
        // User message echo
        send({
          type: 'user_message',
          data: {
            id: m.message_id,
          },
        });
        break;

      case 'result': {
        const endTime = Date.now();
        const durationMs = endTime - startTime;

        // Extract rich metadata
        const result = m as Record<string, unknown>;
        const usage = result.usage as Record<string, unknown> | undefined;

        send({
          type: 'result',
          data: {
            sessionId: result.session_id,
            costUsd: result.total_cost_usd,
            turns: result.num_turns,
            isError: result.is_error,
            durationMs,
            // Rich usage metadata
            usage: usage ? {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              cacheReadTokens: usage.cache_read_input_tokens,
              cacheCreationTokens: usage.cache_creation_input_tokens,
            } : undefined,
            // Error details if any
            errors: result.is_error ? result.errors : undefined,
            errorType: result.is_error ? result.error_type : undefined,
          },
        });
        break;
      }
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
  abortSignal: AbortSignal;
}) {
  const { message, currentPath, history, sessionId, config, send, abortSignal } = params;

  const { ChatAnthropic } = await import('@langchain/anthropic');
  const { ChatOpenAI } = await import('@langchain/openai');
  const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
  const { MemorySaver } = await import('@langchain/langgraph');
  const { HumanMessage, AIMessage } = await import('@langchain/core/messages');
  const { repoTools } = await import('@/lib/agent/tools');

  const startTime = Date.now();

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
  const messages: InstanceType<typeof HumanMessage | typeof AIMessage>[] = [];

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

  // Stream with abort support
  const stream = await agent.stream(
    { messages },
    {
      configurable: { thread_id: threadId },
      streamMode: 'values',
      signal: abortSignal,
    }
  );

  let lastContent = '';
  let toolCount = 0;

  try {
    for await (const chunk of stream) {
      if (abortSignal.aborted) break;

      const msgs = chunk.messages || [];
      const lastMsg = msgs[msgs.length - 1];

      if (!lastMsg) continue;

      // Tool calls (AIMessage has tool_calls property)
      const msgWithTools = lastMsg as { tool_calls?: Array<{ name: string; id?: string }> };
      if (msgWithTools.tool_calls?.length) {
        for (const tc of msgWithTools.tool_calls) {
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
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      send({ type: 'aborted', data: { message: 'Request cancelled' } });
      return;
    }
    throw error;
  }

  const endTime = Date.now();

  // Result
  send({
    type: 'result',
    data: {
      sessionId: threadId,
      costUsd: 0,
      turns: messages.length,
      isError: false,
      durationMs: endTime - startTime,
    },
  });
}
