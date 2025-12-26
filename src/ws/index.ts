/**
 * WebSocket Server - Real-time Hub
 *
 * Channels:
 * - chat: Claude Agent sessions (persistent)
 * - files: File system changes
 */

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { ChannelManager } from './channels';
import { ChatChannel } from './channels/chat';
import { FilesChannel } from './channels/files';

const PORT = parseInt(process.env.WS_PORT || '6002');
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:6001';

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      channels: channelManager.getChannelNames(),
      connections: io.engine.clientsCount,
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

const channelManager = new ChannelManager(io);
channelManager.register('chat', new ChatChannel());
channelManager.register('files', new FilesChannel());

io.on('connection', (socket: Socket) => {
  console.log(`[WS] + ${socket.id}`);

  socket.on('subscribe', async (ch: string, params?: Record<string, unknown>) => {
    try { await channelManager.subscribe(socket, ch, params); }
    catch (e) { socket.emit('error', { channel: ch, message: (e as Error).message }); }
  });

  socket.on('unsubscribe', (ch: string) => channelManager.unsubscribe(socket, ch));

  socket.on('message', async (ch: string, action: string, payload: unknown) => {
    try { await channelManager.handleMessage(socket, ch, action, payload); }
    catch (e) { socket.emit('error', { channel: ch, action, message: (e as Error).message }); }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[WS] - ${socket.id} (${reason})`);
    channelManager.handleDisconnect(socket);
  });

  socket.emit('welcome', { channels: channelManager.getChannelNames(), socketId: socket.id });
});

process.on('SIGTERM', () => {
  channelManager.shutdown();
  io.close(() => httpServer.close(() => process.exit(0)));
});

httpServer.listen(PORT, () => console.log(`[WS] :${PORT}`));

export { io, channelManager };
