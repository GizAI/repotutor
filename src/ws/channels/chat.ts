/**
 * Chat Channel - Claude Agent Sessions
 *
 * Features:
 * - Session persistence across browser refresh
 * - Event buffering for replay on reconnect
 * - Background execution continues when disconnected
 * - Uses logged-in Claude CLI credentials (no API key needed)
 */

import { Server, Socket } from 'socket.io';
import { Channel } from './index';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

type SessionState = 'running' | 'completed' | 'error' | 'aborted';

interface Event { type: string; data: unknown; ts: number; }

// Pending permission request
interface PendingPermission {
  resolve: (result: { allowed: boolean; permissionsUpdate?: unknown[] }) => void;
  reject: (error: Error) => void;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolUseId: string;
}

interface Session {
  id: string;
  sdkSessionId?: string;
  state: SessionState;
  startedAt: number;
  endedAt?: number;
  buffer: Event[];
  emitter: EventEmitter;
  abort?: AbortController;
  result?: { costUsd?: number; turns?: number; durationMs?: number };
  error?: string;
  cwd: string;
  model?: string;
  title?: string;
  // Pending permission requests (for non-bypass mode)
  pendingPermissions: Map<string, PendingPermission>;
}

// Serializable session info for persistence
interface SessionRecord {
  id: string;
  sdkSessionId?: string;
  state: SessionState;
  startedAt: number;
  endedAt?: number;
  cwd: string;
  model?: string;
  title?: string;
  buffer: Event[];
}

const MAX_BUFFER = 5000;
const CLEANUP_DELAY = 30 * 60 * 1000;
const SESSIONS_FILE = path.join(os.homedir(), '.giz-code', 'chat-sessions.json');
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Claude Code session info from filesystem
interface ClaudeCodeSession {
  id: string;
  title: string;
  model?: string;
  startedAt: number;
  endedAt: number;
  messageCount: number;
  projectPath: string;
}

// Conversation message from JSONL
interface ConversationMessage {
  type: 'user' | 'assistant' | 'tool' | 'thinking';
  content: string;
  timestamp: number;
  model?: string;
  usage?: {
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
  };
  // For tool type
  tool?: {
    id: string;
    name: string;
    input?: string;
    output?: string;
    status: 'completed' | 'error';
  };
  // For thinking type
  thinking?: string;
}

// Parse Claude Code session file to get summary
async function parseClaudeSession(filePath: string): Promise<Omit<ClaudeCodeSession, 'id' | 'projectPath'> | null> {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let title = '';
    let summaryTitle = '';
    let model: string | undefined;
    let startedAt = 0;
    let endedAt = 0;
    let messageCount = 0;
    let isSidechain = false;

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);

        // Skip sidechain (internal) sessions like Warmup
        if (entry.isSidechain === true) {
          isSidechain = true;
          break;
        }

        // Get timestamp
        if (entry.timestamp) {
          const ts = new Date(entry.timestamp).getTime();
          if (!startedAt) startedAt = ts;
          endedAt = ts;
        }
        // Get summary title (Claude-generated)
        if (entry.type === 'summary' && entry.summary) {
          summaryTitle = entry.summary;
        }
        // Count messages and get fallback title
        if (entry.type === 'user' && entry.message && !entry.isMeta) {
          messageCount++;
          if (!title && entry.message.content) {
            const content = Array.isArray(entry.message.content)
              ? entry.message.content.find((c: { type: string; text?: string }) => c.type === 'text')?.text || ''
              : String(entry.message.content);
            // Skip Warmup and system messages
            if (!content.startsWith('<ide_') && !content.startsWith('<command-') && content !== 'Warmup') {
              title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
            }
          }
        }
        if (entry.type === 'assistant') {
          messageCount++;
          if (!model && entry.message?.model) {
            model = entry.message.model;
          }
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Skip sidechain sessions (internal use like Warmup)
    if (isSidechain) return null;
    if (messageCount === 0) return null;

    return {
      title: summaryTitle || title || '(Untitled)',
      model,
      startedAt: startedAt || Date.now(),
      endedAt: endedAt || Date.now(),
      messageCount,
    };
  } catch {
    return null;
  }
}

