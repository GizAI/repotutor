import { NextRequest } from 'next/server';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';

// Lazy load agent to avoid build-time errors
let agent: ReturnType<typeof import('@/lib/agent').getAgent> | null = null;

async function getAgentInstance() {
  if (!agent) {
    const { getAgent } = await import('@/lib/agent');
    agent = getAgent();
  }
  return agent;
}

// 현재 파일 내용 읽기 (최대 5000자)
function readCurrentFileContent(currentPath: string): string | null {
  try {
    const { toAbsolutePath, isInsideRepo } = require('@/lib/repo-config');
    const absolutePath = toAbsolutePath(currentPath);

    if (!isInsideRepo(absolutePath) || !fs.existsSync(absolutePath)) {
      return null;
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile() || stat.size > 100 * 1024) {
      return null;
    }

    // 바이너리 파일 제외
    const ext = path.extname(currentPath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.woff', '.woff2', '.ttf', '.ico'];
    if (binaryExts.includes(ext)) {
      return null;
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    return content.slice(0, 5000); // 최대 5000자
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, currentPath, history = [] } = await request.json();

    if (!message?.trim()) {
      return new Response('Message is required', { status: 400 });
    }

    // Build message history
    const messages: (HumanMessage | AIMessage)[] = [];

    // Add context about current file if provided
    let contextMessage = '';
    if (currentPath) {
      contextMessage = `[사용자가 현재 보고 있는 파일: ${currentPath}]\n`;

      // 파일 내용도 컨텍스트에 포함
      const fileContent = readCurrentFileContent(currentPath);
      if (fileContent) {
        contextMessage += `\n--- 현재 파일 내용 (처음 5000자) ---\n\`\`\`\n${fileContent}\n\`\`\`\n\n`;
      }
    }

    // Add history
    for (const h of history) {
      if (h.role === 'user') {
        messages.push(new HumanMessage(h.content));
      } else if (h.role === 'assistant') {
        messages.push(new AIMessage(h.content));
      }
    }

    // Add current message with context
    messages.push(new HumanMessage(contextMessage + message));

    // Get the agent
    const agentInstance = await getAgentInstance();

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use streaming from the agent
          const eventStream = agentInstance.streamEvents(
            { messages },
            { version: 'v2' }
          );

          for await (const event of eventStream) {
            // Handle different event types
            if (event.event === 'on_chat_model_stream') {
              const chunk = event.data?.chunk;
              if (chunk?.content) {
                // Handle string content
                if (typeof chunk.content === 'string') {
                  controller.enqueue(encoder.encode(chunk.content));
                }
                // Handle array content (for tool calls etc)
                else if (Array.isArray(chunk.content)) {
                  for (const part of chunk.content) {
                    if (part.type === 'text' && part.text) {
                      controller.enqueue(encoder.encode(part.text));
                    }
                  }
                }
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);

          // Fallback to non-streaming if streaming fails
          try {
            const result = await agentInstance.invoke({ messages });
            const lastMessage = result.messages[result.messages.length - 1];

            if (lastMessage && 'content' in lastMessage) {
              const content = typeof lastMessage.content === 'string'
                ? lastMessage.content
                : JSON.stringify(lastMessage.content);
              controller.enqueue(encoder.encode(content));
            }
          } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            controller.enqueue(encoder.encode('죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'));
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // More detailed error message for debugging
    const errorMessage = error instanceof Error
      ? `${error.name}: ${error.message}`
      : 'Unknown error occurred';

    return new Response(errorMessage, { status: 500 });
  }
}
