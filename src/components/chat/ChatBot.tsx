'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useSessionManager, SessionSummary } from '@/hooks/useSessionManager';
import { SessionList } from './SessionList';
import { Icon } from '@/components/ui/Icon';
import { TokenUsagePie } from '@/components/ui/TokenUsagePie';
import { MicButton } from '@/components/ui/MicButton';

// Hook for managing chatbot visibility
export function useChatBot() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}

interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  input?: string;
  elapsed?: number;
  output?: string;
  retryCount?: number;
  toolType?: 'builtin' | 'mcp' | 'server';
  permission?: 'allowed' | 'denied' | 'pending';
}

interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
  durationMs?: number;
}

interface ContextInfo {
  preTokens?: number;
  isCompacting?: boolean;
  lastCompactTrigger?: string;
  checkpointId?: string;
  memoryUsage?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  usage?: UsageInfo;
}

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
  fullScreen?: boolean;
}

export function ChatBot({ isOpen, onClose, currentPath, fullScreen = false }: ChatBotProps) {
  // Session management
  const {
    sessions,
    currentSession,
    selectSession,
    clearCurrent,
    getResumeId,
    setCurrentSessionId,
    refresh,
  } = useSessionManager();

  // UI state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<'claude-code' | 'deepagents'>('claude-code');
  const [lastUsage, setLastUsage] = useState<UsageInfo | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [contextInfo, setContextInfo] = useState<ContextInfo>({});
  const [sessionCost, setSessionCost] = useState(0);
  const [budgetWarning, setBudgetWarning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [budgetLimit, setBudgetLimit] = useState(10);

  // Get budget limit from localStorage (SSR-safe)
  useEffect(() => {
    const stored = localStorage.getItem('budgetLimit');
    if (stored) {
      setBudgetLimit(parseFloat(stored));
    }
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Combine session messages with local messages
  const messages: Message[] = [
    ...(currentSession?.messages || []),
    ...localMessages,
  ];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, activeToolCalls]);

  // Focus input
  useEffect(() => {
    if (isOpen && !showSessions) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showSessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isLoading) {
          abortControllerRef.current?.abort();
        } else if (showSessions) {
          setShowSessions(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, showSessions, onClose]);

  // Clear local messages when session changes
  useEffect(() => {
    setLocalMessages([]);
  }, [currentSession?.id]);

  // Send to unified API
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add local user message
    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setStreamingThinking('');
    setActiveToolCalls([]);

    abortControllerRef.current = new AbortController();

    try {
      // Use credentials: 'same-origin' to send cookies automatically
      const response = await fetch('/api/chat/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          message: trimmedInput,
          mode,
          sessionId: getResumeId(),
          currentPath,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let fullThinking = '';
      let toolCalls: ToolCall[] = [];
      let model = '';
      let sessionId = '';
      let usage: UsageInfo = {};

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const event = JSON.parse(line);

              switch (event.type) {
                case 'init':
                  model = event.data.model;
                  sessionId = event.data.sessionId;
                  if (sessionId) {
                    setCurrentSessionId(sessionId);
                  }
                  setContextInfo(prev => ({ ...prev, isCompacting: false }));
                  break;

                case 'status':
                  // Context compaction status
                  setContextInfo(prev => ({
                    ...prev,
                    isCompacting: event.data.status === 'compacting',
                  }));
                  break;

                case 'compact':
                  // Context compaction event
                  setContextInfo(prev => ({
                    ...prev,
                    preTokens: event.data.preTokens,
                    lastCompactTrigger: event.data.trigger,
                    isCompacting: false,
                  }));
                  break;

                case 'text':
                  fullContent += event.data;
                  setStreamingContent(fullContent);
                  break;

                case 'thinking':
                  fullThinking += event.data;
                  setStreamingThinking(fullThinking);
                  break;

                case 'tool_start':
                  toolCalls = [...toolCalls, {
                    id: event.data.id,
                    name: event.data.name,
                    status: 'running',
                  }];
                  setActiveToolCalls(toolCalls);
                  break;

                case 'tool_progress':
                  toolCalls = toolCalls.map((t) =>
                    t.id === event.data.id ? { ...t, elapsed: event.data.elapsed } : t
                  );
                  setActiveToolCalls(toolCalls);
                  break;

                case 'tool_input':
                  // Accumulate tool input JSON
                  toolCalls = toolCalls.map((t, idx) =>
                    idx === toolCalls.length - 1
                      ? { ...t, input: (t.input || '') + event.data }
                      : t
                  );
                  setActiveToolCalls(toolCalls);
                  break;

                case 'tool_end':
                  toolCalls = toolCalls.map((t) =>
                    t.id === event.data.id ? { ...t, status: 'completed' as const } : t
                  );
                  setActiveToolCalls(toolCalls);
                  break;

                case 'result':
                  sessionId = event.data.sessionId || sessionId;
                  if (sessionId) {
                    setCurrentSessionId(sessionId);
                  }
                  // Capture usage data
                  usage = {
                    inputTokens: event.data.usage?.inputTokens,
                    outputTokens: event.data.usage?.outputTokens,
                    cacheReadTokens: event.data.usage?.cacheReadTokens,
                    cacheCreationTokens: event.data.usage?.cacheCreationTokens,
                    costUsd: event.data.costUsd,
                    durationMs: event.data.durationMs,
                  };
                  setLastUsage(usage);
                  // Track session cost and check budget
                  if (usage.costUsd !== undefined) {
                    setSessionCost(prev => {
                      const newCost = prev + usage.costUsd!;
                      // Check budget warning (80% threshold)
                      if (newCost >= budgetLimit * 0.8 && !budgetWarning) {
                        setBudgetWarning(true);
                      }
                      return newCost;
                    });
                  }
                  // Update context info with total tokens
                  if (usage.inputTokens || usage.outputTokens) {
                    setContextInfo(prev => ({
                      ...prev,
                      preTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
                    }));
                  }
                  toolCalls = toolCalls.map((t) => ({ ...t, status: 'completed' as const }));
                  setActiveToolCalls(toolCalls);
                  break;

                case 'error':
                  throw new Error(event.data.message);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Add local assistant message with full metadata
      const assistantMessage: Message = {
        id: `local-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
        model,
        thinking: fullThinking || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: Object.keys(usage).length > 0 ? usage : undefined,
      };
      setLocalMessages((prev) => [...prev, assistantMessage]);

      setStreamingContent('');
      setStreamingThinking('');
      setActiveToolCalls([]);

      refresh();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setStreamingContent('');
        setStreamingThinking('');
        setActiveToolCalls([]);
      } else {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'An error occurred. Please try again.',
          timestamp: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, messages, currentPath, mode, getResumeId, setCurrentSessionId, refresh]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Image drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedImages(prev => [...prev, { name: file.name, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleNewChat = useCallback(() => {
    clearCurrent();
    setLocalMessages([]);
    setShowSessions(false);
  }, [clearCurrent]);

  const handleSelectSession = useCallback(async (session: SessionSummary) => {
    await selectSession(session.id);
    setLocalMessages([]);
    setShowSessions(false);
  }, [selectSession]);

  if (!isOpen) return null;

  // 풀스크린 모드 (모바일 탭용)
  const containerClass = fullScreen
    ? "flex flex-col h-full w-full bg-[var(--bg-primary)]"
    : "fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:h-screen sm:w-[420px] z-[90] flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-default)]";

  const content = (
    <div className={containerClass}>

        {/* Header */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-[var(--border-default)]">
          {/* History Button */}
          <button
            onClick={() => setShowSessions(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            title="Session history"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <button
              onClick={() => setMode('claude-code')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                mode === 'claude-code'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Claude
            </button>
            <button
              onClick={() => setMode('deepagents')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                mode === 'deepagents'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              DeepAgents
            </button>
          </div>

          {/* Title + Context */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)]">
              <Icon name="spark" className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-[var(--text-tertiary)]">
                {currentSession ? `${currentSession.id.slice(0, 8)}...` : 'New'}
              </div>
            </div>

            {/* Context Meter */}
            {contextInfo.preTokens !== undefined && contextInfo.preTokens > 0 && (
              <ContextMeter
                tokens={contextInfo.preTokens}
                isCompacting={contextInfo.isCompacting}
                maxTokens={200000} // Default context window
                checkpointId={contextInfo.checkpointId}
                onRequestCompaction={() => {
                  // TODO: Implement manual compaction API call
                  setContextInfo(prev => ({ ...prev, isCompacting: true }));
                  setTimeout(() => {
                    setContextInfo(prev => ({ ...prev, isCompacting: false }));
                  }, 2000);
                }}
              />
            )}
          </div>

          {/* Close Button - 풀스크린 모드에서는 숨김 */}
          {!fullScreen && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          )}
        </header>

        {/* Tool Calls */}
        <AnimatePresence>
          {activeToolCalls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]"
            >
              <div className="space-y-2">
                {activeToolCalls.map((tool) => (
                  <ToolCallCard key={tool.id} tool={tool} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking Panel */}
        <AnimatePresence>
          {streamingThinking && showThinking && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 border-b border-[var(--border-default)] bg-amber-500/5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium">Thinking...</span>
                </div>
                <button
                  onClick={() => setShowThinking(false)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  Hide
                </button>
              </div>
              <div className="text-xs text-amber-700/80 whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-thin">
                {streamingThinking}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Budget Warning Banner */}
        <AnimatePresence>
          {budgetWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-xs text-amber-600 font-medium">
                    Budget Warning: ${sessionCost.toFixed(2)} / ${budgetLimit.toFixed(2)} ({((sessionCost / budgetLimit) * 100).toFixed(0)}%)
                  </span>
                </div>
                <button
                  onClick={() => setBudgetWarning(false)}
                  className="text-amber-500 hover:text-amber-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Usage Widget */}
        {lastUsage && lastUsage.costUsd !== undefined && (
          <div className="px-4 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-3">
                {/* Token Usage Pie Chart */}
                {lastUsage.inputTokens !== undefined && lastUsage.outputTokens !== undefined && (
                  <TokenUsagePie
                    used={(lastUsage.inputTokens || 0) + (lastUsage.outputTokens || 0)}
                    total={200000}
                    className="text-[10px]"
                  />
                )}
                {lastUsage.inputTokens !== undefined && (
                  <span>In: {formatTokens(lastUsage.inputTokens)}</span>
                )}
                {lastUsage.outputTokens !== undefined && (
                  <span>Out: {formatTokens(lastUsage.outputTokens)}</span>
                )}
                {lastUsage.cacheReadTokens !== undefined && lastUsage.cacheReadTokens > 0 && (
                  <span className="text-emerald-500">Cache: {formatTokens(lastUsage.cacheReadTokens)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lastUsage.durationMs !== undefined && (
                  <span>{(lastUsage.durationMs / 1000).toFixed(1)}s</span>
                )}
                <span className="font-medium text-[var(--text-secondary)]">
                  ${lastUsage.costUsd.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <main
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin"
        >
          {messages.length === 0 && !streamingContent ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent)] mb-4">
                <Icon name="spark" className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-body-lg font-medium text-[var(--text-primary)] mb-2">Ask about the codebase</h3>
              <p className="text-caption text-[var(--text-secondary)] text-center mb-6">
                Read files, search code, run commands
              </p>

              {/* Quick Actions */}
              <div className="w-full space-y-2">
                {['Explain the project structure', 'Analyze the auth system', 'List API endpoints'].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="w-full px-4 py-3 text-left text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)] transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Streaming */}
              {streamingContent && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
                    <Icon name="spark" className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose-chat">
                      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                    <div className="w-2 h-4 bg-[var(--accent)] animate-pulse-subtle inline-block ml-1 rounded-sm" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <footer
          className={`px-4 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] transition-colors ${
            isDragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)] rounded-lg z-10">
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-[var(--accent)] font-medium">Drop images here</p>
              </div>
            </div>
          )}

          {/* Uploaded images preview */}
          {uploadedImages.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              {uploadedImages.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-16 w-16 object-cover rounded-lg border border-[var(--border-default)]"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Context overflow warning */}
          {contextInfo.preTokens !== undefined && contextInfo.preTokens > 180000 && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Context nearly full. Start a new chat to continue.</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploadedImages.length > 0 ? "Describe the image..." : "Type a message..."}
              rows={1}
              disabled={contextInfo.preTokens !== undefined && contextInfo.preTokens > 195000}
              className="input flex-1 py-2.5 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ maxHeight: '120px' }}
            />
            {/* Voice Input Button */}
            <MicButton
              onTranscript={(text) => setInput((prev) => prev + (prev ? ' ' : '') + text)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
              className="btn btn-primary h-10 w-10 p-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>

          {/* Keyboard Hints */}
          <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-[var(--text-tertiary)]">
            <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">Enter</kbd> Send</span>
            <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">Esc</kbd> {isLoading ? 'Cancel' : 'Close'}</span>
            <span className="text-[var(--text-quaternary)]">Drop images to upload</span>
          </div>
        </footer>

        {/* Session List Overlay */}
        <AnimatePresence>
          {showSessions && (
            <SessionList
              isOpen={showSessions}
              sessions={sessions}
              currentSessionId={currentSession?.id}
              onSelect={handleSelectSession}
              onNew={handleNewChat}
              onClose={() => setShowSessions(false)}
            />
          )}
        </AnimatePresence>
    </div>
  );

  // 풀스크린 모드에서는 애니메이션 없이 반환
  if (fullScreen) {
    return content;
  }

  // 일반 모드에서는 슬라이드 애니메이션 적용
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:h-screen sm:w-[420px] z-[90]"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

// Format token count
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

// Tool Call Card Component with output and error display
function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTab, setShowTab] = useState<'input' | 'output'>('input');

  const isError = tool.status === 'error';
  const hasOutput = tool.output && tool.output.length > 0;

  return (
    <div className={`rounded-lg border overflow-hidden ${
      isError ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--border-default)] bg-[var(--bg-primary)]'
    }`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left ${
          tool.status === 'running' ? 'bg-[var(--accent-soft)]' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          {tool.status === 'running' ? (
            <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          ) : isError ? (
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          )}
          <span className={`font-mono text-xs font-medium ${isError ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
            {tool.name}
          </span>
          {/* Tool type badge */}
          {tool.toolType === 'mcp' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-medium">MCP</span>
          )}
          {tool.toolType === 'server' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">Server</span>
          )}
          {/* Retry indicator */}
          {tool.retryCount !== undefined && tool.retryCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {tool.retryCount}
            </span>
          )}
          {tool.elapsed !== undefined && (
            <span className="text-[10px] text-[var(--text-tertiary)]">{tool.elapsed.toFixed(1)}s</span>
          )}
          {hasOutput && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">output</span>
          )}
          {/* Permission status indicator */}
          {tool.permission === 'denied' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Denied
            </span>
          )}
          {tool.permission === 'pending' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">Pending</span>
          )}
        </div>
        {(tool.input || tool.output) && (
          <svg
            className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (tool.input || tool.output) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Tabs for Input/Output */}
            {hasOutput && (
              <div className="flex border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <button
                  onClick={() => setShowTab('input')}
                  className={`px-3 py-1.5 text-[10px] font-medium ${
                    showTab === 'input'
                      ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  Input
                </button>
                <button
                  onClick={() => setShowTab('output')}
                  className={`px-3 py-1.5 text-[10px] font-medium ${
                    showTab === 'output'
                      ? 'text-emerald-500 border-b-2 border-emerald-500'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  Output
                </button>
              </div>
            )}

            {/* Content */}
            <pre className={`p-3 text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin ${
              isError && showTab === 'output'
                ? 'bg-red-500/5 text-red-500'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
            }`}>
              {showTab === 'input' || !hasOutput
                ? formatToolInput(tool.input || '')
                : formatToolOutput(tool.output || '')}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Format tool output
function formatToolOutput(output: string): string {
  try {
    const parsed = JSON.parse(output);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Truncate long outputs
    if (output.length > 2000) {
      return output.substring(0, 2000) + '\n... (truncated)';
    }
    return output;
  }
}

// Format tool input JSON
function formatToolInput(input: string): string {
  try {
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return input;
  }
}

// Language color map for code blocks
const langColors: Record<string, string> = {
  typescript: '#3178c6',
  ts: '#3178c6',
  javascript: '#f7df1e',
  js: '#f7df1e',
  python: '#3776ab',
  py: '#3776ab',
  rust: '#dea584',
  go: '#00add8',
  java: '#ed8b00',
  kotlin: '#7f52ff',
  swift: '#f05138',
  c: '#555555',
  cpp: '#00599c',
  csharp: '#239120',
  bash: '#89e051',
  sh: '#89e051',
  json: '#cbcb41',
  yaml: '#cb171e',
  sql: '#f29111',
  html: '#e34c26',
  css: '#264de4',
  scss: '#cc6699',
  markdown: '#519aba',
  md: '#519aba',
};

// Code Block Component with syntax highlighting
function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // Inline code
  if (!match) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--accent)] font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    );
  }

  const langColor = langColors[lang.toLowerCase()] || 'var(--text-secondary)';

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-[var(--border-default)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: langColor }}
          />
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase">{lang}</span>
        </div>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Copy code"
        >
          {copied ? (
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
      {/* Code */}
      <pre className="p-3 overflow-x-auto bg-[var(--bg-secondary)] text-[var(--text-primary)]">
        <code className="text-[12px] font-mono leading-relaxed" {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// Image Component with fallback
function MarkdownImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [error, setError] = useState(false);
  const { src, alt, ...rest } = props;

  // Handle Blob type by converting to string or showing placeholder
  const srcString = typeof src === 'string' ? src : undefined;

  if (!srcString || error) {
    return (
      <div className="my-3 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-center">
        <svg className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-xs text-[var(--text-tertiary)]">{alt || 'Image failed to load'}</p>
      </div>
    );
  }

  return (
    <div className="my-3">
      <img
        {...rest}
        src={srcString}
        alt={alt || 'Image'}
        onError={() => setError(true)}
        className="max-w-full h-auto rounded-lg border border-[var(--border-default)]"
        loading="lazy"
      />
      {alt && (
        <p className="mt-1 text-[10px] text-[var(--text-tertiary)] text-center italic">{alt}</p>
      )}
    </div>
  );
}

// Custom markdown components with KaTeX math support
const markdownComponents: Components = {
  code: CodeBlock,
  img: MarkdownImage,
};

// Remark/Rehype plugins for math support
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

// Context Meter Component with checkpoint and compaction controls
function ContextMeter({
  tokens,
  maxTokens,
  isCompacting,
  checkpointId,
  onRequestCompaction,
}: {
  tokens: number;
  maxTokens: number;
  isCompacting?: boolean;
  checkpointId?: string;
  onRequestCompaction?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const percentage = Math.min((tokens / maxTokens) * 100, 100);
  const isWarning = percentage > 70;
  const isCritical = percentage > 90;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 hover:opacity-80"
        title={`Context: ${formatTokens(tokens)} / ${formatTokens(maxTokens)} tokens`}
      >
        {isCompacting && (
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        )}
        {checkpointId && (
          <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
        )}
        <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className={`text-[9px] font-mono ${
          isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-[var(--text-tertiary)]'
        }`}>
          {percentage.toFixed(0)}%
        </span>
      </button>

      {/* Context Details Popup */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-2 w-48 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg z-20"
          >
            <div className="text-xs text-[var(--text-secondary)] space-y-2">
              <div className="flex justify-between">
                <span>Tokens Used:</span>
                <span className="font-mono">{formatTokens(tokens)}</span>
              </div>
              <div className="flex justify-between">
                <span>Max Tokens:</span>
                <span className="font-mono">{formatTokens(maxTokens)}</span>
              </div>
              {checkpointId && (
                <div className="flex justify-between">
                  <span>Checkpoint:</span>
                  <span className="font-mono text-emerald-500">{checkpointId.slice(0, 8)}</span>
                </div>
              )}
              <div className={`flex items-center gap-1 ${
                isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <span>{isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'}</span>
              </div>
              {onRequestCompaction && percentage > 50 && (
                <button
                  onClick={onRequestCompaction}
                  disabled={isCompacting}
                  className="w-full mt-2 px-2 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[10px] hover:border-[var(--accent)] disabled:opacity-50"
                >
                  {isCompacting ? 'Compacting...' : 'Trigger Compaction'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const [showThinkingBlock, setShowThinkingBlock] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--accent)] text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
        <Icon name="spark" className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Thinking Block (Collapsible) */}
        {message.thinking && (
          <div className="mb-3">
            <button
              onClick={() => setShowThinkingBlock(!showThinkingBlock)}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 mb-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="font-medium">Thinking</span>
              <svg
                className={`w-3 h-3 transition-transform ${showThinkingBlock ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <AnimatePresence>
              {showThinkingBlock && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700/80 whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">
                    {message.thinking}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Tool Calls Summary */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {message.toolCalls.map((tool) => (
              <span
                key={tool.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-mono"
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {tool.name}
              </span>
            ))}
          </div>
        )}

        {/* Message Content */}
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Footer: Model + Usage */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
          {message.model && (
            <span>{message.model.replace('claude-', '').replace('-20251101', '')}</span>
          )}
          {message.usage && (
            <>
              {message.usage.costUsd !== undefined && (
                <span>${message.usage.costUsd.toFixed(4)}</span>
              )}
              {message.usage.durationMs !== undefined && (
                <span>{(message.usage.durationMs / 1000).toFixed(1)}s</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
