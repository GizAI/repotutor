'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from './useSocket';

// Session summary for list display
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

// Joined session data
interface JoinedSessionData {
  sessionId: string;
  buffer: string;
  cols: number;
  rows: number;
  title: string;
  cwd: string;
}

interface TerminalSessionState {
  sessions: TerminalSessionSummary[];
  currentSessionId: string | null;
  connected: boolean;
  cols: number;
  rows: number;
}

export interface UseTerminalSessionReturn {
  // State
  sessions: TerminalSessionSummary[];
  currentSessionId: string | null;
  connected: boolean;
  cols: number;
  rows: number;

  // Session management
  createSession: (options?: { title?: string; cwd?: string }) => void;
  joinSession: (sessionId: string) => void;
  leaveSession: () => void;
  terminateSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  refreshSessions: () => void;

  // Terminal I/O
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  inject: (command: string) => void;

  // Event handlers
  onData: (handler: (sessionId: string, data: string) => void) => void;
  onBuffer: (handler: (sessionId: string, buffer: string) => void) => void;
  onExit: (handler: (sessionId: string, code: number) => void) => void;

  // Connection control
  connect: () => void;
  disconnect: () => void;
}

export function useTerminalSession(): UseTerminalSessionReturn {
  const { socket, connected: socketConnected, subscribe, unsubscribe, send } = useSocket();

  const [state, setState] = useState<TerminalSessionState>({
    sessions: [],
    currentSessionId: null,
    connected: false,
    cols: 120,
    rows: 30,
  });

  // Event handler refs
  const dataHandlerRef = useRef<((sessionId: string, data: string) => void) | null>(null);
  const bufferHandlerRef = useRef<((sessionId: string, buffer: string) => void) | null>(null);
  const exitHandlerRef = useRef<((sessionId: string, code: number) => void) | null>(null);
  const wantsConnectionRef = useRef(false);

  // Subscribe to terminal channel
  const hasSubscribedRef = useRef(false);

  const connect = useCallback(() => {
    wantsConnectionRef.current = true;
    if (socketConnected && socket && !hasSubscribedRef.current) {
      hasSubscribedRef.current = true;
      subscribe('terminal', {});
      setState((prev) => ({ ...prev, connected: true }));
    }
  }, [socketConnected, socket, subscribe]);

  // Unsubscribe from terminal channel
  const disconnect = useCallback(() => {
    wantsConnectionRef.current = false;
    hasSubscribedRef.current = false;
    unsubscribe('terminal');
    setState((prev) => ({
      ...prev,
      connected: false,
      currentSessionId: null,
    }));
  }, [unsubscribe]);

  // Auto-connect when socket becomes available
  useEffect(() => {
    if (socketConnected && socket && wantsConnectionRef.current && !hasSubscribedRef.current) {
      hasSubscribedRef.current = true;
      subscribe('terminal', {});
      setState((prev) => ({ ...prev, connected: true }));
    }

    // Reset when disconnected
    if (!socketConnected) {
      hasSubscribedRef.current = false;
    }
  }, [socketConnected, socket, subscribe]);

  // === Session Management ===

  const createSession = useCallback(
    (options?: { title?: string; cwd?: string }) => {
      send('terminal', 'create', options || {});
    },
    [send]
  );

  const joinSession = useCallback(
    (sessionId: string) => {
      send('terminal', 'join', { sessionId });
    },
    [send]
  );

  const leaveSession = useCallback(() => {
    if (state.currentSessionId) {
      send('terminal', 'leave', { sessionId: state.currentSessionId });
      setState((prev) => ({ ...prev, currentSessionId: null }));
    }
  }, [send, state.currentSessionId]);

  const terminateSession = useCallback(
    (sessionId: string) => {
      send('terminal', 'terminate', { sessionId });
      // If terminating current session, clear it
      if (state.currentSessionId === sessionId) {
        setState((prev) => ({ ...prev, currentSessionId: null }));
      }
    },
    [send, state.currentSessionId]
  );

  const renameSession = useCallback(
    (sessionId: string, title: string) => {
      send('terminal', 'rename', { sessionId, title });
    },
    [send]
  );

  const refreshSessions = useCallback(() => {
    send('terminal', 'list', {});
  }, [send]);

  // === Terminal I/O ===

  const write = useCallback(
    (data: string) => {
      if (state.currentSessionId) {
        send('terminal', 'input', { sessionId: state.currentSessionId, data });
      }
    },
    [send, state.currentSessionId]
  );

  const resize = useCallback(
    (cols: number, rows: number) => {
      if (state.currentSessionId) {
        send('terminal', 'resize', { sessionId: state.currentSessionId, cols, rows });
        setState((prev) => ({ ...prev, cols, rows }));
      }
    },
    [send, state.currentSessionId]
  );

  const inject = useCallback(
    (command: string) => {
      if (state.currentSessionId) {
        send('terminal', 'inject', { sessionId: state.currentSessionId, command });
      }
    },
    [send, state.currentSessionId]
  );

  // === Event Handler Setters ===

  const onData = useCallback((handler: (sessionId: string, data: string) => void) => {
    dataHandlerRef.current = handler;
  }, []);

  const onBuffer = useCallback((handler: (sessionId: string, buffer: string) => void) => {
    bufferHandlerRef.current = handler;
  }, []);

  const onExit = useCallback((handler: (sessionId: string, code: number) => void) => {
    exitHandlerRef.current = handler;
  }, []);

  // === Socket Event Handlers ===

  useEffect(() => {
    if (!socket) return;

    // Session list received
    const handleSessions = (sessions: TerminalSessionSummary[]) => {
      setState((prev) => ({ ...prev, sessions }));
    };

    // Joined session - receive buffer and info
    const handleJoined = (data: JoinedSessionData) => {
      setState((prev) => ({
        ...prev,
        currentSessionId: data.sessionId,
        cols: data.cols,
        rows: data.rows,
      }));
      // Notify buffer handler for scrollback restoration
      bufferHandlerRef.current?.(data.sessionId, data.buffer);
    };

    // Terminal data output
    const handleData = (data: { sessionId: string; data: string }) => {
      dataHandlerRef.current?.(data.sessionId, data.data);
    };

    // Terminal exit
    const handleExit = (data: { sessionId: string; code: number }) => {
      exitHandlerRef.current?.(data.sessionId, data.code);
    };

    // Session terminated
    const handleTerminated = (data: { sessionId: string }) => {
      setState((prev) => {
        const newState = {
          ...prev,
          sessions: prev.sessions.filter((s) => s.id !== data.sessionId),
        };
        // If current session was terminated, clear it
        if (prev.currentSessionId === data.sessionId) {
          newState.currentSessionId = null;
        }
        return newState;
      });
    };

    // Error handling
    const handleError = (data: { message: string; sessionId?: string }) => {
      console.error('[TerminalSession] Error:', data.message, data.sessionId);
    };

    socket.on('terminal:sessions', handleSessions);
    socket.on('terminal:joined', handleJoined);
    socket.on('terminal:data', handleData);
    socket.on('terminal:exit', handleExit);
    socket.on('terminal:terminated', handleTerminated);
    socket.on('terminal:error', handleError);

    return () => {
      socket.off('terminal:sessions', handleSessions);
      socket.off('terminal:joined', handleJoined);
      socket.off('terminal:data', handleData);
      socket.off('terminal:exit', handleExit);
      socket.off('terminal:terminated', handleTerminated);
      socket.off('terminal:error', handleError);
    };
  }, [socket]);

  return {
    // State
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    connected: socketConnected && state.connected,
    cols: state.cols,
    rows: state.rows,

    // Session management
    createSession,
    joinSession,
    leaveSession,
    terminateSession,
    renameSession,
    refreshSessions,

    // Terminal I/O
    write,
    resize,
    inject,

    // Event handlers
    onData,
    onBuffer,
    onExit,

    // Connection control
    connect,
    disconnect,
  };
}
