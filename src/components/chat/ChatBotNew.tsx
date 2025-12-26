/**
 * ChatBot - WebSocket-based with Timeline View
 *
 * Features:
 * - Persistent sessions (survives browser refresh via server buffering)
 * - Chronological timeline (messages + tools interleaved)
 * - Real-time streaming with tool output
 * - Session list with running/completed status
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { useChatWS, TimelineItem, SessionInfo } from '@/hooks/useChatWS';
import { ToolCallCard, ContextMeter, CodeBlock } from './parts';
import { Icon } from '@/components/ui/Icon';
import { TokenUsagePie } from '@/components/ui/TokenUsagePie';
import { MicButton } from '@/components/ui/MicButton';
import {
  Clock, Send, Plus, X, Lightbulb, AlertTriangle,
  ChevronDown, Check, XCircle
} from 'lucide-react';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
  fullScreen?: boolean;
}

export function ChatBotNew({ isOpen, onClose, currentPath, fullScreen = false }: ChatBotProps) {
  const chat = useChatWS();

  // UI state
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [budgetLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('budgetLimit') || '10');
    }
    return 10;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const budgetWarning = chat.sessionCost >= budgetLimit * 0.8;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.timeline, chat.streamingContent]);

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
        if (chat.isRunning) {
          chat.abort();
        } else if (showSessions) {
          setShowSessions(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, chat.isRunning, showSessions, onClose, chat]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || chat.isRunning) return;
    setInput('');
    chat.send(msg, currentPath);
  }, [input, chat, currentPath]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImages(prev => [...prev, { name: file.name, dataUrl: ev.target?.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleNewChat = useCallback(() => {
    chat.newSession();
    setShowSessions(false);
  }, [chat]);

  const handleSelectSession = useCallback((session: SessionInfo) => {
    chat.selectSession(session.id);
    setShowSessions(false);
  }, [chat]);

  if (!isOpen) return null;

  const containerClass = fullScreen
    ? "flex flex-col h-full w-full bg-[var(--bg-primary)]"
    : "flex flex-col h-full bg-[var(--bg-primary)]";

  return (
    <div className={containerClass}>
      {/* Header */}
      <header className="flex items-center gap-3 h-14 px-4 border-b border-[var(--border-default)]">
        {/* History button with running indicator */}
        <button onClick={() => setShowSessions(true)}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">
          <Clock className="w-4 h-4" />
          {chat.runningSessions.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-[10px] text-white rounded-full flex items-center justify-center">
              {chat.runningSessions.length}
            </span>
          )}
        </button>

        {/* Connection status */}
        <div className={`w-2 h-2 rounded-full ${chat.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />

        <div className="flex-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)]">
            <Icon name="spark" className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)]">
              Claude Agent
              {chat.isRunning && <span className="ml-2 text-xs text-emerald-500">(running)</span>}
            </div>
            {chat.sessionId && (
              <div className="text-[10px] text-[var(--text-tertiary)]">{chat.sessionId.slice(0, 12)}...</div>
            )}
          </div>

          {chat.contextInfo.isCompacting && (
            <div className="text-xs text-amber-500 animate-pulse">Compacting...</div>
          )}

          {chat.contextInfo.preTokens && chat.contextInfo.preTokens > 0 && (
            <ContextMeter tokens={chat.contextInfo.preTokens} maxTokens={200000}
              isCompacting={chat.contextInfo.isCompacting} />
          )}
        </div>

        {!fullScreen && (
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">
            <Icon name="close" className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Thinking panel */}
      <AnimatePresence>
        {chat.streamingThinking && showThinking && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-b border-[var(--border-default)] bg-amber-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <Lightbulb className="w-3.5 h-3.5 animate-pulse" />
                <span className="font-medium">Thinking...</span>
              </div>
              <button onClick={() => setShowThinking(false)} className="text-xs text-[var(--text-tertiary)]">Hide</button>
            </div>
            <div className="text-xs text-amber-700/80 whitespace-pre-wrap max-h-32 overflow-y-auto">{chat.streamingThinking}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget warning */}
      <AnimatePresence>
        {budgetWarning && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">
                Budget: ${chat.sessionCost.toFixed(2)} / ${budgetLimit.toFixed(2)} ({((chat.sessionCost / budgetLimit) * 100).toFixed(0)}%)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage widget */}
      {chat.lastUsage?.costUsd !== undefined && (
        <div className="px-4 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
            <div className="flex items-center gap-3">
              {chat.lastUsage.inputTokens !== undefined && chat.lastUsage.outputTokens !== undefined && (
                <TokenUsagePie used={(chat.lastUsage.inputTokens || 0) + (chat.lastUsage.outputTokens || 0)} total={200000} />
              )}
            </div>
            <span className="font-medium text-[var(--text-secondary)]">${chat.lastUsage.costUsd.toFixed(4)}</span>
          </div>
        </div>
      )}

      {/* Timeline (messages + tools interleaved) */}
      <main className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {chat.timeline.length === 0 && !chat.streamingContent ? (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent)] mb-4">
              <Icon name="spark" className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-body-lg font-medium text-[var(--text-primary)] mb-2">
              {chat.connected ? 'Ask about the codebase' : 'Connecting...'}
            </h3>
            <p className="text-caption text-[var(--text-secondary)] text-center mb-6">
              {chat.connected ? 'Sessions persist across browser refresh' : 'Waiting for WebSocket'}
            </p>
            {chat.connected && (
              <div className="w-full space-y-2">
                {['Explain the project structure', 'Find all API endpoints', 'List main components'].map((q) => (
                  <button key={q} onClick={() => setInput(q)}
                    className="w-full px-4 py-3 text-left text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)]">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {chat.timeline.map((item) => (
              <TimelineItemView key={item.id} item={item} />
            ))}

            {/* Streaming content */}
            {chat.streamingContent && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
                  <Icon name="spark" className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                      components={{ code: CodeBlock }}>
                      {chat.streamingContent}
                    </ReactMarkdown>
                  </div>
                  <div className="w-2 h-4 bg-[var(--accent)] animate-pulse inline-block ml-1 rounded-sm" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <footer className={`px-4 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] ${isDragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : ''}`}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--accent-soft)] border-2 border-dashed border-[var(--accent)] rounded-lg z-10">
            <p className="text-sm text-[var(--accent)] font-medium">Drop images here</p>
          </div>
        )}

        {uploadedImages.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="relative flex-shrink-0">
                <img src={img.dataUrl} alt={img.name} className="h-16 w-16 object-cover rounded-lg border border-[var(--border-default)]" />
                <button onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={chat.connected ? "Type a message..." : "Connecting..."}
            disabled={!chat.connected} rows={1}
            className="input flex-1 py-2.5 resize-none disabled:opacity-50" style={{ maxHeight: '120px' }} />

          <MicButton onTranscript={(text) => setInput(prev => prev + (prev ? ' ' : '') + text)} disabled={chat.isRunning} />

          {chat.isRunning ? (
            <button type="button" onClick={() => chat.abort()}
              className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
              title="Stop (Esc)">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || !chat.connected}
              className="flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>

        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-[var(--text-tertiary)]">
          <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">Enter</kbd> Send</span>
          <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">Esc</kbd> {chat.isRunning ? 'Abort' : 'Close'}</span>
        </div>
      </footer>

      {/* Session list overlay */}
      <AnimatePresence>
        {showSessions && (
          <SessionListPanel
            sessions={chat.sessions}
            runningSessions={chat.runningSessions}
            currentSessionId={chat.sessionId}
            onSelect={handleSelectSession}
            onNew={handleNewChat}
            onClose={() => setShowSessions(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Session list panel - Side drawer style
function SessionListPanel({
  sessions, runningSessions, currentSessionId, onSelect, onNew, onClose
}: {
  sessions: SessionInfo[];
  runningSessions: SessionInfo[];
  currentSessionId: string | null;
  onSelect: (s: SessionInfo) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const completedSessions = sessions.filter(s => s.state !== 'running');

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/30 z-20"
      />
      {/* Side panel */}
      <motion.div
        initial={{ opacity: 0, x: -280 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute top-0 left-0 bottom-0 w-72 bg-[var(--bg-primary)] border-r border-[var(--border-default)] z-30 flex flex-col shadow-xl"
      >
        <header className="flex items-center justify-between h-14 px-4 border-b border-[var(--border-default)]">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Sessions</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* New session button */}
          <button onClick={onNew}
            className="w-full px-3 py-2.5 text-left text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Session
          </button>

          {/* Running sessions */}
          {runningSessions.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 px-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Running ({runningSessions.length})
              </div>
              <div className="space-y-1">
                {runningSessions.map(s => (
                  <SessionItem key={s.id} session={s} isActive={s.id === currentSessionId} onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}

          {/* Completed sessions */}
          {completedSessions.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5 px-1">
                Recent
              </div>
              <div className="space-y-1">
                {completedSessions.slice(0, 10).map(s => (
                  <SessionItem key={s.id} session={s} isActive={s.id === currentSessionId} onSelect={onSelect} />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <div className="text-center text-xs text-[var(--text-tertiary)] py-8">
              No sessions yet
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// Session item
function SessionItem({ session, isActive, onSelect }: { session: SessionInfo; isActive: boolean; onSelect: (s: SessionInfo) => void }) {
  const stateColors = {
    running: 'bg-emerald-500',
    completed: 'bg-blue-500',
    error: 'bg-red-500',
    aborted: 'bg-gray-500',
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <button
      onClick={() => onSelect(session)}
      className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
        isActive
          ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
          : 'bg-[var(--bg-secondary)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-2 h-2 shrink-0 rounded-full ${stateColors[session.state]} ${session.state === 'running' ? 'animate-pulse' : ''}`} />
          <span className="text-sm text-[var(--text-primary)] truncate">
            {session.title || session.id.slice(0, 16)}
          </span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)] shrink-0 ml-2">{formatTime(session.startedAt)}</span>
      </div>
    </button>
  );
}

// Timeline item renderer
function TimelineItemView({ item }: { item: TimelineItem }) {
  if (item.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--accent)] text-sm text-white">
          {item.content}
        </div>
      </div>
    );
  }

  if (item.type === 'tool' && item.tool) {
    return <ToolCallCard tool={item.tool} />;
  }

  if (item.type === 'assistant') {
    return (
      <div className="flex gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
          <Icon name="spark" className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
              components={{ code: CodeBlock }}>
              {item.content || ''}
            </ReactMarkdown>
          </div>
          {item.usage?.costUsd !== undefined && (
            <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">
              ${item.usage.costUsd.toFixed(4)}
              {item.usage.durationMs && <span className="ml-2">{(item.usage.durationMs / 1000).toFixed(1)}s</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// Export hook for visibility control
export function useChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: useCallback(() => setIsOpen(true), []),
    close: useCallback(() => setIsOpen(false), []),
    toggle: useCallback(() => setIsOpen(p => !p), []),
  };
}
