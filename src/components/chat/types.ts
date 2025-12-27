/**
 * Chat Types - Shared across chat components
 * Based on Claude Agent SDK types
 */

export interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  input?: string;
  output?: string;
  elapsed?: number;
  error?: string;
}

export interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
  durationMs?: number;
}

export interface ContextInfo {
  preTokens?: number;
  isCompacting?: boolean;
  trigger?: 'manual' | 'auto';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  usage?: UsageInfo;
}

export interface ChatState {
  sessionId: string | null;
  status: 'idle' | 'running' | 'completed' | 'error' | 'aborted';
  messages: Message[];
  streamingContent: string;
  streamingThinking: string;
  activeToolCalls: ToolCall[];
  lastUsage: UsageInfo | null;
  contextInfo: ContextInfo;
  sessionCost: number;
  error?: string;
}

/**
 * Chat Event Types (from server to client)
 * Mapped from SDK message types
 */
export type ChatEventType =
  | 'init'            // Session initialized (system/init)
  | 'text'            // Text streaming (content_block_delta/text_delta)
  | 'thinking'        // Thinking streaming (content_block_delta/thinking_delta)
  | 'thinking_start'  // Thinking block started (content_block_start/thinking)
  | 'tool_start'      // Tool execution started (content_block_start/tool_use)
  | 'tool_input'      // Tool input streaming (content_block_delta/input_json_delta)
  | 'tool_result'     // Tool result received (user message with tool_use_result)
  | 'tool_error'      // Tool execution failed
  | 'tool_progress'   // Tool progress update
  | 'block_stop'      // Content block ended (content_block_stop)
  | 'message_start'   // Message started (message_start)
  | 'message_delta'   // Message delta with stop_reason (message_delta)
  | 'message_stop'    // Message ended (message_stop)
  | 'status'          // Session status (compacting, etc.)
  | 'result'          // Final result with usage
  | 'auth_status'     // Authentication status updates
  | 'hook_response'   // Hook execution results
  | 'signature'       // Extended thinking signature
  | 'error';          // Error occurred

export interface ChatEvent {
  type: ChatEventType | string;
  data: unknown;
  ts: number;
}

// Event data types
export interface InitEventData {
  model: string;
  sessionId: string;
  tools?: string[];
  skills?: string[];
  slashCommands?: string[];  // Available slash commands
  mcpServers?: { name: string; status: string }[];
  permissionMode?: string;
}

export interface ToolStartEventData {
  id: string;
  name: string;
}

export interface ToolProgressEventData {
  id: string;
  name: string;
  elapsed: number;
}

export interface ToolResultEventData {
  id: string;
  output: unknown;
  isError?: boolean;
}

export interface StatusEventData {
  status: 'compacting' | null;
}

export interface ResultEventData {
  sessionId: string;
  costUsd?: number;
  turns?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  isError?: boolean;
  errors?: string[];
  modelUsage?: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    costUsd?: number;
    contextWindow?: number;
  }>;
}

export interface MessageStartEventData {
  id: string;
  model: string;
  role: string;
}

export interface MessageDeltaEventData {
  stopReason?: string;
  outputTokens?: number;
}

export interface AuthStatusEventData {
  isAuthenticating: boolean;
  output: string[];
  error?: string;
}

export interface HookResponseEventData {
  hookName: string;
  hookEvent: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
}

// Permission request from SDK
export interface PermissionRequest {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolUseId: string;
  status: 'pending' | 'approved' | 'denied';
  decisionReason?: string;
  blockedPath?: string;
  suggestions?: PermissionUpdate[];
}

export interface PermissionUpdate {
  type: 'allow_tool' | 'allow_path' | 'allow_command';
  tool?: string;
  path?: string;
  command?: string;
}

export interface PermissionRequestEventData {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolUseId: string;
  decisionReason?: string;
  blockedPath?: string;
  suggestions?: PermissionUpdate[];
}

export interface PermissionResponseData {
  id: string;
  approved: boolean;
  mode?: 'default' | 'acceptEdits';
  allowTools?: string[];
}