// Load conversation messages from JSONL file
async function loadConversation(sessionId: string): Promise<ConversationMessage[]> {
  const messages: ConversationMessage[] = [];
  // Track pending tool calls to match with results
  const pendingTools = new Map<string, { name: string; input?: string; timestamp: number }>();

  try {
    if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return messages;

    // Find the session file
    const projects = fs.readdirSync(CLAUDE_PROJECTS_DIR);
    let sessionFile: string | null = null;

    for (const project of projects) {
      const projectDir = path.join(CLAUDE_PROJECTS_DIR, project);
      const stat = fs.statSync(projectDir);
      if (!stat.isDirectory()) continue;

      const filePath = path.join(projectDir, `${sessionId}.jsonl`);
      if (fs.existsSync(filePath)) {
        sessionFile = filePath;
        break;
      }
    }

    if (!sessionFile) return messages;

    const fileStream = fs.createReadStream(sessionFile);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();

        // User messages with tool results
        if (entry.type === 'user' && entry.message && !entry.isMeta && !entry.isSidechain) {
          const msgContent = entry.message.content;

          // Check for tool results first
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block.type === 'tool_result' && block.tool_use_id) {
                const pending = pendingTools.get(block.tool_use_id);
                if (pending) {
                  // Get output from toolUseResult or block content
                  let output = '';
                  if (entry.toolUseResult) {
                    if (entry.toolUseResult.result) output = entry.toolUseResult.result;
                    else if (entry.toolUseResult.stdout) output = entry.toolUseResult.stdout;
                    else if (typeof entry.toolUseResult === 'string') output = entry.toolUseResult;
                  }
                  if (!output && typeof block.content === 'string') {
                    output = block.content;
                  }

                  messages.push({
                    type: 'tool',
                    content: '',
                    timestamp: pending.timestamp,
                    tool: {
                      id: block.tool_use_id,
                      name: pending.name,
                      input: pending.input,
                      output: output.slice(0, 5000), // Truncate large outputs
                      status: block.is_error ? 'error' : 'completed',
                    },
                  });
                  pendingTools.delete(block.tool_use_id);
                }
              }
            }
          }

          // Regular user text message
          const content = Array.isArray(msgContent)
            ? msgContent.find((c: { type: string; text?: string }) => c.type === 'text')?.text || ''
            : String(msgContent);

          // Skip IDE, system, and tool result only messages
          if (content && !content.startsWith('<ide_') && !content.startsWith('<command-') && content !== 'Warmup') {
            messages.push({
              type: 'user',
              content,
              timestamp,
            });
          }
        }

        // Assistant messages
        if (entry.type === 'assistant' && entry.message && !entry.isSidechain) {
          const msgContent = entry.message.content;
          let textContent = '';
          let thinkingContent = '';

          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              // Text blocks
              if (block.type === 'text' && block.text) {
                textContent += block.text;
              }
              // Thinking blocks
              if (block.type === 'thinking' && block.thinking) {
                thinkingContent += block.thinking;
              }
              // Tool use blocks - store for later matching
              if (block.type === 'tool_use' && block.id) {
                let inputStr = '';
                if (block.input) {
                  inputStr = typeof block.input === 'string'
                    ? block.input
                    : JSON.stringify(block.input, null, 2);
                }
                pendingTools.set(block.id, {
                  name: block.name,
                  input: inputStr.slice(0, 5000), // Truncate
                  timestamp,
                });
              }
            }
          } else if (typeof msgContent === 'string') {
            textContent = msgContent;
          }

          // Parse usage from message.usage
          const usage = entry.message.usage ? {
            inputTokens: entry.message.usage.input_tokens,
            outputTokens: entry.message.usage.output_tokens,
            cacheReadTokens: entry.message.usage.cache_read_input_tokens,
          } : undefined;

          // Add thinking message if present
          if (thinkingContent) {
            messages.push({
              type: 'thinking',
              content: '',
              timestamp,
              thinking: thinkingContent,
            });
          }

          // Add assistant text message
          if (textContent) {
            messages.push({
              type: 'assistant',
              content: textContent,
              timestamp,
              model: entry.message.model,
              usage,
            });
          }
        }
      } catch {
        // Skip invalid lines
      }
    }
  } catch (e) {
    console.error('[chat] Failed to load conversation:', e);
  }

  return messages;
}

