/**
 * Claude Code Session Strategy
 *
 * Full integration with Claude Agent SDK:
 * - Session persistence (resume, fork, continue)
 * - Real-time streaming
 * - Tool execution visualization
 * - Cost tracking
 */

import type {
  AISessionStrategy,
  StreamEvent,
  SessionContext,
  AIMode,
} from './types';

export interface ClaudeCodeOptions {
  rootPath: string;
  repoName: string;
  repoDescription?: string;
  resume?: string;        // Resume session by ID
  forkSession?: boolean;  // Fork instead of continue
  continue?: boolean;     // Continue most recent
}

export class ClaudeCodeStrategy implements AISessionStrategy {
  readonly mode: AIMode = 'claude-code';

  private sessionId?: string;
  private abortController?: AbortController;
  private options: ClaudeCodeOptions;

  constructor(options: ClaudeCodeOptions) {
    this.options = options;
  }

  async *send(
    message: string,
    context?: SessionContext
  ): AsyncGenerator<StreamEvent> {
    this.abortController = new AbortController();

    // Build context-aware prompt
    let fullPrompt = message;
    if (context?.currentPath) {
      fullPrompt = `[현재 파일: ${context.currentPath}]\n\n${message}`;
    }

    try {
      // Dynamic import to avoid build issues
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const queryResult = query({
        prompt: fullPrompt,
        options: {
          cwd: this.options.rootPath,
          includePartialMessages: true,

          // Session management - full SDK power
          resume: this.options.resume,
          forkSession: this.options.forkSession,
          continue: this.options.continue,
          persistSession: true,

          // System prompt
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: `
## RepoTutor Context
현재 리포지토리: ${this.options.repoName}
${this.options.repoDescription ? `설명: ${this.options.repoDescription}` : ''}

항상 한국어로 응답해주세요. 코드 설명과 주석도 한국어로 작성하세요.
`,
          },

          // Tools configuration
          tools: { type: 'preset', preset: 'claude_code' },

          // Limits
          maxTurns: 30,
          maxBudgetUsd: 1.0,

          // Enable file checkpointing for rewind
          enableFileCheckpointing: true,
        },
      });

      // Stream and parse SDK messages
      for await (const sdkMessage of queryResult) {
        // Capture session ID from any message
        if ('session_id' in sdkMessage && sdkMessage.session_id) {
          this.sessionId = sdkMessage.session_id;
        }

        // Parse and yield appropriate events
        const events = this.parseSDKMessage(sdkMessage);
        for (const event of events) {
          yield event;
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parseSDKMessage(msg: unknown): StreamEvent[] {
    const events: StreamEvent[] = [];
    const m = msg as Record<string, unknown>;

    switch (m.type) {
      case 'system':
        if (m.subtype === 'init') {
          events.push({
            type: 'init',
            model: m.model as string,
            tools: m.tools as string[],
          });
        }
        break;

      case 'stream_event': {
        const event = m.event as Record<string, unknown>;
        if (event.type === 'content_block_delta') {
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === 'text_delta') {
            events.push({ type: 'text', content: delta.text as string });
          } else if (delta.type === 'thinking_delta') {
            events.push({ type: 'thinking', content: delta.thinking as string });
          } else if (delta.type === 'input_json_delta') {
            events.push({ type: 'tool_input', content: delta.partial_json as string });
          }
        } else if (event.type === 'content_block_start') {
          const block = event.content_block as Record<string, unknown>;
          if (block.type === 'tool_use') {
            events.push({
              type: 'tool_start',
              toolName: block.name as string,
              toolId: block.id as string,
            });
          }
        }
        break;
      }

      case 'tool_progress':
        events.push({
          type: 'tool_progress',
          toolId: m.tool_use_id as string,
          elapsed: m.elapsed_time_seconds as number,
        });
        break;

      case 'result':
        events.push({
          type: 'result',
          sessionId: m.session_id as string,
          costUsd: m.total_cost_usd as number,
          turns: m.num_turns as number,
        });
        break;
    }

    return events;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  canResume(): boolean {
    return !!this.sessionId;
  }

  abort(): void {
    this.abortController?.abort();
  }

  dispose(): void {
    this.abort();
    this.sessionId = undefined;
  }

  // Additional SDK capabilities

  async interrupt(): Promise<void> {
    // TODO: Implement query.interrupt() when available
  }

  async rewindFiles(messageId: string): Promise<void> {
    // TODO: Implement query.rewindFiles() when available
  }
}
