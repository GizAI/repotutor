/**
 * Gateway Server - Unified entry point
 *
 * - HTTP proxy to Next.js
 * - Socket.io (chat, files, terminal with PTY)
 * - VNC WebSocket proxy with auto-start
 * - Authentication validation
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServer, request as httpRequest, IncomingMessage, ServerResponse } from 'http';
import { createConnection, Socket as NetSocket } from 'net';
import { spawn, ChildProcess, execSync } from 'child_process';
import { parse } from 'url';
import { existsSync } from 'fs';
import { Server as SocketServer, Socket } from 'socket.io';
import { WebSocket, WebSocketServer } from 'ws';
import { ChannelManager } from './src/ws/channels';
import { ChatChannel } from './src/ws/channels/chat';
import { FilesChannel } from './src/ws/channels/files';
import { TerminalChannel } from './src/ws/channels/terminal';

// Configuration
const PORT = parseInt(process.env.PORT || '6001');
const NEXT_PORT = parseInt(process.env.NEXT_PORT || '3000');
const NEXT_HOST = process.env.NEXT_HOST || '127.0.0.1';
const VNC_HOST = '127.0.0.1'; // Always localhost for security
const VNC_PORT = parseInt(process.env.VNC_PORT || '5999');
const VNC_DISPLAY = process.env.VNC_DISPLAY || ':99';
const AUTH_PASSWORD = process.env.GIZ_CODE_PASSWORD || process.env.REPOTUTOR_PASSWORD;

// VNC process management
let vncProcess: ChildProcess | null = null;
let vncStarting = false;

/**
 * Check if VNC server is running
 */
