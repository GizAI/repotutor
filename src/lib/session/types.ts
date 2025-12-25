/**
 * Session Management Types
 *
 * Gang of Four Design Patterns:
 * - Strategy: AISessionStrategy for different AI backends
 * - Factory: SessionFactory for creating sessions
 * - Observer: SessionObserver for state changes
 */

export type AIMode = 'claude-code' | 'deepagents';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  costUsd?: number;
  tokens?: { input: number; output: number };
  toolCalls?: ToolCall[];
  thinkingContent?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: unknown;
  elapsed?: number;
}

export interface SessionState {
  id: string;
  mode: AIMode;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  // Claude Code specific
  claudeSessionId?: string;
  // LangGraph specific
  threadId?: string;
  checkpointId?: string;
  // Common
  totalCostUsd?: number;
  totalTurns?: number;
  model?: string;
}

export interface SessionSummary {
  id: string;
  mode: AIMode;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Strategy Pattern: AI Backend Interface
export interface AISessionStrategy {
  readonly mode: AIMode;

  // Core operations
  send(message: string, context?: SessionContext): AsyncGenerator<StreamEvent>;

  // Session management
  getSessionId(): string | undefined;
  canResume(): boolean;

  // Cleanup
  abort(): void;
  dispose(): void;
}

export interface SessionContext {
  currentPath?: string;
  fileContent?: string;
  history?: Message[];
}

// Stream events for real-time UI updates
export type StreamEvent =
  | { type: 'init'; model: string; tools: string[] }
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; toolName: string; toolId: string }
  | { type: 'tool_input'; content: string }
  | { type: 'tool_progress'; toolId: string; elapsed: number }
  | { type: 'tool_result'; toolId: string; result: unknown }
  | { type: 'result'; sessionId: string; costUsd: number; turns: number }
  | { type: 'error'; message: string };

// Observer Pattern: Session State Observer
export interface SessionObserver {
  onStateChange(state: SessionState): void;
  onMessage(message: Message): void;
  onToolCall(toolCall: ToolCall): void;
  onError(error: Error): void;
}

// Factory Pattern: Session Creation Options
export interface CreateSessionOptions {
  mode: AIMode;
  resumeId?: string;        // Resume existing session
  forkFrom?: string;        // Fork from existing session
  context?: SessionContext;
}

export interface ResumeSessionOptions {
  sessionId: string;
  atMessageId?: string;     // Resume at specific message
}
