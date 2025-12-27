/**
 * Terminal Channel - PTY management via node-pty
 *
 * Message protocol:
 * - input: Send keystrokes to terminal
 * - resize: Resize terminal (cols, rows)
 * - inject: Inject command (appends newline)
 */

import { Server, Socket } from 'socket.io';
import type { Channel } from './index';
import * as pty from 'node-pty';

interface ResizePayload {
  cols: number;
  rows: number;
}

interface InjectPayload {
  command: string;
}

export class TerminalChannel implements Channel {
  name = 'terminal';
  private io: Server | null = null;
  private term: pty.IPty | null = null;
  private clients = new Set<Socket>();

  onRegister(io: Server): void {
    this.io = io;
    console.log('[Terminal] Channel registered');
  }

  onSubscribe(socket: Socket): void {
    this.clients.add(socket);
    console.log(`[Terminal] Client subscribed: ${socket.id}`);

    if (!this.term) {
      this.createTerm();
    }

    // Send welcome message
    socket.emit('terminal:ready', { cols: this.term?.cols, rows: this.term?.rows });
  }

  onUnsubscribe(socket: Socket): void {
    this.clients.delete(socket);
    console.log(`[Terminal] Client unsubscribed: ${socket.id}`);
  }

  onMessage(socket: Socket, action: string, payload: unknown): void {
    if (!this.term) {
      console.warn('[Terminal] No terminal instance');
      return;
    }

    switch (action) {
      case 'input':
        this.term.write(payload as string);
        break;
      case 'resize': {
        const { cols, rows } = payload as ResizePayload;
        if (cols > 0 && rows > 0) {
          this.term.resize(cols, rows);
        }
        break;
      }
      case 'inject': {
        const { command } = payload as InjectPayload;
        this.term.write(command + '\n');
        console.log(`[Terminal] Injected: ${command}`);
        break;
      }
      default:
        console.warn(`[Terminal] Unknown action: ${action}`);
    }
  }

  onDisconnect(socket: Socket): void {
    this.clients.delete(socket);
    console.log(`[Terminal] Client disconnected: ${socket.id}`);

    // Keep terminal alive even when no clients
    // (useful for session persistence)
  }

  onShutdown(): void {
    if (this.term) {
      this.term.kill();
      this.term = null;
      console.log('[Terminal] Terminal killed on shutdown');
    }
  }

  private createTerm(): void {
    const shell = process.env.TERMINAL_SHELL || process.env.SHELL || '/bin/bash';
    const cwd = process.env.TERMINAL_CWD || process.env.HOME || '/home/user';

    this.term = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: process.env as Record<string, string>,
    });

    this.term.onData((data) => {
      // Broadcast to all connected clients
      this.clients.forEach((socket) => {
        socket.emit('terminal:data', data);
      });
    });

    this.term.onExit(({ exitCode }) => {
      console.log(`[Terminal] Terminal exited with code ${exitCode}`);
      this.clients.forEach((socket) => {
        socket.emit('terminal:exit', { code: exitCode });
      });
      this.term = null;

      // Auto-restart terminal after exit
      setTimeout(() => {
        if (this.clients.size > 0) {
          this.createTerm();
        }
      }, 500);
    });

    console.log(`[Terminal] Terminal created: ${shell} in ${cwd}`);
  }
}
