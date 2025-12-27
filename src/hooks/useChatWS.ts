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
  MessageStartEventData, MessageDeltaEventData,
  AuthStatusEventData, HookResponseEventData,
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

// MCP server status
interface McpServerInfo {
  name: string;
  status: 'connected' | 'failed' | 'pending';
}

// Model info from SDK
export interface ModelInfo {
  value: string;
  displayName: string;
  description: string;
}

// Slash command info from SDK
export interface SlashCommand {
  name: string;
  description: string;
  argumentHint?: string;
}

// Permission modes (same as Claude Code CLI)
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export const PERMISSION_MODES: { mode: PermissionMode; label: string; icon: string; color: string }[] = [
  { mode: 'default', label: 'Ask', icon: '🔒', color: 'text-blue-500' },
  { mode: 'acceptEdits', label: 'Auto-Edit', icon: '✏️', color: 'text-amber-500' },
  { mode: 'bypassPermissions', label: 'YOLO', icon: '⚡', color: 'text-red-500' },
  { mode: 'plan', label: 'Plan', icon: '📋', color: 'text-purple-500' },
];

// Commands to hide from UI (internal/rarely used)
const IGNORED_COMMANDS = new Set([
  'exit', 'doctor', 'install-github-app', 'migrate-installer',
  'statusline', 'bashes', 'agents', 'terminal-setup', 'ide',
  'release-notes', 'resume', 'hooks', 'settings',
]);

// Slash command descriptions (from Claude Code CLI)
const COMMAND_DESCRIPTIONS: Record<string, string> = {
  // Core commands
  'help': 'Show available commands',
  'clear': 'Clear conversation history',
  'compact': 'Compact conversation to reduce tokens',
  'config': 'View or modify configuration',
  'cost': 'Show session cost breakdown',
  'doctor': 'Check system health',
  'init': 'Initialize Claude Code in directory',
  'login': 'Authenticate with Anthropic',
  'logout': 'Log out from Anthropic',
  'memory': 'View or edit CLAUDE.md memory',
  'model': 'Switch model (sonnet, opus, haiku)',
  'permissions': 'Manage file/tool permissions',
  'status': 'Show current session status',
  'vim': 'Toggle vim keybindings',
  // Planning & Review
  'plan': 'Create an implementation plan',
  'review': 'Review code changes',
  'pr-comments': 'View PR comments',
  'bug': 'Report a bug',
  // Git
  'commit': 'Create a git commit',
  'diff': 'Show git diff',
  // MCP
  'mcp': 'Manage MCP servers',
  'install-github-app': 'Install GitHub MCP app',
  // System
  'terminal-setup': 'Setup terminal integration',
  'ide': 'Connect to IDE',
  'upgrade': 'Upgrade Claude Code',
  'export': 'Export conversation',
  // Context
  'add-dir': 'Add directory to context',
  'context': 'Show current context',
};

const COMMAND_ARGUMENT_HINTS: Record<string, string> = {
  'model': '<model>',
  'add-dir': '<path>',
  'commit': '[message]',
  'config': '[key] [value]',
  'export': '[format]',
  'memory': '[add|edit|clear]',
  'mcp': '[add|remove|list]',
  'review': '[file]',
};

function getCommandDescription(name: string): string {
  return COMMAND_DESCRIPTIONS[name] || `Run /${name} command`;
}

function getCommandArgumentHint(name: string): string {
  return COMMAND_ARGUMENT_HINTS[name] || '';
}

// Hook response info
interface HookResponse {
  hookName: string;
  hookEvent: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  timestamp: number;
}

interface ChatWSState {
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error' | 'aborted';
  isLoading: boolean;  // Loading session/conversation
  timeline: TimelineItem[];
  streamingContent: string;
  streamingThinking: string;
  activeTools: Map<string, ToolCall>;
  lastUsage: UsageInfo | null;
  contextInfo: ContextInfo;
  sessionCost: number;
  error?: string;
  model?: string;
  selectedModel?: string;  // User-selected model
  selectedPermissionMode: PermissionMode;  // User-selected permission mode
  sessions: SessionInfo[];
  // Session info from init
  tools?: string[];
  skills?: string[];
  mcpServers?: McpServerInfo[];
  permissionMode?: string;
  // SDK event states
  isAuthenticating?: boolean;
  authError?: string;
  hookResponses: HookResponse[];
  stopReason?: string;
  messageId?: string;
  // Available models and commands
  availableModels: ModelInfo[];
  slashCommands: SlashCommand[];
}

