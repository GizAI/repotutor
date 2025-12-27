/**
 * Terminal Channel - Multi-session PTY management via node-pty
 *
 * Message protocol:
 * - create: Create new terminal session
 * - join: Join existing session
 * - leave: Leave session (PTY stays alive)
 * - terminate: Kill session PTY
 * - list: Get session list
 * - rename: Rename session
 * - input: Send keystrokes to terminal
 * - resize: Resize terminal (cols, rows)
 * - inject: Inject command (appends newline)
 */

import { Server, Socket } from 'socket.io';
import type { Channel } from './index';
import * as pty from 'node-pty';
import { nanoid } from 'nanoid';

// Payloads
interface CreatePayload {
  title?: string;
  cwd?: string;
}

interface JoinPayload {
  sessionId: string;
}

interface LeavePayload {
  sessionId: string;
}

interface TerminatePayload {
  sessionId: string;
}

interface RenamePayload {
  sessionId: string;
  title: string;
}

interface InputPayload {
  sessionId: string;
  data: string;
}

interface ResizePayload {
  sessionId: string;
  cols: number;
  rows: number;
}

interface InjectPayload {
  sessionId: string;
  command: string;
}

// Session types
interface TerminalSession {
  id: string;
  pty: pty.IPty;
  scrollbackBuffer: string;
  cwd: string;
  title: string;
  createdAt: Date;
  lastActivityAt: Date;
  subscribers: Set<Socket>;
  cols: number;
  rows: number;
}

export interface TerminalSessionSummary {
  id: string;
  title: string;
  cwd: string;
  createdAt: string;
  lastActivityAt: string;
  isActive: boolean;
  preview: string;
  cols: number;
  rows: number;
}

// Constants
const MAX_BUFFER_SIZE = 100 * 1024;  // 100KB per session
const MAX_SESSIONS = 10;
const CLEANUP_INTERVAL = 60 * 1000;  // 1 minute
const SESSION_TIMEOUT = 60 * 60 * 1000;  // 1 hour idle timeout

export class TerminalChannel implements Channel {
  name = 'terminal';
  private io: Server | null = null;
  private sessions = new Map<string, TerminalSession>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  // Track which socket is subscribed to which sessions
  private socketSessions = new Map<string, Set<string>>();

