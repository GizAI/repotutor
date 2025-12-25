/**
 * Session Manager
 *
 * Factory Pattern: Creates appropriate strategy based on mode
 * Facade Pattern: Unified interface for all session operations
 */

import type {
  AIMode,
  AISessionStrategy,
  SessionState,
  SessionSummary,
  SessionContext,
  StreamEvent,
  Message,
  CreateSessionOptions,
} from './types';
import { sessionStorage } from './storage';
import { ClaudeCodeStrategy, type ClaudeCodeOptions } from './claude-strategy';
import { LangGraphStrategy, type LangGraphOptions } from './langgraph-strategy';

export interface ManagerConfig {
  rootPath: string;
  repoName: string;
  repoDescription?: string;
}

export class SessionManager {
  private config: ManagerConfig;
  private activeStrategy?: AISessionStrategy;
  private activeSession?: SessionState;

  constructor(config: ManagerConfig) {
    this.config = config;
  }

  // Factory Method: Create strategy based on mode
  private createStrategy(
    mode: AIMode,
    options?: { resume?: string; fork?: boolean }
  ): AISessionStrategy {
    const baseOptions = {
      rootPath: this.config.rootPath,
      repoName: this.config.repoName,
      repoDescription: this.config.repoDescription,
    };

    switch (mode) {
      case 'claude-code':
        return new ClaudeCodeStrategy({
          ...baseOptions,
          resume: options?.resume,
          forkSession: options?.fork,
        } as ClaudeCodeOptions);

      case 'deepagents':
        return new LangGraphStrategy({
          ...baseOptions,
          threadId: options?.resume,
        } as LangGraphOptions);

      default:
        throw new Error(`Unknown AI mode: ${mode}`);
    }
  }

  // Create new session
  create(options: CreateSessionOptions): SessionState {
    // Create storage session
    const session = sessionStorage.create(options.mode);

    // Create strategy
    let resumeId: string | undefined;
    if (options.resumeId) {
      const resumeSession = sessionStorage.get(options.resumeId);
      resumeId =
        options.mode === 'claude-code'
          ? resumeSession?.metadata.claudeSessionId
          : resumeSession?.metadata.threadId;
    }

    this.activeStrategy = this.createStrategy(options.mode, {
      resume: resumeId,
      fork: !!options.forkFrom,
    });

    this.activeSession = session;
    return session;
  }

  // Resume existing session
  resume(sessionId: string): SessionState | undefined {
    const session = sessionStorage.get(sessionId);
    if (!session) return undefined;

    // Create strategy with resume
    const resumeId =
      session.mode === 'claude-code'
        ? session.metadata.claudeSessionId
        : session.metadata.threadId;

    this.activeStrategy = this.createStrategy(session.mode, {
      resume: resumeId,
    });

    this.activeSession = session;
    return session;
  }

  // Send message and stream response
  async *send(
    message: string,
    context?: SessionContext
  ): AsyncGenerator<StreamEvent> {
    if (!this.activeStrategy || !this.activeSession) {
      throw new Error('No active session');
    }

    // Add user message to storage
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    sessionStorage.addMessage(this.activeSession.id, userMessage);

    // Build context with history
    const fullContext: SessionContext = {
      ...context,
      history: this.activeSession.messages,
    };

    // Stream response
    let assistantContent = '';
    let metadata: Message['metadata'] = {};

    for await (const event of this.activeStrategy.send(message, fullContext)) {
      // Accumulate assistant content
      if (event.type === 'text') {
        assistantContent += event.content;
      }

      // Capture metadata
      if (event.type === 'init') {
        metadata.model = event.model;
      }
      if (event.type === 'result') {
        metadata.costUsd = event.costUsd;

        // Update session metadata
        if (this.activeSession) {
          this.activeSession.metadata.claudeSessionId = event.sessionId;
          this.activeSession.metadata.totalCostUsd =
            (this.activeSession.metadata.totalCostUsd || 0) + event.costUsd;
          this.activeSession.metadata.totalTurns = event.turns;
          sessionStorage.update(this.activeSession.id, this.activeSession);
        }
      }

      yield event;
    }

    // Save assistant message
    if (assistantContent) {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        metadata,
      };
      sessionStorage.addMessage(this.activeSession.id, assistantMessage);
    }
  }

  // List sessions
  list(mode?: AIMode): SessionSummary[] {
    return sessionStorage.list(mode);
  }

  // Get recent sessions
  recent(limit = 10): SessionSummary[] {
    return sessionStorage.recent(limit);
  }

  // Delete session
  delete(sessionId: string): boolean {
    if (this.activeSession?.id === sessionId) {
      this.close();
    }
    return sessionStorage.delete(sessionId);
  }

  // Fork current session
  fork(): SessionState | undefined {
    if (!this.activeSession) return undefined;
    return sessionStorage.fork(this.activeSession.id);
  }

  // Abort current operation
  abort(): void {
    this.activeStrategy?.abort();
  }

  // Close current session
  close(): void {
    this.activeStrategy?.dispose();
    this.activeStrategy = undefined;
    this.activeSession = undefined;
  }

  // Get current session
  get current(): SessionState | undefined {
    return this.activeSession;
  }

  // Get current mode
  get mode(): AIMode | undefined {
    return this.activeSession?.mode;
  }

  // Check if can resume
  get canResume(): boolean {
    return this.activeStrategy?.canResume() ?? false;
  }
}

// Factory function for API routes
export function createSessionManager(config: ManagerConfig): SessionManager {
  return new SessionManager(config);
}