// Get all Claude Code sessions from filesystem
async function getClaudeCodeSessions(limit = 30): Promise<ClaudeCodeSession[]> {
  const sessions: ClaudeCodeSession[] = [];
  try {
    if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return sessions;
    const projects = fs.readdirSync(CLAUDE_PROJECTS_DIR);

    for (const project of projects) {
      const projectDir = path.join(CLAUDE_PROJECTS_DIR, project);
      const stat = fs.statSync(projectDir);
      if (!stat.isDirectory()) continue;

      const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(projectDir, file);
        const info = await parseClaudeSession(filePath);
        if (info) {
          sessions.push({ id: sessionId, projectPath: project, ...info });
        }
      }
    }
  } catch (e) {
    console.error('[chat] Failed to read Claude sessions:', e);
  }

  // Sort by endedAt desc, limit
  sessions.sort((a, b) => b.endedAt - a.endedAt);
  return sessions.slice(0, limit);
}

export class ChatChannel implements Channel {
  name = 'chat';
  private io!: Server;
  private sessions = new Map<string, Session>();

  constructor() {
    this.loadSessions();
  }

  onRegister(io: Server) { this.io = io; }

  // Load sessions from file on startup
  private loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as SessionRecord[];
        for (const rec of data) {
          // Only restore non-running sessions (running sessions can't be resumed without SDK state)
          if (rec.state !== 'running') {
            this.sessions.set(rec.id, {
              ...rec,
              emitter: new EventEmitter(),
              pendingPermissions: new Map(),
            });
          }
        }
        console.log(`[chat] Loaded ${this.sessions.size} sessions from file`);
      }
    } catch (e) {
      console.error('[chat] Failed to load sessions:', e);
    }
  }

  // Save sessions to file
  private saveSessions() {
    try {
      const dir = path.dirname(SESSIONS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const records: SessionRecord[] = [...this.sessions.values()].map(s => ({
        id: s.id,
        sdkSessionId: s.sdkSessionId,
        state: s.state,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        cwd: s.cwd,
        model: s.model,
        title: s.title,
        buffer: s.buffer.slice(-100), // Keep last 100 events for replay
      }));
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(records, null, 2));
    } catch (e) {
      console.error('[chat] Failed to save sessions:', e);
    }
  }

  async onSubscribe(socket: Socket, params?: Record<string, unknown>) {
    const sid = params?.sessionId as string;

    // Send list of all sessions on connect
    await this.list(socket);

    if (sid && this.sessions.has(sid)) {
      const s = this.sessions.get(sid)!;
      socket.join(`chat:${sid}`);

      // Send current state + replay buffer
      socket.emit('chat:state', {
        sessionId: sid, state: s.state, startedAt: s.startedAt,
        endedAt: s.endedAt, result: s.result, error: s.error,
      });

      if (s.buffer.length > 0) {
        socket.emit('chat:replay', { sessionId: sid, events: s.buffer });
      }
      return;
    }

    socket.emit('chat:ready', { sessionId: null });
  }

  onUnsubscribe(socket: Socket) {
    [...socket.rooms].filter(r => r.startsWith('chat:')).forEach(r => socket.leave(r));
  }

  async onMessage(socket: Socket, action: string, payload: unknown) {
    const p = payload as Record<string, unknown>;

    switch (action) {
      case 'start': await this.start(socket, p); break;
      case 'abort': this.abort(p.sessionId as string); break;
      case 'status': this.status(socket, p.sessionId as string); break;
      case 'list': this.list(socket); break;
      case 'load': await this.loadSession(socket, p.sessionId as string); break;
      case 'models': await this.getModels(socket); break;
      case 'commands': await this.getCommands(socket); break;
      case 'permission_response': this.handlePermissionResponse(p); break;
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  onShutdown() {
    for (const s of this.sessions.values()) {
      if (s.state === 'running') { s.abort?.abort(); s.state = 'aborted'; }
    }
  }

  private async start(socket: Socket, p: Record<string, unknown>) {
    const { message, sessionId: resume, currentPath, cwd, mode = 'claude-code', model, permissionMode = 'bypassPermissions' } = p as {
      message: string; sessionId?: string; currentPath?: string; cwd?: string; mode?: 'claude-code' | 'deepagents'; model?: string;
      permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    };

    if (resume && this.sessions.get(resume)?.state === 'running') {
      socket.emit('chat:error', { message: 'Session already running', sessionId: resume });
      return;
    }

    // For Claude Code sessions, use the session ID directly (UUID format)
    // For new sessions, generate a temporary ID that will be replaced by SDK session ID
    const isClaudeSession = resume && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(resume);
    const sid = resume || `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Use first 50 chars of message as title
    const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');

    const session: Session = {
      id: sid, state: 'running', startedAt: Date.now(),
      buffer: [], emitter: new EventEmitter(), abort: new AbortController(),
      cwd: (cwd as string) || process.cwd(),
      title,
      // If resuming a Claude Code session, set sdkSessionId for resume
      sdkSessionId: isClaudeSession ? resume : undefined,
      pendingPermissions: new Map(),
    };
    session.emitter.setMaxListeners(100);
    this.sessions.set(sid, session);

    socket.join(`chat:${sid}`);
    this.broadcast(sid, 'chat:started', { sessionId: sid });

    // Notify all clients about session list change
    this.broadcastSessionList();
    this.saveSessions();

    if (mode === 'deepagents') {
      this.runDeepAgents(sid, message, currentPath, model);
    } else {
      this.runAgent(sid, message, currentPath, model, permissionMode);
    }
  }

  private async runAgent(
    sid: string,
    message: string,
    currentPath?: string,
    model?: string,
    permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' = 'bypassPermissions'
  ) {
    const session = this.sessions.get(sid);
    if (!session) return;

    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const prompt = currentPath ? `[현재 파일: ${currentPath}]\n\n${message}` : message;
      const startTime = Date.now();

      const options: Record<string, unknown> = {
        cwd: session.cwd,
        includePartialMessages: true,
        abortController: session.abort,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: '한국어로 응답하세요.' },
        tools: { type: 'preset', preset: 'claude_code' },
        maxTurns: 50,
        maxBudgetUsd: 5.0,
        // Permission mode from user selection
        permissionMode,
        allowDangerouslySkipPermissions: permissionMode === 'bypassPermissions',
      };

      // Add canUseTool callback for non-bypass modes
      if (permissionMode !== 'bypassPermissions') {
        options.canUseTool = async (params: {
          toolName: string;
          toolInput: Record<string, unknown>;
          toolUseId: string;
          signal: AbortSignal;
          suggestions?: unknown[];
          blockedPath?: string;
          decisionReason?: string;
        }) => {
          const permId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          // Send permission request to client
          this.bufferAndBroadcast(sid, {
            type: 'permission_request',
            data: {
              id: permId,
              toolName: params.toolName,
              toolInput: params.toolInput,
              toolUseId: params.toolUseId,
              decisionReason: params.decisionReason,
              blockedPath: params.blockedPath,
              suggestions: params.suggestions,
            },
            ts: Date.now(),
          });

          // Wait for user response
          return new Promise<{ allowed: boolean; permissionsUpdate?: unknown[] }>((resolve, reject) => {
            session.pendingPermissions.set(permId, {
              resolve,
              reject,
              toolName: params.toolName,
              toolInput: params.toolInput as Record<string, unknown>,
              toolUseId: params.toolUseId,
            });

            // Timeout after 5 minutes
            setTimeout(() => {
              if (session.pendingPermissions.has(permId)) {
                session.pendingPermissions.delete(permId);
                resolve({ allowed: false }); // Deny on timeout
              }
            }, 5 * 60 * 1000);
          });
        };
      }

      // Model selection
      if (model) {
        options.model = model;
        session.model = model;
      }

      if (session.sdkSessionId) {
        options.resume = session.sdkSessionId;
      }

      const result = query({ prompt, options });
      let lastToolId: string | null = null;

      for await (const msg of result) {
        if (session.abort?.signal.aborted) break;

        const events = this.transform(msg, lastToolId);
        for (const ev of events) {
          // Track tool ID for result matching
          if (ev.type === 'tool_start') {
            lastToolId = (ev.data as { id: string }).id;
          }
          this.bufferAndBroadcast(sid, ev);
        }

        // Capture SDK session ID
        const m = msg as Record<string, unknown>;
        if (m.type === 'system' && m.subtype === 'init') {
          session.sdkSessionId = m.session_id as string;
          session.model = m.model as string;
        }
      }

      session.state = 'completed';
      session.endedAt = Date.now();
      session.result = { durationMs: Date.now() - startTime };
      this.broadcast(sid, 'chat:completed', { sessionId: sid, result: session.result });

    } catch (e) {
      session.state = session.abort?.signal.aborted ? 'aborted' : 'error';
      session.endedAt = Date.now();
      session.error = (e as Error).message;
      this.broadcast(sid, session.state === 'aborted' ? 'chat:aborted' : 'chat:error', {
        sessionId: sid, error: session.error,
      });
    } finally {
      this.broadcastSessionList();
      this.saveSessions();
      setTimeout(() => {
        if (this.sessions.get(sid)?.state !== 'running') {
          this.sessions.delete(sid);
          this.saveSessions();
        }
      }, CLEANUP_DELAY);
    }
  }

  /**
   * DeepAgents mode - LangGraph based agent
   */
  private async runDeepAgents(sid: string, message: string, currentPath?: string, model?: string) {
    const session = this.sessions.get(sid);
    if (!session) return;

    try {
      const { ChatAnthropic } = await import('@langchain/anthropic');
      const { ChatOpenAI } = await import('@langchain/openai');
      const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
      const { MemorySaver } = await import('@langchain/langgraph');
      const { HumanMessage } = await import('@langchain/core/messages');
      const { repoTools } = await import('@/lib/agent/tools');

      const startTime = Date.now();

      // Choose model
      let model;
      let modelName: string;

      if (process.env.ANTHROPIC_API_KEY) {
        model = new ChatAnthropic({ model: 'claude-sonnet-4-20250514', temperature: 0.3 });
        modelName = 'claude-sonnet-4';
      } else if (process.env.OPENAI_API_KEY) {
        model = new ChatOpenAI({ model: 'gpt-4o', temperature: 0.3 });
        modelName = 'gpt-4o';
      } else {
        throw new Error('No API key configured');
      }

      session.model = modelName;

      // Memory saver
      const memorySaver = new MemorySaver();

      // System prompt
      const systemPrompt = `Giz Code AI입니다. 사용자의 코드베이스 탐색을 도와주세요. 한국어로 응답하세요.`;

      // Create agent
      const agent = createReactAgent({
        llm: model,
        tools: repoTools,
        messageModifier: systemPrompt,
        checkpointer: memorySaver,
      });

      // Build message
      const fullMessage = currentPath ? `[현재 파일: ${currentPath}]\n\n${message}` : message;
      const messages = [new HumanMessage(fullMessage)];

      // Thread ID
      const threadId = session.sdkSessionId || sid;

      // Send init event
      this.bufferAndBroadcast(sid, {
        type: 'init',
        data: { model: modelName, tools: repoTools.map(t => t.name), sessionId: threadId },
        ts: Date.now(),
      });

      // Stream
      const stream = await agent.stream(
        { messages },
        { configurable: { thread_id: threadId }, streamMode: 'values', signal: session.abort?.signal }
      );

      let lastContent = '';
      let toolCount = 0;

      for await (const chunk of stream) {
        if (session.abort?.signal.aborted) break;

        const msgs = chunk.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        if (!lastMsg) continue;

        // Tool calls
        const msgWithTools = lastMsg as { tool_calls?: Array<{ name: string; id?: string }> };
        if (msgWithTools.tool_calls?.length) {
          for (const tc of msgWithTools.tool_calls) {
            toolCount++;
            this.bufferAndBroadcast(sid, {
              type: 'tool_start',
              data: { name: tc.name, id: tc.id || `tool-${toolCount}` },
              ts: Date.now(),
            });
          }
        }

        // Text content
        const content = lastMsg.content;
        if (typeof content === 'string' && content !== lastContent) {
          const newContent = content.slice(lastContent.length);
          if (newContent) {
            this.bufferAndBroadcast(sid, { type: 'text', data: newContent, ts: Date.now() });
          }
          lastContent = content;
        }
      }

      session.state = 'completed';
      session.endedAt = Date.now();
      session.result = { durationMs: Date.now() - startTime };
      this.broadcast(sid, 'chat:completed', { sessionId: sid, result: session.result });

    } catch (e) {
      session.state = session.abort?.signal.aborted ? 'aborted' : 'error';
      session.endedAt = Date.now();
      session.error = (e as Error).message;
      this.broadcast(sid, session.state === 'aborted' ? 'chat:aborted' : 'chat:error', {
        sessionId: sid, error: session.error,
      });
    } finally {
      this.broadcastSessionList();
      this.saveSessions();
      setTimeout(() => {
        if (this.sessions.get(sid)?.state !== 'running') {
          this.sessions.delete(sid);
          this.saveSessions();
        }
      }, CLEANUP_DELAY);
    }
  }

  /**
   * Transform SDK message to chat events
   * Returns array to support messages that produce multiple events
   *
   * SDK Message Types handled:
   * - system: init, status, compact_boundary, hook_response
   * - stream_event: content_block_start/delta/stop, message_start/delta/stop
   * - user: with tool_use_result
   * - assistant: full message (when not streaming)
   * - tool_progress: tool execution progress
   * - result: final result with usage
   * - auth_status: authentication status updates
   */
  private transform(msg: unknown, _lastToolId: string | null): Event[] {
    const m = msg as Record<string, unknown>;
    const ts = Date.now();
    const events: Event[] = [];

    // System messages
    if (m.type === 'system') {
      if (m.subtype === 'init') {
        events.push({
          type: 'init',
          data: {
            model: m.model,
            sessionId: m.session_id,
            tools: m.tools,
            mcpServers: m.mcp_servers,
            permissionMode: m.permissionMode,
            skills: m.skills,
            slashCommands: m.slash_commands,  // Slash commands from SDK
          },
          ts,
        });
      } else if (m.subtype === 'status') {
        events.push({ type: 'status', data: { status: m.status }, ts });
      } else if (m.subtype === 'compact_boundary') {
        const meta = m.compact_metadata as { trigger: string; pre_tokens: number };
        events.push({
          type: 'status',
          data: { status: 'compacting', trigger: meta?.trigger, preTokens: meta?.pre_tokens },
          ts,
        });
      } else if (m.subtype === 'hook_response') {
        // Hook execution results
        events.push({
          type: 'hook_response',
          data: {
            hookName: m.hook_name,
            hookEvent: m.hook_event,
            stdout: m.stdout,
            stderr: m.stderr,
            exitCode: m.exit_code,
          },
          ts,
        });
      }
    }

    // Authentication status updates
    if (m.type === 'auth_status') {
      events.push({
        type: 'auth_status',
        data: {
          isAuthenticating: m.isAuthenticating,
          output: m.output,
          error: m.error,
        },
        ts,
      });
    }

    // Stream events (partial messages)
    if (m.type === 'stream_event') {
      const ev = m.event as Record<string, unknown>;

      // Message lifecycle events
      if (ev.type === 'message_start') {
        const message = ev.message as Record<string, unknown>;
        events.push({
          type: 'message_start',
          data: {
            id: message?.id,
            model: message?.model,
            role: message?.role,
          },
          ts,
        });
      }

      if (ev.type === 'message_delta') {
        const delta = ev.delta as Record<string, unknown>;
        const usage = ev.usage as Record<string, number> | undefined;
        events.push({
          type: 'message_delta',
          data: {
            stopReason: delta?.stop_reason,
            outputTokens: usage?.output_tokens,
          },
          ts,
        });
      }

      if (ev.type === 'message_stop') {
        events.push({ type: 'message_stop', data: {}, ts });
      }

      // Content block events
      if (ev.type === 'content_block_start') {
        const block = ev.content_block as Record<string, unknown>;
        if (block.type === 'tool_use') {
          events.push({ type: 'tool_start', data: { id: block.id, name: block.name }, ts });
        } else if (block.type === 'thinking') {
          events.push({ type: 'thinking_start', data: { index: ev.index }, ts });
        }
      }

      if (ev.type === 'content_block_delta') {
        const delta = ev.delta as Record<string, unknown>;
        if (delta.type === 'text_delta') {
          events.push({ type: 'text', data: delta.text, ts });
        }
        if (delta.type === 'thinking_delta') {
          events.push({ type: 'thinking', data: delta.thinking, ts });
        }
        if (delta.type === 'input_json_delta') {
          events.push({ type: 'tool_input', data: delta.partial_json, ts });
        }
        if (delta.type === 'signature_delta') {
          events.push({ type: 'signature', data: delta.signature, ts });
        }
      }

      if (ev.type === 'content_block_stop') {
        events.push({ type: 'block_stop', data: { index: ev.index }, ts });
      }
    }

    // Full assistant message (when includePartialMessages is false)
    if (m.type === 'assistant' && m.message) {
      const message = m.message as Record<string, unknown>;
      const content = message.content as Array<Record<string, unknown>> | undefined;

      if (content && Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            events.push({ type: 'text', data: block.text, ts });
          }
          if (block.type === 'thinking' && block.thinking) {
            events.push({ type: 'thinking', data: block.thinking, ts });
          }
          if (block.type === 'tool_use') {
            events.push({ type: 'tool_start', data: { id: block.id, name: block.name }, ts });
            if (block.input) {
              const inputStr = typeof block.input === 'string' ? block.input : JSON.stringify(block.input);
              events.push({ type: 'tool_input', data: inputStr, ts });
            }
          }
        }
      }
    }

    // User messages (may contain tool results)
    if (m.type === 'user' && m.tool_use_result !== undefined) {
      const parentId = m.parent_tool_use_id as string;
      events.push({
        type: 'tool_result',
        data: { id: parentId, output: m.tool_use_result },
        ts,
      });
    }

    // Tool progress
    if (m.type === 'tool_progress') {
      events.push({
        type: 'tool_progress',
        data: {
          id: m.tool_use_id,
          name: m.tool_name,
          elapsed: m.elapsed_time_seconds,
        },
        ts,
      });
    }

    // Final result
    if (m.type === 'result') {
      const usage = m.usage as Record<string, number> | undefined;
      const modelUsage = m.modelUsage as Record<string, Record<string, number>> | undefined;
      events.push({
        type: 'result',
        data: {
          sessionId: m.session_id,
          costUsd: m.total_cost_usd,
          turns: m.num_turns,
          durationMs: m.duration_ms,
          isError: m.is_error,
          errors: m.errors,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          cacheReadTokens: usage?.cache_read_input_tokens,
          cacheCreationTokens: usage?.cache_creation_input_tokens,
          // Per-model cumulative usage
          modelUsage: modelUsage ? Object.entries(modelUsage).map(([model, u]) => ({
            model,
            inputTokens: u.inputTokens,
            outputTokens: u.outputTokens,
            cacheReadTokens: u.cacheReadInputTokens,
            costUsd: u.costUSD,
            contextWindow: u.contextWindow,
          })) : undefined,
        },
        ts,
      });
    }

    return events;
  }

  private bufferAndBroadcast(sid: string, ev: Event) {
    const s = this.sessions.get(sid);
    if (!s) return;

    if (s.buffer.length >= MAX_BUFFER) s.buffer = s.buffer.slice(MAX_BUFFER * 0.1);
    s.buffer.push(ev);

    this.broadcast(sid, 'chat:event', { sessionId: sid, event: ev });
  }

  private broadcast(sid: string, event: string, data: unknown) {
    this.io.to(`chat:${sid}`).emit(event, data);
  }

  private broadcastSessionList() {
    const list = this.getSessionList();
    this.io.emit('chat:sessions', { sessions: list });
  }

  private getSessionList() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      id, state: s.state, startedAt: s.startedAt, endedAt: s.endedAt, model: s.model, title: s.title,
    }));
  }

  private abort(sid: string) {
    const s = this.sessions.get(sid);
    if (s?.state === 'running') {
      s.abort?.abort();
      s.state = 'aborted';
      s.endedAt = Date.now();
      this.broadcast(sid, 'chat:aborted', { sessionId: sid });
      this.broadcastSessionList();
      this.saveSessions();
    }
  }

  private status(socket: Socket, sid: string) {
    const s = this.sessions.get(sid);
    socket.emit('chat:status', {
      sessionId: sid, exists: !!s, state: s?.state,
      startedAt: s?.startedAt, bufferSize: s?.buffer.length,
    });
  }

  private async list(socket: Socket) {
    // Combine running WebSocket sessions with Claude Code sessions
    const runningSessions = this.getSessionList().filter(s => s.state === 'running');
    console.log('[chat] Getting Claude Code sessions...');
    const claudeSessions = await getClaudeCodeSessions(30);
    console.log(`[chat] Found ${claudeSessions.length} Claude Code sessions`);

    // Map Claude sessions to same format
    const sessions = [
      ...runningSessions,
      ...claudeSessions.map(s => ({
        id: s.id,
        state: 'completed' as SessionState,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        model: s.model,
        title: s.title,
        source: 'claude-code' as const,
      })),
    ];

    console.log(`[chat] Sending ${sessions.length} sessions to client`);
    socket.emit('chat:sessions', { sessions });
  }

  getRunning(): string[] {
    return [...this.sessions.entries()].filter(([, s]) => s.state === 'running').map(([id]) => id);
  }

  /**
   * Load conversation from Claude Code JSONL file
   */
  private async loadSession(socket: Socket, sessionId: string) {
    if (!sessionId) {
      socket.emit('chat:error', { message: 'Session ID required' });
      return;
    }

    // Check if it's a running session first
    const runningSession = this.sessions.get(sessionId);
    if (runningSession) {
      socket.join(`chat:${sessionId}`);
      socket.emit('chat:state', {
        sessionId,
        state: runningSession.state,
        startedAt: runningSession.startedAt,
        endedAt: runningSession.endedAt,
        result: runningSession.result,
        error: runningSession.error,
      });
      if (runningSession.buffer.length > 0) {
        socket.emit('chat:replay', { sessionId, events: runningSession.buffer });
      }
      return;
    }

    // Load from Claude Code JSONL file
    console.log(`[chat] Loading conversation for session: ${sessionId}`);
    socket.emit('chat:loading', { sessionId });

    try {
      const messages = await loadConversation(sessionId);
      console.log(`[chat] Loaded ${messages.length} messages for session ${sessionId}`);

      if (messages.length === 0) {
        socket.emit('chat:error', { message: 'Session not found or empty', sessionId });
        return;
      }

      // Send conversation as timeline
      socket.emit('chat:conversation', { sessionId, messages });
    } catch (e) {
      console.error('[chat] Failed to load session:', e);
      socket.emit('chat:error', { message: 'Failed to load session', sessionId });
    }
  }

  /**
   * Get available models from SDK
   */
  private async getModels(socket: Socket) {
    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Create a minimal query to access supportedModels
      const q = query({
        prompt: '',
        options: {
          cwd: process.cwd(),
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      const models = await q.supportedModels();
      socket.emit('chat:models', { models });

      // Clean up - abort the query since we just needed the models
      await q.interrupt();
    } catch (e) {
      console.error('[chat] Failed to get models:', e);
      // Return default models on error
      socket.emit('chat:models', {
        models: [
          { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', description: 'Best balance of speed and intelligence' },
          { value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4', description: 'Most capable model' },
          { value: 'claude-haiku-3-5-20250414', displayName: 'Claude Haiku 3.5', description: 'Fastest model' },
        ],
      });
    }
  }

  /**
   * Get available slash commands from SDK + custom command directories
   */
  private async getCommands(socket: Socket) {
    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      const matter = await import('gray-matter');
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      // Create a minimal query to access supportedCommands
      const q = query({
        prompt: '',
        options: {
          cwd: process.cwd(),
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      const sdkCommands = await q.supportedCommands();
      await q.interrupt();

      // Scan custom command directories
      const customCommands: Array<{ name: string; description: string; argumentHint: string }> = [];
      const commandDirs = [
        path.join(os.homedir(), '.claude', 'commands'),
        path.join(process.cwd(), '.claude', 'commands'),
      ];

      for (const dir of commandDirs) {
        try {
          const files = await fs.readdir(dir, { recursive: true });
          for (const file of files) {
            if (typeof file === 'string' && file.endsWith('.md')) {
              try {
                const content = await fs.readFile(path.join(dir, file), 'utf-8');
                const { data } = matter.default(content);
                const name = file.replace(/\.md$/, '').replace(/\//g, '-');
                customCommands.push({
                  name,
                  description: data.description || `Custom command: ${name}`,
                  argumentHint: data.arguments || '',
                });
              } catch {
                // Skip invalid files
              }
            }
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }

      // Merge SDK commands with custom commands
      const allCommands = [...sdkCommands, ...customCommands];
      socket.emit('chat:commands', { commands: allCommands });
    } catch (e) {
      console.error('[chat] Failed to get commands:', e);
      socket.emit('chat:commands', { commands: [] });
    }
  }

  /**
   * Handle permission response from client
   */
  private handlePermissionResponse(p: Record<string, unknown>) {
    const { sessionId, id, approved, mode, allowTools } = p as {
      sessionId: string;
      id: string;
      approved: boolean;
      mode?: 'default' | 'acceptEdits';
      allowTools?: string[];
    };

    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[chat] Permission response for unknown session: ${sessionId}`);
      return;
    }

    const pending = session.pendingPermissions.get(id);
    if (!pending) {
      console.warn(`[chat] Permission response for unknown permission: ${id}`);
      return;
    }

    // Remove from pending
    session.pendingPermissions.delete(id);

    // Build permissionsUpdate for SDK (if user chose session-wide permissions)
    const permissionsUpdate: unknown[] = [];

    if (mode === 'acceptEdits') {
      // Allow all edit-type tools for the session
      permissionsUpdate.push({ type: 'accept_edits' });
    }

    if (allowTools?.length) {
      // Allow specific tools for the session
      for (const tool of allowTools) {
        permissionsUpdate.push({ type: 'allow_tool', tool });
      }
    }

    // Resolve the pending promise
    pending.resolve({
      allowed: approved,
      permissionsUpdate: permissionsUpdate.length > 0 ? permissionsUpdate : undefined,
    });

    // Broadcast resolution to UI
    this.broadcast(sessionId, 'chat:permission_resolved', { id, approved });
  }
}
