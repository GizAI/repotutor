/**
 * Channel Manager - Pub/Sub Hub
 */

import { Server, Socket } from 'socket.io';

export interface Channel {
  name: string;
  onRegister?(io: Server): void;
  onSubscribe(socket: Socket, params?: Record<string, unknown>): Promise<void> | void;
  onUnsubscribe?(socket: Socket): void;
  onMessage?(socket: Socket, action: string, payload: unknown): Promise<void> | void;
  onDisconnect?(socket: Socket): void;
  onShutdown?(): void;
}

export class ChannelManager {
  private channels = new Map<string, Channel>();
  private io: Server;

  constructor(io: Server) { this.io = io; }

  register(name: string, channel: Channel): void {
    channel.name = name;
    this.channels.set(name, channel);
    channel.onRegister?.(this.io);
    console.log(`[Channel] ${name}`);
  }

  get(name: string): Channel | undefined { return this.channels.get(name); }
  getChannelNames(): string[] { return [...this.channels.keys()]; }

  async subscribe(socket: Socket, name: string, params?: Record<string, unknown>): Promise<void> {
    const ch = this.channels.get(name);
    if (!ch) throw new Error(`Unknown channel: ${name}`);

    const room = params?.sessionId ? `${name}:${params.sessionId}` :
                 params?.path ? `${name}:${params.path}` : name;
    socket.join(room);

    socket.data.subscriptions ??= new Set<string>();
    socket.data.subscriptions.add(name);

    await ch.onSubscribe(socket, params);
  }

  unsubscribe(socket: Socket, name: string): void {
    const ch = this.channels.get(name);
    if (!ch) return;

    [...socket.rooms].filter(r => r.startsWith(`${name}:`)).forEach(r => socket.leave(r));
    socket.data.subscriptions?.delete(name);
    ch.onUnsubscribe?.(socket);
  }

  async handleMessage(socket: Socket, name: string, action: string, payload: unknown): Promise<void> {
    const ch = this.channels.get(name);
    if (!ch?.onMessage) throw new Error(`Channel ${name} doesn't accept messages`);
    await ch.onMessage(socket, action, payload);
  }

  handleDisconnect(socket: Socket): void {
    for (const name of socket.data.subscriptions || []) {
      this.channels.get(name)?.onDisconnect?.(socket);
    }
  }

  broadcast(name: string, event: string, data: unknown, room?: string): void {
    this.io.to(room ? `${name}:${room}` : name).emit(event, data);
  }

  shutdown(): void {
    for (const ch of this.channels.values()) ch.onShutdown?.();
  }
}