const PERMISSION_MODE_KEY = 'chat_permission_mode';

function getSavedPermissionMode(): PermissionMode {
  if (typeof window === 'undefined') return 'bypassPermissions';
  return (localStorage.getItem(PERMISSION_MODE_KEY) as PermissionMode) || 'bypassPermissions';
}

function savePermissionMode(mode: PermissionMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERMISSION_MODE_KEY, mode);
}

const initialState: ChatWSState = {
  sessionId: null,
  status: 'idle',
  isLoading: false,
  timeline: [],
  streamingContent: '',
  streamingThinking: '',
  activeTools: new Map(),
  lastUsage: null,
  contextInfo: {},
  sessionCost: 0,
  sessions: [],
  hookResponses: [],
  availableModels: [],
  slashCommands: [],
  selectedPermissionMode: 'bypassPermissions',
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
    selectedPermissionMode: getSavedPermissionMode(),
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
        // Store all session info from init event
        // Convert slash command names to SlashCommand objects (filter ignored)
        const commands: SlashCommand[] = (data.slashCommands || [])
          .filter(name => !IGNORED_COMMANDS.has(name))
          .map(name => ({
            name,
            description: getCommandDescription(name),
            argumentHint: getCommandArgumentHint(name),
          }));
        setState(s => ({
          ...s,
          model: data.model,
          tools: data.tools,
          skills: data.skills,
          permissionMode: data.permissionMode,
          slashCommands: commands.length > 0 ? commands : s.slashCommands,
          mcpServers: data.mcpServers?.map(m => ({
            name: m.name,
            status: m.status as 'connected' | 'failed' | 'pending',
          })),
        }));
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
            durationMs: data.durationMs,
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            cacheReadTokens: data.cacheReadTokens,
            cacheCreationTokens: data.cacheCreationTokens,
          },
          sessionCost: s.sessionCost + (data.costUsd || 0),
        }));
        break;
      }

      // Message lifecycle events
      case 'message_start': {
        const data = ev.data as MessageStartEventData;
        assistantIdRef.current = data.id;
        if (data.model) {
          setState(s => ({ ...s, model: data.model, messageId: data.id }));
        }
        break;
      }

      case 'message_delta': {
        const data = ev.data as MessageDeltaEventData;
        if (data.stopReason) {
          setState(s => ({ ...s, stopReason: data.stopReason }));
        }
        break;
      }

      case 'message_stop': {
        // Message complete - could trigger timeline update
        break;
      }

      // Authentication status
      case 'auth_status': {
        const data = ev.data as AuthStatusEventData;
        setState(s => ({
          ...s,
          isAuthenticating: data.isAuthenticating,
          authError: data.error,
        }));
        break;
      }

      // Hook execution results - accumulate all responses
      case 'hook_response': {
        const data = ev.data as HookResponseEventData;
        setState(s => ({
          ...s,
          hookResponses: [...s.hookResponses.slice(-9), { // Keep last 10
            hookName: data.hookName,
            hookEvent: data.hookEvent,
            stdout: data.stdout,
            stderr: data.stderr,
            exitCode: data.exitCode,
            timestamp: ev.ts,
          }],
        }));
        break;
      }

      // Thinking block start
      case 'thinking_start': {
        // Reset thinking accumulator for new thinking block
        thinkingRef.current = '';
        break;
      }

      // Signature (extended thinking verification)
      case 'signature': {
        // Could verify thinking authenticity, usually just ignore
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
        const finalThinking = thinkingRef.current;
        const now = Date.now();

        setState(s => {
          const newItems: TimelineItem[] = [];

          // Add thinking to timeline if present
          if (finalThinking) {
            newItems.push({
              id: `thinking-${now}`,
              type: 'thinking' as const,
              timestamp: now,
              content: '',
              thinking: finalThinking,
            });
          }

          // Add assistant message to timeline with full usage info from lastUsage
          if (finalContent) {
            const msgId = assistantIdRef.current || `msg-${now}`;
            // Merge result data with lastUsage (which has token info from 'result' event)
            const usage = s.lastUsage ? {
              ...s.lastUsage,
              durationMs: data.result?.durationMs || s.lastUsage.durationMs,
            } : (data.result ? { costUsd: data.result.costUsd, durationMs: data.result.durationMs } : undefined);
            newItems.push({
              id: msgId,
              type: 'assistant' as const,
              timestamp: now,
              content: finalContent,
              usage,
            });
          }

          if (newItems.length === 0) {
            return { ...s, status: 'completed' as const };
          }

          return {
            ...s,
            status: 'completed' as const,
            timeline: [...s.timeline, ...newItems],
            streamingContent: '',
            streamingThinking: '',
            activeTools: new Map(),
            sessionCost: s.sessionCost + (data.result?.costUsd || 0),
          };
        });

        contentRef.current = '';
        thinkingRef.current = '';
        toolsRef.current.clear();
      },

      'chat:aborted': () => {
        contentRef.current = '';
        toolsRef.current.clear();
        setState(s => ({ ...s, status: 'aborted', streamingContent: '', activeTools: new Map() }));
      },

      'chat:error': (data: { error: string }) => {
        setState(s => ({ ...s, status: 'error', error: data.error, isLoading: false }));
      },

      'chat:loading': () => {
        setState(s => ({ ...s, isLoading: true }));
      },

      'chat:conversation': (data: {
        sessionId: string;
        messages: Array<{
          type: 'user' | 'assistant' | 'tool' | 'thinking';
          content: string;
          timestamp: number;
          model?: string;
          usage?: { costUsd?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number };
          tool?: { id: string; name: string; input?: string; output?: string; status: 'completed' | 'error' };
          thinking?: string;
        }>
      }) => {
        // Convert JSONL messages to timeline items
        const timeline: TimelineItem[] = data.messages.map((msg, idx) => ({
          id: `${msg.type}-${msg.timestamp}-${idx}`,
          type: msg.type,
          timestamp: msg.timestamp,
          content: msg.content,
          model: msg.model,
          usage: msg.usage,
          tool: msg.tool ? { ...msg.tool, status: msg.tool.status } : undefined,
          thinking: msg.thinking,
        }));
        setState(s => ({
          ...s,
          sessionId: data.sessionId,
          timeline,
          status: 'completed',
          isLoading: false,
        }));
      },

      'chat:models': (data: { models: ModelInfo[] }) => {
        setState(s => ({ ...s, availableModels: data.models }));
      },

      'chat:commands': (data: { commands: SlashCommand[] }) => {
        setState(s => ({ ...s, slashCommands: data.commands }));
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
  const send = useCallback((message: string, currentPath?: string, mode: 'claude-code' | 'deepagents' = 'claude-code') => {
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
      mode,
      model: state.selectedModel,
      permissionMode: state.selectedPermissionMode,
    });
  }, [socket, connected, state.sessionId, state.selectedModel, state.selectedPermissionMode, options?.cwd]);

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

  // Select existing session (loads conversation from server)
  const selectSession = useCallback((sessionId: string) => {
    if (!socket) return;
    contentRef.current = '';
    thinkingRef.current = '';
    toolsRef.current.clear();
    saveSessionId(sessionId);
    setState(s => ({
      ...initialState,
      sessions: s.sessions,
      availableModels: s.availableModels,
      slashCommands: s.slashCommands,
      selectedModel: s.selectedModel,
      sessionId,
      isLoading: true,
      status: 'connecting',
    }));
    // Load conversation from JSONL file
    socket.emit('message', 'chat', 'load', { sessionId });
  }, [socket]);

  // Set selected model
  const setSelectedModel = useCallback((model: string) => {
    setState(s => ({ ...s, selectedModel: model }));
  }, []);

  // Fetch available models
  const fetchModels = useCallback(() => {
    if (!socket || !connected) return;
    socket.emit('message', 'chat', 'models', {});
  }, [socket, connected]);

  // Fetch available slash commands
  const fetchCommands = useCallback(() => {
    if (!socket || !connected) return;
    socket.emit('message', 'chat', 'commands', {});
  }, [socket, connected]);

  // Set permission mode
  const setPermissionMode = useCallback((mode: PermissionMode) => {
    savePermissionMode(mode);
    setState(s => ({ ...s, selectedPermissionMode: mode }));
  }, []);

  // Cycle through permission modes (for Tab key)
  const cyclePermissionMode = useCallback(() => {
    const modes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    const currentIndex = modes.indexOf(state.selectedPermissionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    savePermissionMode(nextMode);
    setState(s => ({ ...s, selectedPermissionMode: nextMode }));
  }, [state.selectedPermissionMode]);

  return {
    ...state,
    connected,
    isRunning: state.status === 'running',
    send,
    abort,
    newSession,
    selectSession,
    setSelectedModel,
    fetchModels,
    fetchCommands,
    setPermissionMode,
    cyclePermissionMode,
    // Derived state
    runningSessions: state.sessions.filter(s => s.state === 'running'),
    completedSessions: state.sessions.filter(s => s.state !== 'running'),
  };
}