function isVncRunning(): boolean {
  try {
    const socket = createConnection({ host: VNC_HOST, port: VNC_PORT });
    socket.on('connect', () => socket.destroy());
    socket.on('error', () => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Check VNC availability with timeout
 */
function checkVnc(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: VNC_HOST, port: VNC_PORT });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * Check if X11 server is running on a display
 */
function isX11Running(display: string): boolean {
  try {
    execSync(`xdpyinfo -display ${display} >/dev/null 2>&1`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install x11vnc if not present
 */
function installX11vnc(): boolean {
  try {
    execSync('which x11vnc', { stdio: 'ignore' });
    return true;
  } catch {
    console.log('[VNC] x11vnc not found, attempting install...');
    try {
      execSync('sudo apt-get update && sudo apt-get install -y x11vnc', {
        stdio: 'inherit',
        timeout: 120000,
      });
      return true;
    } catch (e) {
      console.error('[VNC] Failed to install x11vnc:', (e as Error).message);
      return false;
    }
  }
}

/**
 * Install TigerVNC if not present
 */
function installTigerVnc(): boolean {
  try {
    execSync('which tigervncserver', { stdio: 'ignore' });
    return true;
  } catch {
    console.log('[VNC] TigerVNC not found, attempting install...');
    try {
      execSync('sudo apt-get update && sudo apt-get install -y tigervnc-standalone-server tigervnc-common', {
        stdio: 'inherit',
        timeout: 120000,
      });
      return true;
    } catch (e) {
      console.error('[VNC] Failed to install TigerVNC:', (e as Error).message);
      return false;
    }
  }
}

/**
 * Start VNC server
 * Strategy:
 * 1. If X11 is already running on display, use x11vnc to expose it
 * 2. Otherwise, start tigervncserver with its own X session
 */
async function startVnc(): Promise<{ success: boolean; message: string }> {
  if (vncStarting) {
    return { success: false, message: 'VNC is already starting' };
  }

  // Check if already running
  if (await checkVnc()) {
    return { success: true, message: 'VNC is already running' };
  }

  vncStarting = true;

  try {
    // Always use Xvnc for better dynamic resize support
    // Even if X11 is running, we start a separate Xvnc session
    {
      // No X11 running, use Xvnc directly for better dynamic resize support
      console.log(`[VNC] Starting Xvnc on display ${VNC_DISPLAY}...`);

      if (!installTigerVnc()) {
        vncStarting = false;
        return { success: false, message: 'Failed to install TigerVNC' };
      }

      // Create xstartup if needed
      const home = process.env.HOME || '/home/user';
      const vncDir = `${home}/.vnc`;
      const xstartup = `${vncDir}/xstartup`;

      if (!existsSync(xstartup)) {
        execSync(`mkdir -p ${vncDir}`);
        execSync(`cat > ${xstartup} << 'EOF'
#!/bin/bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
if command -v startxfce4 &> /dev/null; then
  exec startxfce4
elif command -v xterm &> /dev/null; then
  exec xterm
else
  sleep infinity
fi
EOF`);
        execSync(`chmod +x ${xstartup}`);
      }

      // Kill existing session
      try {
        execSync(`vncserver -kill ${VNC_DISPLAY} 2>/dev/null || true`);
        execSync(`pkill -f "Xvnc.*${VNC_DISPLAY}" 2>/dev/null || true`);
      } catch {}

      // Extract display number (e.g., :99 -> 99)
      const displayNum = VNC_DISPLAY.replace(':', '');
      const rfbPort = 5900 + parseInt(displayNum);

      // Start Xvnc directly with dynamic resize support
      // TigerVNC supports SetDesktopSize with -AcceptSetDesktopSize
      vncProcess = spawn('Xvnc', [
        VNC_DISPLAY,
        '-rfbport', rfbPort.toString(),
        '-SecurityTypes', 'None',
        '-AlwaysShared',
        '-AcceptSetDesktopSize',
        '-localhost',
        '-geometry', '1280x720',
        '-depth', '24',
      ], {
        stdio: 'inherit',
        detached: true,
      });

      vncProcess.unref();

      // Wait a bit for Xvnc to start, then run xstartup
      setTimeout(() => {
        const startupProcess = spawn('bash', [xstartup], {
          env: { ...process.env, DISPLAY: VNC_DISPLAY },
          stdio: 'inherit',
          detached: true,
        });
        startupProcess.unref();
      }, 1000);
    }

    // Wait for VNC to be ready
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await checkVnc()) {
        console.log('[VNC] VNC server started successfully');
        vncStarting = false;
        return { success: true, message: 'VNC started' };
      }
    }

    vncStarting = false;
    return { success: false, message: 'VNC server timeout' };
  } catch (e) {
    vncStarting = false;
    return { success: false, message: (e as Error).message };
  }
}

/**
 * Parse cookies from request
 */
function parseCookies(req: IncomingMessage): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

/**
 * Validate authentication
 */
function isAuthenticated(req: IncomingMessage): boolean {
  // No password configured = allow all
  if (!AUTH_PASSWORD) return true;

  // Check cookie
  const cookies = parseCookies(req);
  if (cookies['repotutor_auth'] === AUTH_PASSWORD) return true;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${AUTH_PASSWORD}`) return true;

  return false;
}

// Create gateway HTTP server
const gateway = createServer((req: IncomingMessage, res: ServerResponse) => {
  const { pathname } = parse(req.url || '/', true);

  // Health check (public)
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      channels: channelManager.getChannelNames(),
      connections: io.engine.clientsCount,
    }));
    return;
  }

  // VNC status/control API (requires auth)
  if (pathname === '/api/vnc/status') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    checkVnc().then(running => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running, port: VNC_PORT, display: VNC_DISPLAY }));
    });
    return;
  }

  if (pathname === '/api/vnc/start' && req.method === 'POST') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    startVnc().then(result => {
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/login/' ||
    pathname?.startsWith('/api/auth/') ||
    pathname?.startsWith('/_next/') ||
    pathname?.startsWith('/locales/') ||
    pathname?.startsWith('/favicon') ||
    pathname?.startsWith('/socket.io');

  // Check authentication for protected routes
  if (AUTH_PASSWORD && !isPublicRoute && !isAuthenticated(req)) {
    // Redirect to login page
    res.writeHead(302, { Location: `/login?redirect=${encodeURIComponent(pathname || '/')}` });
    res.end();
    return;
  }

  // Proxy all other HTTP to Next.js
  const proxyReq = httpRequest({
    hostname: NEXT_HOST,
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy] Error:', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway - Next.js not available');
  });

  req.pipe(proxyReq);
});

// Socket.io for chat, files, terminal (with PTY)
const io = new SocketServer(gateway, {
  path: '/socket.io',
  cors: { origin: '*', credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Socket.io authentication middleware
io.use((socket, next) => {
  if (!AUTH_PASSWORD) {
    return next();
  }

  // Check cookie from handshake
  const cookies = parseCookies(socket.request);
  if (cookies['repotutor_auth'] === AUTH_PASSWORD) {
    return next();
  }

  // Check auth query param (for programmatic access)
  const auth = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (auth === AUTH_PASSWORD) {
    return next();
  }

  console.log('[WS] Unauthorized connection attempt');
  next(new Error('Unauthorized'));
});

// Register channels
const channelManager = new ChannelManager(io);
channelManager.register('chat', new ChatChannel());
channelManager.register('files', new FilesChannel());
channelManager.register('terminal', new TerminalChannel());

io.on('connection', (socket: Socket) => {
  console.log(`[WS] + ${socket.id}`);

  socket.on('subscribe', async (ch: string, params?: Record<string, unknown>) => {
    try {
      await channelManager.subscribe(socket, ch, params);
    } catch (e) {
      socket.emit('error', { channel: ch, message: (e as Error).message });
    }
  });

  socket.on('unsubscribe', (ch: string) => channelManager.unsubscribe(socket, ch));

  socket.on('message', async (ch: string, action: string, payload: unknown) => {
    try {
      await channelManager.handleMessage(socket, ch, action, payload);
    } catch (e) {
      socket.emit('error', { channel: ch, action, message: (e as Error).message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[WS] - ${socket.id} (${reason})`);
    channelManager.handleDisconnect(socket);
  });

  socket.emit('welcome', { channels: channelManager.getChannelNames(), socketId: socket.id });
});

