/**
 * ChatBot - WebSocket-based with Timeline View
 *
 * Features:
 * - Claude Code sessions from ~/.claude/projects/
 * - DeepAgents mode (LangGraph)
 * - Persistent sessions (survives browser refresh via server buffering)
 * - Chronological timeline (messages + tools interleaved)
 * - Real-time streaming with tool output
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import Fuse from 'fuse.js';
import { useChatWS, TimelineItem, SessionInfo, ModelInfo, SlashCommand, PERMISSION_MODES, PermissionMode } from '@/hooks/useChatWS';
import { ToolCallCard, ContextMeter, CodeBlock } from './parts';
import { TokenUsagePie } from '@/components/ui/TokenUsagePie';
import { MicButton } from '@/components/ui/MicButton';
import {
  Clock, Send, Plus, X, Lightbulb, AlertTriangle,
  Bot, Zap, Menu, Sparkles, ChevronDown, ChevronRight, Brain,
  Server, Shield, Terminal, Wrench, Info, DollarSign
} from 'lucide-react';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
  fullScreen?: boolean;
}

type AgentMode = 'claude-code' | 'deepagents';

export function ChatBotNew({ isOpen, onClose, currentPath, fullScreen = false }: ChatBotProps) {
  const chat = useChatWS();

  // UI state
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [showHooks, setShowHooks] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [mode, setMode] = useState<AgentMode>('claude-code');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
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

  // Fetch models and commands on connect
  useEffect(() => {
    if (chat.connected && mode === 'claude-code') {
      chat.fetchModels();
      chat.fetchCommands();
    }
  }, [chat.connected, mode]);

  // Fuse.js instance for fuzzy command search
  const commandFuse = useMemo(() => {
    if (chat.slashCommands.length === 0) return null;
    return new Fuse(chat.slashCommands, {
      keys: ['name', 'description'],
      threshold: 0.4,  // Allow fuzzy matches
      distance: 100,
      includeScore: true,
    });
  }, [chat.slashCommands]);

  // Fuzzy search results
  const filteredCommands = useMemo(() => {
    if (!commandFilter || !commandFuse) {
      return chat.slashCommands.slice(0, 10);
    }
    const results = commandFuse.search(commandFilter);
    return results.slice(0, 10).map(r => r.item);
  }, [commandFilter, commandFuse, chat.slashCommands]);

  // Handle slash command detection
  useEffect(() => {
    if (input.startsWith('/') && mode === 'claude-code') {
      const filter = input.slice(1).split(' ')[0].toLowerCase();  // Only match command name, not args
      setCommandFilter(filter);
      setSelectedCommandIndex(0);  // Reset selection on filter change
      // Only show suggestions if we're still typing the command (no space after command name)
      const hasSpace = input.indexOf(' ') > 0;
      setShowCommandSuggestions(!hasSpace || filter.length === 0);
    } else {
      setShowCommandSuggestions(false);
    }
  }, [input, mode]);

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
    chat.send(msg, currentPath, mode);
  }, [input, chat, currentPath, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command suggestion navigation
    if (showCommandSuggestions && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredCommands[selectedCommandIndex];
        if (cmd) {
          setInput(`/${cmd.name} `);
          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Tab to cycle permission mode (when input is empty)
    if (e.key === 'Tab' && mode === 'claude-code' && !input.trim()) {
      e.preventDefault();
      chat.cyclePermissionMode();
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
      <header className="flex items-center gap-2 h-14 px-4 border-b border-[var(--border-default)]">
        {/* Sessions button with running indicator */}
        <button onClick={() => setShowSessions(true)}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">
          <Menu className="w-5 h-5" />
          {chat.runningSessions.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-[10px] text-white rounded-full flex items-center justify-center">
              {chat.runningSessions.length}
            </span>
          )}
        </button>

        {/* Mode Selector Dropdown - serves as title */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
          >
            <div className={`w-2 h-2 rounded-full ${chat.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <div className="flex items-center gap-1.5">
              {mode === 'claude-code' ? <Zap className="w-4 h-4 text-[var(--accent)]" /> : <Bot className="w-4 h-4 text-purple-500" />}
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {mode === 'claude-code' ? 'Claude Code' : 'DeepAgents'}
              </span>
              {chat.isRunning && <span className="text-xs text-emerald-500">(running)</span>}
            </div>
            <svg className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${showModeMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {showModeMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 mt-1 w-56 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg z-50"
              >
                <button
                  onClick={() => { setMode('claude-code'); setShowModeMenu(false); }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-[var(--hover-bg)] ${mode === 'claude-code' ? 'bg-[var(--accent-soft)]' : ''}`}
                >
                  <Zap className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">Claude Code</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">Full SDK with MCP tools</div>
                  </div>
                  {mode === 'claude-code' && <svg className="w-4 h-4 ml-auto text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <button
                  onClick={() => { setMode('deepagents'); setShowModeMenu(false); }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-[var(--hover-bg)] ${mode === 'deepagents' ? 'bg-[var(--accent-soft)]' : ''}`}
                >
                  <Bot className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">DeepAgents</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">LangGraph ReAct agent</div>
                  </div>
                  {mode === 'deepagents' && <svg className="w-4 h-4 ml-auto text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          {mode === 'claude-code' && (
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-mono hover:bg-[var(--hover-bg)] transition-colors"
              >
                {(chat.selectedModel || chat.model || 'sonnet-4').replace('claude-', '').replace(/-\d{8}$/, '')}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {showModelMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full right-0 mt-1 w-64 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg z-50"
                  >
                    {(chat.availableModels.length > 0 ? chat.availableModels : [
                      { value: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', description: 'Best balance' },
                      { value: 'claude-opus-4-20250514', displayName: 'Claude Opus 4', description: 'Most capable' },
                      { value: 'claude-haiku-3-5-20250414', displayName: 'Claude Haiku 3.5', description: 'Fastest' },
                    ]).map((m) => (
                      <button
                        key={m.value}
                        onClick={() => { chat.setSelectedModel(m.value); setShowModelMenu(false); }}
                        className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--hover-bg)] ${
                          (chat.selectedModel || chat.model) === m.value ? 'bg-[var(--accent-soft)]' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <div className="text-xs font-medium text-[var(--text-primary)]">{m.displayName}</div>
                          <div className="text-[9px] text-[var(--text-tertiary)]">{m.description}</div>
                        </div>
                        {(chat.selectedModel || chat.model) === m.value && (
                          <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Active tools indicator */}
          {chat.activeTools.size > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-purple-500">
              <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span>{chat.activeTools.size} tool{chat.activeTools.size > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Auth status */}
          {chat.isAuthenticating && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Auth...</span>
            </div>
          )}

          {chat.contextInfo.isCompacting && (
            <div className="text-xs text-amber-500 animate-pulse">Compacting...</div>
          )}

          {chat.contextInfo.preTokens && chat.contextInfo.preTokens > 0 && (
            <ContextMeter tokens={chat.contextInfo.preTokens} maxTokens={200000}
              isCompacting={chat.contextInfo.isCompacting} />
          )}
        </div>

        {/* Permission Mode Toggle */}
        {mode === 'claude-code' && (
          <button
            onClick={() => chat.cyclePermissionMode()}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              PERMISSION_MODES.find(m => m.mode === chat.selectedPermissionMode)?.color || 'text-blue-500'
            } hover:bg-[var(--hover-bg)]`}
            title={`Permission Mode: ${chat.selectedPermissionMode} (Tab to cycle)`}
          >
            <span>{PERMISSION_MODES.find(m => m.mode === chat.selectedPermissionMode)?.icon}</span>
            <span>{PERMISSION_MODES.find(m => m.mode === chat.selectedPermissionMode)?.label}</span>
          </button>
        )}

        {/* Session info toggle */}
        {(chat.mcpServers?.length || chat.tools?.length || chat.sessionCost > 0) && (
          <button
            onClick={() => setShowSessionInfo(!showSessionInfo)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
            title="Session Info"
          >
            <Info className="h-4 w-4" />
          </button>
        )}

        {!fullScreen && (
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Session info panel */}
      <AnimatePresence>
        {showSessionInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]"
          >
            <div className="flex flex-wrap items-center gap-3 text-[10px]">
              {/* Session cost */}
              {chat.sessionCost > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                  <DollarSign className="w-3 h-3" />
                  <span className="font-medium">${chat.sessionCost.toFixed(4)}</span>
                </div>
              )}

              {/* Permission mode */}
              {chat.permissionMode && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">
                  <Shield className="w-3 h-3" />
                  <span>{chat.permissionMode}</span>
                </div>
              )}

              {/* Tools count */}
              {chat.tools && chat.tools.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">
                  <Wrench className="w-3 h-3" />
                  <span>{chat.tools.length} tools</span>
                </div>
              )}

              {/* Skills count */}
              {chat.skills && chat.skills.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">
                  <Sparkles className="w-3 h-3" />
                  <span>{chat.skills.length} skills</span>
                </div>
              )}

              {/* MCP servers */}
              {chat.mcpServers && chat.mcpServers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Server className="w-3 h-3 text-[var(--text-tertiary)]" />
                  {chat.mcpServers.map((srv, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                        srv.status === 'connected' ? 'bg-emerald-500/10 text-emerald-600' :
                        srv.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        'bg-gray-500/10 text-gray-500'
                      }`}
                      title={`${srv.name}: ${srv.status}`}
                    >
                      {srv.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hook responses panel */}
      <AnimatePresence>
        {chat.hookResponses.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-b border-[var(--border-default)]"
          >
            <button
              onClick={() => setShowHooks(!showHooks)}
              className="w-full px-4 py-1.5 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] hover:bg-[var(--hover-bg)]"
            >
              <Terminal className="w-3 h-3" />
              <span>{chat.hookResponses.length} hook{chat.hookResponses.length > 1 ? 's' : ''} executed</span>
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showHooks ? 'rotate-180' : ''}`} />
            </button>
            {showHooks && (
              <div className="px-4 pb-2 space-y-1 max-h-32 overflow-y-auto">
                {chat.hookResponses.map((hook, idx) => (
                  <div key={idx} className="text-[9px] font-mono p-2 rounded bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--text-primary)] font-medium">{hook.hookName}</span>
                      <span className="text-[var(--text-tertiary)]">{hook.hookEvent}</span>
                      {hook.exitCode !== undefined && hook.exitCode !== 0 && (
                        <span className="text-red-500">exit: {hook.exitCode}</span>
                      )}
                    </div>
                    {hook.stdout && <div className="text-[var(--text-secondary)] whitespace-pre-wrap">{hook.stdout.slice(0, 200)}</div>}
                    {hook.stderr && <div className="text-red-400 whitespace-pre-wrap">{hook.stderr.slice(0, 200)}</div>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Error banner */}
      <AnimatePresence>
        {(chat.error || chat.authError) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-b border-red-500/30 bg-red-500/10">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600 font-medium">
                {chat.authError || chat.error}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget warning */}
      <AnimatePresence>
        {budgetWarning && !chat.error && (
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
      {chat.lastUsage && (chat.lastUsage.costUsd !== undefined || chat.lastUsage.inputTokens) && (
        <div className="px-4 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
            <div className="flex items-center gap-3">
              {chat.lastUsage.inputTokens !== undefined && chat.lastUsage.outputTokens !== undefined && (
                <>
                  <TokenUsagePie used={(chat.lastUsage.inputTokens || 0) + (chat.lastUsage.outputTokens || 0)} total={200000} />
                  <span>
                    {formatTokens(chat.lastUsage.inputTokens)}↓ {formatTokens(chat.lastUsage.outputTokens)}↑
                    {chat.lastUsage.cacheReadTokens ? <span className="text-emerald-500 ml-1">({formatTokens(chat.lastUsage.cacheReadTokens)} cached)</span> : null}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {chat.lastUsage.durationMs && (
                <span>{(chat.lastUsage.durationMs / 1000).toFixed(1)}s</span>
              )}
              {chat.stopReason && chat.stopReason !== 'end_turn' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[9px]">{chat.stopReason}</span>
              )}
              {chat.lastUsage.costUsd !== undefined && (
                <span className="font-medium text-[var(--text-secondary)]">${chat.lastUsage.costUsd.toFixed(4)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline (messages + tools interleaved) */}
      <main className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {/* Loading indicator */}
        {chat.isLoading && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-[var(--text-secondary)]">Loading conversation...</p>
          </div>
        )}

        {!chat.isLoading && chat.timeline.length === 0 && !chat.streamingContent ? (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent)] mb-4">
              <Sparkles className="h-7 w-7 text-white" />
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
            {chat.timeline.map((item, idx) => {
              const prev = chat.timeline[idx - 1];
              const isConsecutive = prev?.type === 'assistant' && item.type === 'assistant';
              return <TimelineItemView key={item.id} item={item} isConsecutive={isConsecutive} />;
            })}

            {/* Streaming content */}
            {chat.streamingContent && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
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

        {/* Slash command suggestions */}
        <AnimatePresence>
          {showCommandSuggestions && chat.slashCommands.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg overflow-hidden"
            >
              <div className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                Slash Commands
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.name}
                    onClick={() => {
                      setInput(`/${cmd.name} `);
                      setShowCommandSuggestions(false);
                      setSelectedCommandIndex(0);
                      inputRef.current?.focus();
                    }}
                    onMouseEnter={() => setSelectedCommandIndex(idx)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                      idx === selectedCommandIndex
                        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                        : 'hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    <code className="text-xs font-mono text-[var(--accent)]">/{cmd.name}</code>
                    <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{cmd.description}</span>
                    {cmd.argumentHint && (
                      <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{cmd.argumentHint}</span>
                    )}
                  </button>
                ))}
                {filteredCommands.length === 0 && (
                  <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No matching commands</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={chat.connected ? "Type / for commands, or ask anything..." : "Connecting..."}
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
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-[var(--text-tertiary)]">Loading sessions...</p>
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

  const formatModel = (model?: string) => {
    if (!model) return null;
    // claude-sonnet-4-20250514 -> sonnet-4
    return model.replace('claude-', '').replace(/-\d{8}$/, '');
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
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-2 h-2 shrink-0 rounded-full ${stateColors[session.state]} ${session.state === 'running' ? 'animate-pulse' : ''}`} />
          <span className="text-sm text-[var(--text-primary)] truncate">
            {session.title || session.id.slice(0, 16)}
          </span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)] shrink-0 ml-2">{formatTime(session.startedAt)}</span>
      </div>
      {/* Model badge */}
      {session.model && (
        <div className="pl-4 mt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-mono">
            {formatModel(session.model)}
          </span>
        </div>
      )}
    </button>
  );
}

// Thinking block renderer (collapsible)
function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.slice(0, 100) + (content.length > 100 ? '...' : '');

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-amber-600 dark:text-amber-400"
      >
        <Brain className="h-3.5 w-3.5" />
        <span className="font-medium">Thinking</span>
        {expanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>
      {expanded ? (
        <div className="px-3 pb-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap max-h-[300px] overflow-auto">
          {content}
        </div>
      ) : (
        <div className="px-3 pb-2 text-xs text-[var(--text-tertiary)] truncate">
          {preview}
        </div>
      )}
    </div>
  );
}

// Format token count
function formatTokens(count?: number): string {
  if (!count) return '';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// Timeline item renderer
function TimelineItemView({ item, isConsecutive }: { item: TimelineItem; isConsecutive?: boolean }) {
  if (item.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[var(--accent)] text-sm text-white">
          {item.content}
        </div>
      </div>
    );
  }

  if (item.type === 'thinking' && item.thinking) {
    return <ThinkingBlock content={item.thinking} />;
  }

  if (item.type === 'tool' && item.tool) {
    return <ToolCallCard tool={item.tool} />;
  }

  if (item.type === 'assistant') {
    return (
      <div className={`flex gap-3 ${isConsecutive ? 'mt-1' : ''}`}>
        {/* Avatar - hidden for consecutive messages */}
        <div className={`w-7 shrink-0 ${isConsecutive ? '' : 'flex h-7 items-center justify-center rounded-lg bg-[var(--accent)]'}`}>
          {!isConsecutive && <Sparkles className="h-3.5 w-3.5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
              components={{ code: CodeBlock }}>
              {item.content || ''}
            </ReactMarkdown>
          </div>
          {/* Usage info: cost, tokens, duration */}
          {item.usage && (item.usage.costUsd !== undefined || item.usage.inputTokens || item.usage.outputTokens) && (
            <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
              {item.usage.costUsd !== undefined && <span>${item.usage.costUsd.toFixed(4)}</span>}
              {(item.usage.inputTokens || item.usage.outputTokens) && (
                <span>
                  {formatTokens(item.usage.inputTokens)}↓ / {formatTokens(item.usage.outputTokens)}↑
                  {item.usage.cacheReadTokens ? ` (${formatTokens(item.usage.cacheReadTokens)} cached)` : ''}
                </span>
              )}
              {item.usage.durationMs && <span>{(item.usage.durationMs / 1000).toFixed(1)}s</span>}
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
