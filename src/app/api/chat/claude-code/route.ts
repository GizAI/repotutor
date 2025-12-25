/**
 * Claude Code Agent API Route
 *
 * Uses Claude Agent SDK to provide full Claude Code capabilities
 * with real-time tool execution streaming
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    const { message, currentPath, history = [] } = await request.json();

    if (!message?.trim()) {
      return new Response('Message is required', { status: 400 });
    }

    // Dynamically import SDK to avoid build-time issues
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const { getRepoConfig } = await import('@/lib/repo-config');
    const config = getRepoConfig();

    // Build context
    let contextMessage = '';
    if (currentPath) {
      contextMessage = `[사용자가 현재 보고 있는 파일: ${currentPath}]\n\n`;
    }

    const fullPrompt = contextMessage + message;

    // Create encoder for streaming
    const encoder = new TextEncoder();

    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Query Claude Code
          const queryResult = query({
            prompt: fullPrompt,
            options: {
              cwd: config.rootPath,
              includePartialMessages: true,
              systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
                append: `
## RepoTutor 컨텍스트
당신은 RepoTutor AI입니다. 사용자가 코드베이스를 탐색하고 이해할 수 있도록 도와줍니다.
현재 리포지토리: ${config.name}
${config.description ? `설명: ${config.description}` : ''}

항상 한국어로 응답해주세요.
`,
              },
              allowedTools: [
                'Read',
                'Glob',
                'Grep',
                'Bash',
                'Write',
                'Edit',
                'WebFetch',
                'WebSearch',
              ],
              maxTurns: 20,
              maxBudgetUsd: 0.5,
            },
          });

          // Stream messages
          for await (const sdkMessage of queryResult) {
            // Send different message types
            const chunk = {
              type: sdkMessage.type,
              data: null as unknown,
            };

            switch (sdkMessage.type) {
              case 'system':
                if (sdkMessage.subtype === 'init') {
                  chunk.data = {
                    subtype: 'init',
                    tools: sdkMessage.tools,
                    model: sdkMessage.model,
                  };
                }
                break;

              case 'stream_event':
                // Handle streaming content
                const event = sdkMessage.event;
                if (event.type === 'content_block_delta') {
                  const delta = event.delta;
                  if (delta.type === 'text_delta') {
                    chunk.data = {
                      subtype: 'text',
                      content: delta.text,
                    };
                  } else if (delta.type === 'thinking_delta') {
                    chunk.data = {
                      subtype: 'thinking',
                      content: delta.thinking,
                    };
                  } else if (delta.type === 'input_json_delta') {
                    chunk.data = {
                      subtype: 'tool_input',
                      content: delta.partial_json,
                    };
                  }
                } else if (event.type === 'content_block_start') {
                  const block = event.content_block;
                  if (block.type === 'tool_use') {
                    chunk.data = {
                      subtype: 'tool_start',
                      toolName: block.name,
                      toolId: block.id,
                    };
                  }
                }
                break;

              case 'assistant':
                // Full assistant message
                const assistantMsg = sdkMessage.message;
                const content = assistantMsg.content;
                chunk.data = {
                  subtype: 'assistant',
                  content: content,
                };
                break;

              case 'tool_progress':
                chunk.data = {
                  subtype: 'tool_progress',
                  toolName: sdkMessage.tool_name,
                  toolId: sdkMessage.tool_use_id,
                  elapsed: sdkMessage.elapsed_time_seconds,
                };
                break;

              case 'result':
                chunk.data = {
                  subtype: sdkMessage.subtype,
                  isError: sdkMessage.is_error,
                  numTurns: sdkMessage.num_turns,
                  costUsd: sdkMessage.total_cost_usd,
                };
                break;
            }

            if (chunk.data) {
              const line = JSON.stringify(chunk) + '\n';
              controller.enqueue(encoder.encode(line));
            }
          }

          controller.close();
        } catch (error) {
          console.error('Claude Code error:', error);
          const errorChunk = {
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorChunk) + '\n'));
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
    console.error('Claude Code API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
