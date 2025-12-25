'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSessionManager, SessionSummary } from '@/hooks/useSessionManager';
import { SessionList } from './SessionList';
import { Icon } from '@/components/ui/Icon';

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
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

export function ChatBot({ isOpen, onClose, currentPath }: ChatBotProps) {
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
          mode: 'claude-code',
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
      let toolCalls: ToolCall[] = [];
      let model = '';
      let sessionId = '';

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
                  break;

                case 'text':
                  fullContent += event.data;
                  setStreamingContent(fullContent);
                  break;

                case 'thinking':
                  setStreamingThinking((prev) => prev + event.data);
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

                case 'result':
                  sessionId = event.data.sessionId || sessionId;
                  if (sessionId) {
                    setCurrentSessionId(sessionId);
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

      // Add local assistant message
      const assistantMessage: Message = {
        id: `local-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
        model,
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
  }, [input, isLoading, messages, currentPath, getResumeId, setCurrentSessionId, refresh]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:h-screen sm:w-[420px] z-[90] flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-default)]"
      >
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

          {/* Title */}
          <div className="flex-1 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]">
              <Icon name="spark" className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)]">Claude Code</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">
                {currentSession ? `Session: ${currentSession.id.slice(0, 8)}...` : 'New conversation'}
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
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
              <div className="flex items-center gap-2 flex-wrap">
                {activeToolCalls.map((tool) => (
                  <div
                    key={tool.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      tool.status === 'running'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}
                  >
                    {tool.status === 'running' ? (
                      <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                    <span className="font-mono">{tool.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
        <footer className="px-4 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="input flex-1 py-2.5 resize-none"
              style={{ maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
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
      </motion.div>
    </AnimatePresence>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
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
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Model Badge */}
        {message.model && (
          <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">
            {message.model.replace('claude-', '').replace('-20251101', '')}
          </div>
        )}
      </div>
    </div>
  );
}
