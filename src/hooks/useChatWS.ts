/**
 * useChatWS - WebSocket-based Chat Hook
 *
 * Features:
 * - Connection to chat channel
 * - Session persistence across refresh (via server-side buffering)
 * - Event stream processing
 * - Message + tool call timeline (chronological)
 * - Tool result handling
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import type {
  ToolCall, UsageInfo, ContextInfo, ChatEvent,
  ToolStartEventData, ToolProgressEventData, ToolResultEventData,
  StatusEventData, ResultEventData, InitEventData,
} from '@/components/chat/types';

// Timeline item - message or tool call, ordered by time
export interface TimelineItem {
  id: string;
  type: 'user' | 'assistant' | 'tool' | 'thinking';
  timestamp: number;
  content?: string;
  model?: string;
  usage?: UsageInfo;
  tool?: ToolCall;
  thinking?: string;
}

// Session info from server
export interface SessionInfo {
  id: string;
  state: 'running' | 'completed' | 'error' | 'aborted';
  startedAt: number;
  endedAt?: number;
  model?: string;
  title?: string;
}

interface ChatWSState {
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error' | 'aborted';
  timeline: TimelineItem[];
  streamingContent: string;
  streamingThinking: string;
  activeTools: Map<string, ToolCall>;
  lastUsage: UsageInfo | null;
  contextInfo: ContextInfo;
  sessionCost: number;
  error?: string;
  model?: string;
  sessions: SessionInfo[];
}

const initialState: ChatWSState = {
  sessionId: null,
  status: 'idle',
  timeline: [],
  streamingContent: '',
  streamingThinking: '',
  activeTools: new Map(),
  lastUsage: null,
  contextInfo: {},
  sessionCost: 0,
  sessions: [],
};

const STORAGE_KEY = 'chat_session_id';

function getSavedSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

function saveSessionId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useChatWS(options?: { sessionId?: string; cwd?: string }) {
  const { socket, connected } = useSocket();
  const [state, setState] = useState<ChatWSState>(() => ({
    ...initialState,
    sessionId: options?.sessionId || getSavedSessionId(),
  }));

  // Refs for accumulating streaming content
  const contentRef = useRef('');
  const thinkingRef = useRef('');
  const toolsRef = useRef<Map<string, ToolCall>>(new Map());
  const assistantIdRef = useRef<string | null>(null);

  // Process a single event
  const processEvent = useCallback((ev: ChatEvent) => {
    switch (ev.type) {
      case 'init': {
        const data = ev.data as InitEventData;
        // Keep server sessionId, only update model (SDK sessionId is different from server sessionId)
        setState(s => ({ ...s, model: data.model }));
        break;
      }

      case 'text': {
        contentRef.current += ev.data as string;
        const content = contentRef.current;
        setState(s => ({ ...s, streamingContent: content }));
        break;
      }

      case 'thinking': {
        thinkingRef.current += ev.data as string;
        const thinking = thinkingRef.current;
        setState(s => ({ ...s, streamingThinking: thinking }));
        break;
      }

      case 'tool_start': {
        const data = ev.data as ToolStartEventData;
        const tool: ToolCall = { id: data.id, name: data.name, status: 'running' };
        toolsRef.current.set(data.id, tool);
        setState(s => ({
          ...s,
          timeline: [...s.timeline, { id: `tool-${data.id}`, type: 'tool', timestamp: ev.ts, tool }],
          activeTools: new Map(toolsRef.current),
        }));
        break;
      }

      case 'tool_input': {
        const lastTool = Array.from(toolsRef.current.values()).pop();
        if (lastTool) {
          lastTool.input = (lastTool.input || '') + (ev.data as string);
          toolsRef.current.set(lastTool.id, lastTool);
          setState(s => ({
            ...s,
            timeline: s.timeline.map(item =>
              item.type === 'tool' && item.tool?.id === lastTool.id
                ? { ...item, tool: { ...lastTool } }
                : item
            ),
            activeTools: new Map(toolsRef.current),
          }));
        }
        break;
      }

      case 'tool_result': {
        const data = ev.data as ToolResultEventData;
        const tool = toolsRef.current.get(data.id);
        if (tool) {
          tool.status = data.isError ? 'error' : 'completed';
          tool.output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2);
          toolsRef.current.set(data.id, tool);
          setState(s => ({
            ...s,
            timeline: s.timeline.map(item =>
              item.type === 'tool' && item.tool?.id === data.id
                ? { ...item, tool: { ...tool } }
                : item
            ),
            activeTools: new Map(toolsRef.current),
          }));
        }
        break;
      }

      case 'tool_progress': {
        const data = ev.data as ToolProgressEventData;
        const tool = toolsRef.current.get(data.id);
        if (tool) {
          tool.elapsed = data.elapsed;
          toolsRef.current.set(data.id, tool);
          setState(s => ({
            ...s,
            timeline: s.timeline.map(item =>
              item.type === 'tool' && item.tool?.id === data.id
                ? { ...item, tool: { ...tool } }
                : item
            ),
            activeTools: new Map(toolsRef.current),
          }));
        }
        break;
      }

      case 'block_stop': {
        // Mark running tools as completed if no result yet
        for (const [id, tool] of toolsRef.current) {
          if (tool.status === 'running') {
            tool.status = 'completed';
            toolsRef.current.set(id, tool);
          }
        }
        setState(s => ({
          ...s,
          timeline: s.timeline.map(item =>
            item.type === 'tool' && item.tool?.status === 'running'
              ? { ...item, tool: { ...item.tool, status: 'completed' } }
              : item
          ),
          activeTools: new Map(toolsRef.current),
        }));
        break;
      }

      case 'status': {
        const data = ev.data as StatusEventData;
        setState(s => ({
          ...s,
          contextInfo: {
            ...s.contextInfo,
            isCompacting: data.status === 'compacting',
          },
        }));
        break;
      }

      case 'result': {
        const data = ev.data as ResultEventData;
        setState(s => ({
          ...s,
          lastUsage: {
            costUsd: data.costUsd,
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            cacheReadTokens: data.cacheReadTokens,
            cacheCreationTokens: data.cacheCreationTokens,
          },
          sessionCost: s.sessionCost + (data.costUsd || 0),
        }));
        break;
      }
    }
  }, []);

  // Subscribe to chat channel
  useEffect(() => {
    if (!socket || !connected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, (data: any) => void> = {
      'chat:ready': () => setState(s => ({ ...s, status: 'idle' })),

      'chat:sessions': (data: { sessions: SessionInfo[] }) => {
        setState(s => ({ ...s, sessions: data.sessions }));
      },

      'chat:state': (data: { sessionId: string; state: string; error?: string }) => {
        setState(s => ({
          ...s,
          sessionId: data.sessionId,
          status: data.state as ChatWSState['status'],
          error: data.error,
        }));
      },

      'chat:replay': (data: { sessionId: string; events: ChatEvent[] }) => {
        data.events.forEach(processEvent);
      },

      'chat:started': (data: { sessionId: string }) => {
        contentRef.current = '';
        thinkingRef.current = '';
        toolsRef.current.clear();
        assistantIdRef.current = `msg-${Date.now()}`;
        saveSessionId(data.sessionId);
        setState(s => ({
          ...s,
          sessionId: data.sessionId,
          status: 'running',
          streamingContent: '',
          streamingThinking: '',
        }));
      },

      'chat:event': (data: { sessionId: string; event: ChatEvent }) => {
        processEvent(data.event);
      },

      'chat:completed': (data: { sessionId: string; result?: { costUsd?: number; durationMs?: number } }) => {
        const finalContent = contentRef.current;
        if (finalContent) {
          const msgId = assistantIdRef.current || `msg-${Date.now()}`;
          const usage = data.result ? { costUsd: data.result.costUsd, durationMs: data.result.durationMs } : undefined;
          setState(s => ({
            ...s,
            status: 'completed',
            timeline: [...s.timeline, {
              id: msgId,
              type: 'assistant' as const,
              timestamp: Date.now(),
              content: finalContent,
              usage,
            }],
            streamingContent: '',
            streamingThinking: '',
            activeTools: new Map(),
            lastUsage: usage || null,
            sessionCost: s.sessionCost + (data.result?.costUsd || 0),
          }));
          contentRef.current = '';
          thinkingRef.current = '';
          toolsRef.current.clear();
        } else {
          setState(s => ({ ...s, status: 'completed' }));
        }
      },

      'chat:aborted': () => {
        contentRef.current = '';
        toolsRef.current.clear();
        setState(s => ({ ...s, status: 'aborted', streamingContent: '', activeTools: new Map() }));
      },

      'chat:error': (data: { error: string }) => {
        setState(s => ({ ...s, status: 'error', error: data.error }));
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    // Subscribe AFTER handlers are registered to avoid race condition
    // Use options.sessionId or localStorage (not state.sessionId to avoid re-subscribe loops)
    const savedSessionId = options?.sessionId || getSavedSessionId();
    socket.emit('subscribe', 'chat', { sessionId: savedSessionId });

    return () => {
      socket.emit('unsubscribe', 'chat');
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  }, [socket, connected, options?.sessionId, processEvent]);

  // Send message
  const send = useCallback((message: string, currentPath?: string) => {
    if (!socket || !connected) return;

    setState(s => ({
      ...s,
      timeline: [...s.timeline, {
        id: `user-${Date.now()}`,
        type: 'user',
        timestamp: Date.now(),
        content: message,
      }],
      status: 'running',
    }));

    socket.emit('message', 'chat', 'start', {
      message,
      sessionId: state.sessionId,
      currentPath,
      cwd: options?.cwd,
    });
  }, [socket, connected, state.sessionId, options?.cwd]);

  // Abort current session
  const abort = useCallback(() => {
    if (!socket || !state.sessionId) return;
    socket.emit('message', 'chat', 'abort', { sessionId: state.sessionId });
  }, [socket, state.sessionId]);

  // Start new session
  const newSession = useCallback(() => {
    contentRef.current = '';
    thinkingRef.current = '';
    toolsRef.current.clear();
    saveSessionId(null);
    setState(s => ({ ...initialState, sessions: s.sessions }));
  }, []);

  // Select existing session
  const selectSession = useCallback((sessionId: string) => {
    if (!socket) return;
    contentRef.current = '';
    thinkingRef.current = '';
    toolsRef.current.clear();
    saveSessionId(sessionId);
    setState(s => ({
      ...initialState,
      sessions: s.sessions,
      sessionId,
      status: 'connecting',
    }));
    // Re-subscribe to get session state and replay
    socket.emit('subscribe', 'chat', { sessionId });
  }, [socket]);

  return {
    ...state,
    connected,
    isRunning: state.status === 'running',
    send,
    abort,
    newSession,
    selectSession,
    // Derived state
    runningSessions: state.sessions.filter(s => s.state === 'running'),
    completedSessions: state.sessions.filter(s => s.state !== 'running'),
  };
}
