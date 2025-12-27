'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from './useSocket';

interface TerminalState {
  connected: boolean;
  cols: number;
  rows: number;
}

export function useTerminal() {
  const { socket, connected: socketConnected, subscribe, unsubscribe, send } = useSocket();
  const [state, setState] = useState<TerminalState>({
    connected: false,
    cols: 120,
    rows: 30,
  });
  const dataHandlerRef = useRef<((data: string) => void) | null>(null);
  const exitHandlerRef = useRef<((code: number) => void) | null>(null);
  const wantsConnectionRef = useRef(false);

  // Subscribe to terminal channel
  const connect = useCallback(() => {
    wantsConnectionRef.current = true;
    if (socketConnected) {
      subscribe('terminal', {});
    }
    // 소켓 미연결 시 아래 useEffect에서 자동 연결
  }, [socketConnected, subscribe]);

  // Unsubscribe from terminal channel
  const disconnect = useCallback(() => {
    wantsConnectionRef.current = false;
    unsubscribe('terminal');
    setState((prev) => ({ ...prev, connected: false }));
  }, [unsubscribe]);

  // 소켓 연결 시 pending connect 처리
  useEffect(() => {
    if (socketConnected && wantsConnectionRef.current) {
      subscribe('terminal', {});
    }
  }, [socketConnected, subscribe]);

  // Send input to terminal
  const write = useCallback(
    (data: string) => {
      send('terminal', 'input', data);
    },
    [send]
  );

  // Resize terminal
  const resize = useCallback(
    (cols: number, rows: number) => {
      send('terminal', 'resize', { cols, rows });
      setState((prev) => ({ ...prev, cols, rows }));
    },
    [send]
  );

  // Inject command (AI command injection)
  const inject = useCallback(
    (command: string) => {
      send('terminal', 'inject', { command });
    },
    [send]
  );

  // Set data handler
  const onData = useCallback((handler: (data: string) => void) => {
    dataHandlerRef.current = handler;
  }, []);

  // Set exit handler
  const onExit = useCallback((handler: (code: number) => void) => {
    exitHandlerRef.current = handler;
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleReady = (data: { cols: number; rows: number }) => {
      setState({ connected: true, cols: data.cols, rows: data.rows });
    };

    const handleData = (data: string) => {
      dataHandlerRef.current?.(data);
    };

    const handleExit = (data: { code: number }) => {
      exitHandlerRef.current?.(data.code);
    };

    socket.on('terminal:ready', handleReady);
    socket.on('terminal:data', handleData);
    socket.on('terminal:exit', handleExit);

    return () => {
      socket.off('terminal:ready', handleReady);
      socket.off('terminal:data', handleData);
      socket.off('terminal:exit', handleExit);
    };
  }, [socket]);

  return {
    connected: socketConnected && state.connected,
    cols: state.cols,
    rows: state.rows,
    connect,
    disconnect,
    write,
    resize,
    inject,
    onData,
    onExit,
  };
}
