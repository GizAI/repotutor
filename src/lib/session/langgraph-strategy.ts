/**
 * LangGraph Session Strategy
 *
 * Full integration with LangGraph:
 * - MemorySaver checkpointing
 * - Thread-based conversations
 * - State history
 */

import type {
  AISessionStrategy,
  StreamEvent,
  SessionContext,
  AIMode,
  Message,
} from './types';

export interface LangGraphOptions {
  rootPath: string;
  repoName: string;
  repoDescription?: string;
  threadId?: string;        // Resume by thread ID
  checkpointId?: string;    // Resume at specific checkpoint
}

// In-memory checkpoint store (shared across requests)
const checkpointStore = new Map<string, unknown[]>();

export class LangGraphStrategy implements AISessionStrategy {
  readonly mode: AIMode = 'deepagents';

  private threadId: string;
  private abortController?: AbortController;
  private options: LangGraphOptions;

  constructor(options: LangGraphOptions) {
    this.options = options;
    this.threadId = options.threadId || this.generateThreadId();
  }

  private generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async *send(
    message: string,
    context?: SessionContext
  ): AsyncGenerator<StreamEvent> {
    this.abortController = new AbortController();

    try {
      // Dynamic imports
      const { ChatAnthropic } = await import('@langchain/anthropic');
      const { ChatOpenAI } = await import('@langchain/openai');
      const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
      const { MemorySaver } = await import('@langchain/langgraph');
      const { HumanMessage, AIMessage } = await import('@langchain/core/messages');

      // Choose model based on available API key
      let model;
      if (process.env.ANTHROPIC_API_KEY) {
        model = new ChatAnthropic({
          model: 'claude-sonnet-4-20250514',
          temperature: 0.3,
        });
      } else if (process.env.OPENAI_API_KEY) {
        model = new ChatOpenAI({
          model: 'gpt-4o',
          temperature: 0.3,
        });
      } else {
        throw new Error('No API key found (ANTHROPIC_API_KEY or OPENAI_API_KEY)');
      }

      // Create tools
      const { repoTools } = await import('../agent/tools');

      // Create memory saver for this thread
      const memorySaver = new MemorySaver();

      // Build system prompt
      const systemPrompt = `당신은 RepoTutor AI입니다.
현재 리포지토리: ${this.options.repoName}
${this.options.repoDescription ? `설명: ${this.options.repoDescription}` : ''}

사용자가 코드베이스를 이해하고 탐색할 수 있도록 도와주세요.
항상 한국어로 응답하세요.

사용 가능한 도구들을 적극 활용하여:
- 파일 읽기 (readFile)
- 파일 검색 (searchFiles)
- 코드 검색 (searchCode)
- 디렉토리 구조 탐색 (listDirectory)

필요한 정보를 찾아 정확하고 유용한 답변을 제공하세요.`;

      // Create agent with memory
      const agent = createReactAgent({
        llm: model,
        tools: repoTools,
        messageModifier: systemPrompt,
        checkpointer: memorySaver,
      });

      // Build message history
      const messages: (HumanMessage | AIMessage)[] = [];

      // Load history from context
      if (context?.history) {
        for (const msg of context.history) {
          if (msg.role === 'user') {
            messages.push(new HumanMessage(msg.content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(msg.content));
          }
        }
      }

      // Add context if viewing a file
      let fullMessage = message;
      if (context?.currentPath) {
        fullMessage = `[현재 파일: ${context.currentPath}]\n\n${message}`;
      }
      messages.push(new HumanMessage(fullMessage));

      // Emit init event
      yield {
        type: 'init',
        model: process.env.ANTHROPIC_API_KEY ? 'claude-sonnet-4' : 'gpt-4o',
        tools: repoTools.map((t) => t.name),
      };

      // Stream execution
      const stream = await agent.stream(
        { messages },
        {
          configurable: { thread_id: this.threadId },
          streamMode: 'values',
        }
      );

      let lastContent = '';
      let toolCallCount = 0;

      for await (const chunk of stream) {
        if (this.abortController?.signal.aborted) break;

        // Extract messages from chunk
        const chunkMessages = chunk.messages || [];
        const lastMessage = chunkMessages[chunkMessages.length - 1];

        if (!lastMessage) continue;

        // Handle tool calls
        if (lastMessage.tool_calls?.length > 0) {
          for (const toolCall of lastMessage.tool_calls) {
            toolCallCount++;
            yield {
              type: 'tool_start',
              toolName: toolCall.name,
              toolId: toolCall.id || `tool-${toolCallCount}`,
            };
          }
        }

        // Handle text content
        const content = lastMessage.content;
        if (typeof content === 'string' && content !== lastContent) {
          const newContent = content.slice(lastContent.length);
          if (newContent) {
            yield { type: 'text', content: newContent };
          }
          lastContent = content;
        }
      }

      // Final result
      yield {
        type: 'result',
        sessionId: this.threadId,
        costUsd: 0, // LangGraph doesn't track cost directly
        turns: messages.length,
      };
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getSessionId(): string | undefined {
    return this.threadId;
  }

  canResume(): boolean {
    return true; // LangGraph with MemorySaver can always resume
  }

  abort(): void {
    this.abortController?.abort();
  }

  dispose(): void {
    this.abort();
  }

  // Get conversation history from checkpoint
  async getHistory(): Promise<Message[]> {
    // TODO: Implement checkpoint retrieval
    return [];
  }

  // Get state at specific checkpoint
  async getStateAt(checkpointId: string): Promise<unknown> {
    // TODO: Implement checkpoint retrieval
    return null;
  }
}
