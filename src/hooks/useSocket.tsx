/**
 * WebSocket Hooks - Client-side real-time connection
 *
 * Single socket, multiple channel subscriptions
 * Auto-reconnect with exponential backoff
 */

'use client';

import { useEffect, useRef, useCallback, useState, createContext, useContext, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Socket context
interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  subscribe: (channel: string, params?: Record<string, unknown>) => void;
  unsubscribe: (channel: string) => void;
  send: (channel: string, action: string, payload?: unknown) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// Provider component
export function SocketProvider({ children, url }: { children: ReactNode; url?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Same origin - unified server handles both HTTP and WebSocket
    const wsUrl = url || (typeof window !== 'undefined' ? window.location.origin : '');

    const newSocket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[WS] Connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
    });

    newSocket.on('error', (err) => {
      console.error('[WS] Error:', err);
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [url]);

  const subscribe = useCallback((channel: string, params?: Record<string, unknown>) => {
    socket?.emit('subscribe', channel, params);
  }, [socket]);

  const unsubscribe = useCallback((channel: string) => {
    socket?.emit('unsubscribe', channel);
  }, [socket]);

  const send = useCallback((channel: string, action: string, payload?: unknown) => {
    socket?.emit('message', channel, action, payload);
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, subscribe, unsubscribe, send }}>
      {children}
    </SocketContext.Provider>
  );
}

// Base hook
export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

// Channel subscription hook
export function useChannel<T = unknown>(
  channel: string,
  params?: Record<string, unknown>,
  events?: Record<string, (data: T) => void>
) {
  const { socket, connected, subscribe, unsubscribe } = useSocket();
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!connected || !socket) return;

    // Subscribe
    subscribe(channel, params);
    setSubscribed(true);

    // Register event handlers
    const handlers: Array<[string, (data: T) => void]> = [];
    if (events) {
      for (const [event, handler] of Object.entries(events)) {
        socket.on(event, handler);
        handlers.push([event, handler]);
      }
    }

    return () => {
      unsubscribe(channel);
      setSubscribed(false);
      handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [connected, socket, channel, JSON.stringify(params)]);

  return { subscribed, connected };
}

// Chat channel hook
interface ChatEvent { type: string; data: unknown; ts: number; }
interface ChatState {
  sessionId: string | null;
  state: 'idle' | 'running' | 'completed' | 'error' | 'aborted';
  events: ChatEvent[];
  error?: string;
}

export function useChat(options?: { sessionId?: string; cwd?: string }) {
  const { socket, connected, send } = useSocket();
  const [state, setState] = useState<ChatState>({
    sessionId: options?.sessionId || null,
    state: 'idle',
    events: [],
  });

  useEffect(() => {
    if (!socket || !connected) return;

    // Subscribe to chat channel
    socket.emit('subscribe', 'chat', { sessionId: options?.sessionId });

    // Event handlers
    const handlers = {
      'chat:ready': () => setState(s => ({ ...s, state: 'idle' })),

      'chat:state': (data: { sessionId: string; state: string; error?: string }) => {
        setState(s => ({
          ...s,
          sessionId: data.sessionId,
          state: data.state as ChatState['state'],
          error: data.error,
        }));
      },

      'chat:replay': (data: { sessionId: string; events: ChatEvent[] }) => {
        setState(s => ({ ...s, events: data.events }));
      },

      'chat:started': (data: { sessionId: string }) => {
        setState(s => ({ ...s, sessionId: data.sessionId, state: 'running', events: [] }));
      },

      'chat:event': (data: { sessionId: string; event: ChatEvent }) => {
        setState(s => ({ ...s, events: [...s.events, data.event] }));
      },

      'chat:completed': (data: { sessionId: string }) => {
        setState(s => ({ ...s, state: 'completed' }));
      },

      'chat:aborted': () => {
        setState(s => ({ ...s, state: 'aborted' }));
      },

      'chat:error': (data: { error: string }) => {
        setState(s => ({ ...s, state: 'error', error: data.error }));
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      socket.emit('unsubscribe', 'chat');
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  }, [socket, connected, options?.sessionId]);

  const startChat = useCallback((message: string, currentPath?: string) => {
    send('chat', 'start', {
      message,
      sessionId: state.sessionId,
      currentPath,
      cwd: options?.cwd,
    });
  }, [send, state.sessionId, options?.cwd]);

  const abort = useCallback(() => {
    if (state.sessionId) {
      send('chat', 'abort', { sessionId: state.sessionId });
    }
  }, [send, state.sessionId]);

  return { ...state, startChat, abort, connected };
}

// Files channel hook
interface FileChange {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  fullPath: string;
  ts: number;
}

export function useFileWatch(watchPath?: string, onFileChange?: (change: FileChange) => void) {
  const { socket, connected } = useSocket();
  const [changes, setChanges] = useState<FileChange[]>([]);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('subscribe', 'files', { path: watchPath });

    const handler = (change: FileChange) => {
      setChanges(prev => [...prev.slice(-99), change]); // Keep last 100
      onFileChange?.(change);
    };

    socket.on('files:change', handler);

    return () => {
      socket.emit('unsubscribe', 'files');
      socket.off('files:change', handler);
    };
  }, [socket, connected, watchPath, onFileChange]);

  const clearChanges = useCallback(() => setChanges([]), []);

  return { changes, clearChanges, connected };
}