// VNC WebSocket proxy (websockify-style: TCP VNC <-> WebSocket)
const vncWss = new WebSocketServer({ noServer: true });

vncWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  console.log('[VNC] WebSocket client connected');

  // Connect to TCP VNC server
  const vncSocket = createConnection({ host: VNC_HOST, port: VNC_PORT }, () => {
    console.log('[VNC] Connected to VNC server');
  });

  vncSocket.on('data', (data: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  vncSocket.on('end', () => {
    console.log('[VNC] VNC server closed connection');
    ws.close();
  });

  vncSocket.on('error', (err) => {
    console.error('[VNC] VNC socket error:', err.message);
    ws.close(1011, 'VNC server error');
  });

  ws.on('message', (data: Buffer) => {
    if (!vncSocket.destroyed) {
      vncSocket.write(data);
    }
  });

  ws.on('close', () => {
    console.log('[VNC] WebSocket client disconnected');
    vncSocket.destroy();
  });

  ws.on('error', (err) => {
    console.error('[VNC] WebSocket error:', err.message);
    vncSocket.destroy();
  });
});

// Handle WebSocket upgrades
gateway.on('upgrade', (req: IncomingMessage, socket: NetSocket, head: Buffer) => {
  const { pathname } = parse(req.url || '/', true);

  // VNC WebSocket (requires auth)
  if (pathname === '/ws/vnc') {
    if (!isAuthenticated(req)) {
      console.log('[VNC] Unauthorized WebSocket upgrade attempt');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    vncWss.handleUpgrade(req, socket, head, (ws) => {
      vncWss.emit('connection', ws, req);
    });
    return;
  }

  // Next.js HMR WebSocket - proxy to Next.js
  if (pathname === '/_next/webpack-hmr') {
    const nextWs = new WebSocket(`ws://${NEXT_HOST}:${NEXT_PORT}${req.url}`);

    nextWs.on('open', () => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                   'Upgrade: websocket\r\n' +
                   'Connection: Upgrade\r\n\r\n');
    });

    nextWs.on('message', (data) => socket.write(data as Buffer));
    nextWs.on('close', () => socket.end());
    nextWs.on('error', () => socket.end());

    socket.on('data', (data: Buffer) => nextWs.readyState === WebSocket.OPEN && nextWs.send(data));
    socket.on('close', () => nextWs.close());
    socket.on('error', () => nextWs.close());
    return;
  }

  // Socket.io handles its own upgrades via middleware
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Gateway] Shutting down...');
  channelManager.shutdown();
  if (vncProcess) {
    vncProcess.kill();
  }
  io.close(() => {
    gateway.close(() => {
      console.log('[Gateway] Closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('[Gateway] Interrupted, shutting down...');
  process.emit('SIGTERM');
});

gateway.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  Giz Code Gateway                              ║
╠════════════════════════════════════════════════╣
║  Gateway:    http://localhost:${PORT.toString().padEnd(18)}║
║  Next.js:    http://${NEXT_HOST}:${NEXT_PORT} (internal)        ║
║  VNC:        ${VNC_HOST}:${VNC_PORT} (${VNC_DISPLAY})`.padEnd(48) + `║
║  Channels:   ${channelManager.getChannelNames().join(', ').padEnd(30)}║
║  Auth:       ${(AUTH_PASSWORD ? 'enabled' : 'disabled').padEnd(30)}║
╚════════════════════════════════════════════════╝
  `);
});
