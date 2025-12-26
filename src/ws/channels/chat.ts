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

type SessionState = 'running' | 'completed' | 'error' | 'aborted';

interface Event { type: string; data: unknown; ts: number; }

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
    this.list(socket);

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
      default: throw new Error(`Unknown action: ${action}`);
    }
  }

  onShutdown() {
    for (const s of this.sessions.values()) {
      if (s.state === 'running') { s.abort?.abort(); s.state = 'aborted'; }
    }
  }

  private async start(socket: Socket, p: Record<string, unknown>) {
    const { message, sessionId: resume, currentPath, cwd } = p as {
      message: string; sessionId?: string; currentPath?: string; cwd?: string;
    };

    if (resume && this.sessions.get(resume)?.state === 'running') {
      socket.emit('chat:error', { message: 'Session already running', sessionId: resume });
      return;
    }

    const sid = resume || `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Use first 50 chars of message as title
    const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');

    const session: Session = {
      id: sid, state: 'running', startedAt: Date.now(),
      buffer: [], emitter: new EventEmitter(), abort: new AbortController(),
      cwd: (cwd as string) || process.cwd(),
      title,
    };
    session.emitter.setMaxListeners(100);
    this.sessions.set(sid, session);

    socket.join(`chat:${sid}`);
    this.broadcast(sid, 'chat:started', { sessionId: sid });

    // Notify all clients about session list change
    this.broadcastSessionList();
    this.saveSessions();

    this.runAgent(sid, message, currentPath);
  }

  private async runAgent(sid: string, message: string, currentPath?: string) {
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
        maxTurns: 30,
        maxBudgetUsd: 1.0,
      };

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
   * Transform SDK message to chat events
   * Returns array to support messages that produce multiple events
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
      }
    }

    // Stream events (partial messages)
    if (m.type === 'stream_event') {
      const ev = m.event as Record<string, unknown>;

      if (ev.type === 'content_block_start') {
        const block = ev.content_block as Record<string, unknown>;
        if (block.type === 'tool_use') {
          events.push({ type: 'tool_start', data: { id: block.id, name: block.name }, ts });
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
      }

      if (ev.type === 'content_block_stop') {
        events.push({ type: 'block_stop', data: { index: ev.index }, ts });
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
      events.push({
        type: 'result',
        data: {
          sessionId: m.session_id,
          costUsd: m.total_cost_usd,
          turns: m.num_turns,
          isError: m.is_error,
          errors: m.errors,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          cacheReadTokens: usage?.cache_read_input_tokens,
          cacheCreationTokens: usage?.cache_creation_input_tokens,
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

  private list(socket: Socket) {
    socket.emit('chat:sessions', { sessions: this.getSessionList() });
  }

  getRunning(): string[] {
    return [...this.sessions.entries()].filter(([, s]) => s.state === 'running').map(([id]) => id);
  }
}