  onRegister(io: Server): void {
    this.io = io;
    console.log('[Terminal] Multi-session channel registered');

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => this.cleanupIdleSessions(), CLEANUP_INTERVAL);
  }

  onSubscribe(socket: Socket, params?: Record<string, unknown>): void {
    console.log(`[Terminal] Client subscribed: ${socket.id}`);

    // Initialize socket's session tracking
    if (!this.socketSessions.has(socket.id)) {
      this.socketSessions.set(socket.id, new Set());
    }

    // Send current session list
    socket.emit('terminal:sessions', this.getSessionList());

    // Auto-join: create new session if none exist, or join the first available session
    if (this.sessions.size === 0) {
      const session = this.createSession();
      this.joinSessionInternal(socket, session.id);
    } else {
      // Join the first (most recent) session
      const firstSession = Array.from(this.sessions.values())[0];
      if (firstSession) {
        this.joinSessionInternal(socket, firstSession.id);
      }
    }
  }

  onUnsubscribe(socket: Socket): void {
    console.log(`[Terminal] Client unsubscribed: ${socket.id}`);
    this.removeSocketFromAllSessions(socket);
  }

  onMessage(socket: Socket, action: string, payload: unknown): void {
    switch (action) {
      case 'create':
        this.handleCreate(socket, payload as CreatePayload);
        break;
      case 'join':
        this.handleJoin(socket, payload as JoinPayload);
        break;
      case 'leave':
        this.handleLeave(socket, payload as LeavePayload);
        break;
      case 'terminate':
        this.handleTerminate(socket, payload as TerminatePayload);
        break;
      case 'list':
        socket.emit('terminal:sessions', this.getSessionList());
        break;
      case 'rename':
        this.handleRename(socket, payload as RenamePayload);
        break;
      case 'input':
        this.handleInput(payload as InputPayload);
        break;
      case 'resize':
        this.handleResize(payload as ResizePayload);
        break;
      case 'inject':
        this.handleInject(payload as InjectPayload);
        break;
      default:
        console.warn(`[Terminal] Unknown action: ${action}`);
    }
  }

  onDisconnect(socket: Socket): void {
    console.log(`[Terminal] Client disconnected: ${socket.id}`);
    this.removeSocketFromAllSessions(socket);
  }

  onShutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Kill all PTYs
    for (const session of this.sessions.values()) {
      session.pty.kill();
    }
    this.sessions.clear();
    console.log('[Terminal] All sessions killed on shutdown');
  }

  // === Action Handlers ===

  private handleCreate(socket: Socket, payload: CreatePayload): void {
    if (this.sessions.size >= MAX_SESSIONS) {
      socket.emit('terminal:error', { message: 'Maximum session limit reached' });
      return;
    }

    const session = this.createSession(payload?.title, payload?.cwd);
    this.joinSessionInternal(socket, session.id);

    // Broadcast updated session list
    this.broadcastSessionList();
  }

  private handleJoin(socket: Socket, payload: JoinPayload): void {
    const { sessionId } = payload;
    const session = this.sessions.get(sessionId);

    if (!session) {
      socket.emit('terminal:error', { message: 'Session not found', sessionId });
      return;
    }

    this.joinSessionInternal(socket, sessionId);
  }

  private handleLeave(socket: Socket, payload: LeavePayload): void {
    const { sessionId } = payload;
    const session = this.sessions.get(sessionId);

    if (session) {
      session.subscribers.delete(socket);
      socket.leave(`terminal:${sessionId}`);

      const socketSessionSet = this.socketSessions.get(socket.id);
      if (socketSessionSet) {
        socketSessionSet.delete(sessionId);
      }

      console.log(`[Terminal] Socket ${socket.id} left session ${sessionId}`);

      // Broadcast updated session list (active status may have changed)
      this.broadcastSessionList();
    }
  }

  private handleTerminate(socket: Socket, payload: TerminatePayload): void {
    const { sessionId } = payload;
    const session = this.sessions.get(sessionId);

    if (!session) {
      socket.emit('terminal:error', { message: 'Session not found', sessionId });
      return;
    }

    this.terminateSession(sessionId);
  }

  private handleRename(socket: Socket, payload: RenamePayload): void {
    const { sessionId, title } = payload;
    const session = this.sessions.get(sessionId);

    if (session && title) {
      session.title = title.slice(0, 50);  // Limit title length
      this.broadcastSessionList();
    }
  }

  private handleInput(payload: InputPayload): void {
    const { sessionId, data } = payload;
    const session = this.sessions.get(sessionId);

    if (session) {
      session.pty.write(data);
      session.lastActivityAt = new Date();
    }
  }

  private handleResize(payload: ResizePayload): void {
    const { sessionId, cols, rows } = payload;
    const session = this.sessions.get(sessionId);

    if (session && cols > 0 && rows > 0) {
      session.pty.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
    }
  }

  private handleInject(payload: InjectPayload): void {
    const { sessionId, command } = payload;
    const session = this.sessions.get(sessionId);

    if (session) {
      session.pty.write(command + '\n');
      session.lastActivityAt = new Date();
      console.log(`[Terminal] Injected to ${sessionId}: ${command}`);
    }
  }

  // === Session Management ===

  private createSession(title?: string, cwd?: string): TerminalSession {
    const id = nanoid(8);
    const shell = process.env.TERMINAL_SHELL || process.env.SHELL || '/bin/bash';
    const sessionCwd = cwd || process.env.TERMINAL_CWD || process.env.HOME || '/home/user';

    const ptyInstance = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: sessionCwd,
      env: process.env as Record<string, string>,
    });

    const session: TerminalSession = {
      id,
      pty: ptyInstance,
      scrollbackBuffer: '',
      cwd: sessionCwd,
      title: title || `Session ${this.sessions.size + 1}`,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      subscribers: new Set(),
      cols: 120,
      rows: 30,
    };

    // Handle PTY output
    ptyInstance.onData((data) => {
      session.scrollbackBuffer += data;
      if (session.scrollbackBuffer.length > MAX_BUFFER_SIZE) {
        session.scrollbackBuffer = session.scrollbackBuffer.slice(-MAX_BUFFER_SIZE);
      }
      session.lastActivityAt = new Date();

      // Emit to room
      if (this.io) {
        this.io.to(`terminal:${id}`).emit('terminal:data', { sessionId: id, data });
      }
    });

    // Handle PTY exit
    ptyInstance.onExit(({ exitCode }) => {
      console.log(`[Terminal] Session ${id} exited with code ${exitCode}`);

      if (this.io) {
        this.io.to(`terminal:${id}`).emit('terminal:exit', { sessionId: id, code: exitCode });
      }

      // Remove session
      this.sessions.delete(id);
      this.broadcastSessionList();
    });

    this.sessions.set(id, session);
    console.log(`[Terminal] Session created: ${id} (${session.title}) in ${sessionCwd}`);

    return session;
  }

  private joinSessionInternal(socket: Socket, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Add socket to session
    session.subscribers.add(socket);
    socket.join(`terminal:${sessionId}`);

    // Track in socket's session set
    const socketSessionSet = this.socketSessions.get(socket.id);
    if (socketSessionSet) {
      socketSessionSet.add(sessionId);
    }

    // Send join confirmation with scrollback buffer
    socket.emit('terminal:joined', {
      sessionId,
      buffer: session.scrollbackBuffer,
      cols: session.cols,
      rows: session.rows,
      title: session.title,
      cwd: session.cwd,
    });

    console.log(`[Terminal] Socket ${socket.id} joined session ${sessionId}`);

    // Broadcast updated session list
    this.broadcastSessionList();
  }

  private terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Notify subscribers
    if (this.io) {
      this.io.to(`terminal:${sessionId}`).emit('terminal:terminated', { sessionId });
    }

    // Remove all socket references
    for (const [socketId, sessionSet] of this.socketSessions.entries()) {
      sessionSet.delete(sessionId);
    }

    // Kill PTY
    session.pty.kill();
    this.sessions.delete(sessionId);

    console.log(`[Terminal] Session terminated: ${sessionId}`);
    this.broadcastSessionList();
  }

  private removeSocketFromAllSessions(socket: Socket): void {
    const sessionSet = this.socketSessions.get(socket.id);
    if (sessionSet) {
      for (const sessionId of sessionSet) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.subscribers.delete(socket);
          socket.leave(`terminal:${sessionId}`);
        }
      }
      this.socketSessions.delete(socket.id);
    }

    // Broadcast updated list (active status may have changed)
    this.broadcastSessionList();
  }

  private cleanupIdleSessions(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivityAt.getTime();

      // Only clean up sessions with no subscribers
      if (session.subscribers.size === 0 && idleTime > SESSION_TIMEOUT) {
        console.log(`[Terminal] Cleaning up idle session: ${id}`);
        session.pty.kill();
        this.sessions.delete(id);
      }
    }
  }

  // === Helpers ===

  private getSessionList(): TerminalSessionSummary[] {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      title: session.title,
      cwd: session.cwd,
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      isActive: session.subscribers.size > 0,
      preview: this.getPreview(session.scrollbackBuffer),
      cols: session.cols,
      rows: session.rows,
    }));
  }

  private getPreview(buffer: string): string {
    // Get last non-empty line as preview
    const lines = buffer.split('\n').filter((line) => line.trim());
    const lastLine = lines[lines.length - 1] || '';
    // Strip ANSI codes and limit length
    return lastLine.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 80);
  }

  private broadcastSessionList(): void {
    if (this.io) {
      // Broadcast to all clients in the terminal namespace
      this.io.emit('terminal:sessions', this.getSessionList());
    }
  }
}
