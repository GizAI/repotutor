/**
 * Files Channel - Real-time File System Watching
 *
 * Uses chokidar for efficient file watching with debouncing
 */

import { Server, Socket } from 'socket.io';
import { Channel } from './index';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';

interface FileEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  ts: number;
}

export class FilesChannel implements Channel {
  name = 'files';
  private io!: Server;
  private watchers = new Map<string, { watcher: FSWatcher; clients: Set<string> }>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  onRegister(io: Server) { this.io = io; }

  async onSubscribe(socket: Socket, params?: Record<string, unknown>) {
    const watchPath = (params?.path as string) || process.cwd();
    const normalized = path.resolve(watchPath);

    socket.join(`files:${normalized}`);
    socket.data.watchPath = normalized;

    // Start or reuse watcher
    if (!this.watchers.has(normalized)) {
      this.startWatcher(normalized);
    }
    this.watchers.get(normalized)!.clients.add(socket.id);

    socket.emit('files:subscribed', { path: normalized });
  }

  onUnsubscribe(socket: Socket) {
    const watchPath = socket.data.watchPath as string;
    if (!watchPath) return;

    socket.leave(`files:${watchPath}`);

    const entry = this.watchers.get(watchPath);
    if (entry) {
      entry.clients.delete(socket.id);
      if (entry.clients.size === 0) {
        entry.watcher.close();
        this.watchers.delete(watchPath);
      }
    }
  }

  onDisconnect(socket: Socket) {
    this.onUnsubscribe(socket);
  }

  onShutdown() {
    for (const { watcher } of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  private startWatcher(watchPath: string) {
    const watcher = chokidar.watch(watchPath, {
      ignored: [
        /(^|[\/\\])\../,           // dotfiles
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    const emit = (type: FileEvent['type'], filePath: string) => {
      const relative = path.relative(watchPath, filePath);
      const key = `${type}:${relative}`;

      // Debounce rapid events
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key)!);
      }

      this.debounceTimers.set(key, setTimeout(() => {
        this.debounceTimers.delete(key);
        this.io.to(`files:${watchPath}`).emit('files:change', {
          type, path: relative, fullPath: filePath, ts: Date.now(),
        });
      }, 50));
    };

    watcher
      .on('add', (p) => emit('add', p))
      .on('change', (p) => emit('change', p))
      .on('unlink', (p) => emit('unlink', p))
      .on('addDir', (p) => emit('addDir', p))
      .on('unlinkDir', (p) => emit('unlinkDir', p))
      .on('error', (e) => console.error(`[Files] Watch error:`, e));

    this.watchers.set(watchPath, { watcher, clients: new Set() });
    console.log(`[Files] Watching: ${watchPath}`);
  }
}
