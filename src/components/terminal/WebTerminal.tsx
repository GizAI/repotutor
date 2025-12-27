'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTerminalSession } from '@/hooks/useTerminalSession';
import { useT } from '@/lib/i18n';
import { TerminalHeader } from './TerminalHeader';
import { TerminalSessionList } from './TerminalSessionList';
import type { Terminal as XTerminal } from 'xterm';
import type { FitAddon as XFitAddon } from '@xterm/addon-fit';

// Tab bar height (h-10 = 40px) - used to position toolbar above tab bar when keyboard is open
const TAB_BAR_HEIGHT = 40;

// Hook to get keyboard info including scroll offset and viewport height
function useKeyboardInfo() {
  const [info, setInfo] = useState({ height: 0, scrollOffset: 0, viewportHeight: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const kbHeight = window.innerHeight - vv.height;
      // offsetTop: how much the viewport has scrolled (iOS keyboard pushes content up)
      const scrollOffset = vv.offsetTop;
      const isKeyboardOpen = kbHeight > 100;
      setInfo({
        height: isKeyboardOpen ? kbHeight : 0,
        scrollOffset: isKeyboardOpen ? scrollOffset : 0,
        viewportHeight: isKeyboardOpen ? vv.height : 0,
      });
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return info;
}

interface WebTerminalProps {
  className?: string;
  sessionId?: string;
  onSessionChange?: (sessionId: string | null) => void;
  showHeader?: boolean;
  isActive?: boolean; // For keep-alive: hide fixed elements when not active
}

// Check if device is touch-capable
function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}


// Command history storage
function getCommandHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('terminal-command-history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCommandHistory(history: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('terminal-command-history', JSON.stringify(history.slice(0, 100)));
}

export function WebTerminal({
  className = '',
  sessionId: initialSessionId,
  onSessionChange,
  showHeader = true,
  isActive = true,
}: WebTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<XFitAddon | null>(null);
  const [ready, setReady] = useState(false);
  const [isTouch] = useState(() => isTouchDevice());
  const { t } = useT();
  const { height: keyboardHeight, scrollOffset, viewportHeight } = useKeyboardInfo();

  // Session list modal
  const [showSessionList, setShowSessionList] = useState(false);

  // Toolbar ref and height
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);

  // Toolbar states
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [showFnKeys, setShowFnKeys] = useState(false);
  const [showNavKeys, setShowNavKeys] = useState(false);

  // Command history
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Terminal session hook
  const {
    sessions,
    currentSessionId,
    connected,
    cols,
    rows,
    createSession,
    joinSession,
    leaveSession,
    terminateSession,
    renameSession,
    refreshSessions,
    write,
    resize,
    inject,
    onData,
    onBuffer,
    onExit,
    connect,
    disconnect,
  } = useTerminalSession();

  // Load command history on mount
  useEffect(() => {
    setCommandHistory(getCommandHistory());
  }, []);

  // Notify parent of session changes
  useEffect(() => {
    onSessionChange?.(currentSessionId);
  }, [currentSessionId, onSessionChange]);

  // Join initial session if provided
  useEffect(() => {
    if (initialSessionId && connected && !currentSessionId) {
      joinSession(initialSessionId);
    }
  }, [initialSessionId, connected, currentSessionId, joinSession]);

  // Store callbacks in refs to avoid re-running effect
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  const resizeRef = useRef(resize);

  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
    resizeRef.current = resize;
  }, [connect, disconnect, resize]);

  // Initialize terminal (run once)
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const initTerminal = async () => {
      // Dynamic imports
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('xterm'),
        import('@xterm/addon-fit'),
      ]);

      // Load xterm CSS manually
      if (!document.getElementById('xterm-css')) {
        const link = document.createElement('link');
        link.id = 'xterm-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
        document.head.appendChild(link);
      }

      if (!mounted || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        allowProposedApi: true,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        theme: {
          background: '#1a1a1a',
          foreground: '#e0e0e0',
          cursor: '#f0f0f0',
          cursorAccent: '#1a1a1a',
          selectionBackground: 'rgba(255, 255, 255, 0.2)',
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#6272a4',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#f8f8f2',
          brightBlack: '#6272a4',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#d6acff',
          brightMagenta: '#ff92df',
          brightCyan: '#a4ffff',
          brightWhite: '#ffffff',
        },
      });

      const fit = new FitAddon();
      term.loadAddon(fit);

      term.open(containerRef.current);
      fit.fit();

      terminalRef.current = term;
      fitAddonRef.current = fit;

      // Send dimensions after fit
      setTimeout(() => {
        if (fit && term && mounted) {
          resizeRef.current(term.cols, term.rows);
        }
      }, 100);

      setReady(true);

      // Connect to terminal channel
      connectRef.current();
    };

    initTerminal();

    return () => {
      mounted = false;
      disconnectRef.current();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []); // Empty deps - run once

  // Handle terminal input with modifier support
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !ready) return;

    const disposable = term.onData((data) => {
      // Apply Ctrl modifier if active
      if (ctrlDownRef.current && data.length === 1) {
        const char = data.toUpperCase();
        const code = char.charCodeAt(0) - 64;
        if (code >= 0 && code <= 31) {
          write(String.fromCharCode(code));
          setCtrlDown(false);
          return;
        }
      }
      // Apply Alt modifier if active
      if (altDownRef.current && data.length === 1) {
        write('\x1b' + data);
        setAltDown(false);
        return;
      }
      write(data);
    });

    return () => {
      disposable.dispose();
    };
  }, [ready, write]);

  // Check if terminal is near bottom (within threshold rows)
  const isNearBottom = useCallback(() => {
    const term = terminalRef.current;
    if (!term) return true;
    const buffer = term.buffer.active;
    // baseY is the top of the scrollback, viewportY is current scroll position
    // When at bottom: viewportY === baseY
    const scrollOffset = buffer.baseY - buffer.viewportY;
    return scrollOffset <= 3; // Within 3 rows of bottom
  }, []);

  // Handle terminal output from server
  useEffect(() => {
    if (!ready) return;

    onData((sessionId, data) => {
      // Only write if it's for the current session
      if (sessionId === currentSessionId) {
        const wasNearBottom = isNearBottom();
        terminalRef.current?.write(data);
        // Auto-scroll only if was near bottom
        if (wasNearBottom) {
          terminalRef.current?.scrollToBottom();
        }
      }
    });

    onExit((sessionId, code) => {
      if (sessionId === currentSessionId) {
        terminalRef.current?.writeln(`\r\n\x1b[33mProcess exited with code ${code}\x1b[0m`);
        terminalRef.current?.scrollToBottom();
      }
    });

    // Handle scrollback buffer (session persistence)
    // Note: We always render the buffer because terminal:joined is always for the session we just joined
    onBuffer((sessionId, buffer) => {
      terminalRef.current?.clear();
      terminalRef.current?.write(buffer);
      // Always scroll to bottom on load
      terminalRef.current?.scrollToBottom();
      terminalRef.current?.focus();
    });
  }, [ready, currentSessionId, onData, onExit, onBuffer, isNearBottom]);

  // Handle resize
  const handleResize = useCallback(() => {
    const fit = fitAddonRef.current;
    const term = terminalRef.current;
    if (!fit || !term) return;

    fit.fit();
    resize(term.cols, term.rows);
  }, [resize]);

  useEffect(() => {
    if (!ready) return;

    // ResizeObserver for container resize
    const observer = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Also handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [ready, handleResize]);

  // Send key to terminal
  const sendKey = useCallback(
    (key: string) => {
      write(key);
      terminalRef.current?.focus();
    },
    [write]
  );

  // Send escape sequence
  const sendEscape = useCallback(
    (sequence: string) => {
      write(sequence);
      terminalRef.current?.focus();
    },
    [write]
  );

  // Modifier key states
  const [ctrlDown, setCtrlDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const ctrlDownRef = useRef(false);
  const altDownRef = useRef(false);

  // Selection mode for mobile text selection
  const [selectMode, setSelectMode] = useState(false);

  // Keep refs in sync with state
  useEffect(() => {
    ctrlDownRef.current = ctrlDown;
  }, [ctrlDown]);

  useEffect(() => {
    altDownRef.current = altDown;
  }, [altDown]);

  // Toggle xterm textarea disabled state for selection mode
  useEffect(() => {
    const textarea = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.disabled = selectMode;
    }

    // Block xterm touch events in select mode to allow native text selection
    const viewport = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement;
    const screen = containerRef.current?.querySelector('.xterm-screen') as HTMLElement;
    if (viewport && screen) {
      if (selectMode) {
        // Allow browser default touch behavior
        viewport.style.touchAction = 'auto';
        screen.style.touchAction = 'auto';
        viewport.style.pointerEvents = 'none';
        screen.style.pointerEvents = 'auto';
        screen.style.userSelect = 'text';
        (screen.style as unknown as Record<string, string>).webkitUserSelect = 'text';
      } else {
        // Restore xterm touch handling
        viewport.style.touchAction = '';
        screen.style.touchAction = '';
        viewport.style.pointerEvents = '';
        screen.style.pointerEvents = '';
        screen.style.userSelect = '';
        (screen.style as unknown as Record<string, string>).webkitUserSelect = '';
      }
    }
  }, [selectMode]);

  // Note: Removed auto-exit from selection mode on selectionchange
  // User must explicitly tap Sel button again to exit select mode

  // Measure toolbar height when keyboard is open
  useEffect(() => {
    if (keyboardHeight === 0 || !toolbarRef.current) {
      setToolbarHeight(0);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setToolbarHeight(entry.contentRect.height);
      }
    });

    observer.observe(toolbarRef.current);
    // Initial measurement
    setToolbarHeight(toolbarRef.current.offsetHeight);

    return () => observer.disconnect();
  }, [keyboardHeight, showTextInput, showFnKeys, showNavKeys, showHistory]);

  // Re-fit terminal when toolbar height or viewport changes
  useEffect(() => {
    if (ready) {
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const term = terminalRef.current;
        if (term) {
          resize(term.cols, term.rows);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [toolbarHeight, viewportHeight, ready, resize]);

  // Send control character (Ctrl+key)
  const sendCtrlKey = useCallback(
    (key: string) => {
      const code = key.toUpperCase().charCodeAt(0) - 64;
      if (code >= 0 && code <= 31) {
        write(String.fromCharCode(code));
      }
      setCtrlDown(false);
      terminalRef.current?.focus();
    },
    [write]
  );

  // Handle key with modifiers
  const handleModifiedKey = useCallback(
    (key: string) => {
      if (ctrlDown) {
        sendCtrlKey(key);
      } else if (altDown) {
        write('\x1b' + key);
        setAltDown(false);
        terminalRef.current?.focus();
      }
    },
    [ctrlDown, altDown, sendCtrlKey, write]
  );

  // Prevent keyboard dismiss on touch
  const preventDismiss = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Send composed text and save to history
  const sendTextInput = useCallback(() => {
    if (textInputValue) {
      write(textInputValue + '\n');

      // Add to command history
      const newHistory = [textInputValue, ...commandHistory.filter((h) => h !== textInputValue)];
      setCommandHistory(newHistory);
      saveCommandHistory(newHistory);

      setTextInputValue('');
      setShowTextInput(false);
      setHistoryIndex(-1);
      terminalRef.current?.focus();
    }
  }, [write, textInputValue, commandHistory]);

  // Handle text input key events
  const handleTextInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendTextInput();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowTextInput(false);
        terminalRef.current?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setTextInputValue(commandHistory[newIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setTextInputValue(commandHistory[newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setTextInputValue('');
        }
      }
    },
    [sendTextInput, commandHistory, historyIndex]
  );

  // Select history item
  const selectHistoryItem = useCallback((command: string) => {
    setTextInputValue(command);
    setShowHistory(false);
  }, []);

  // Session handlers
  const handleNewSession = useCallback(() => {
    createSession();
    setShowSessionList(false);
  }, [createSession]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      // Clear terminal before switching
      terminalRef.current?.clear();
      joinSession(sessionId);
      setShowSessionList(false);
    },
    [joinSession]
  );

  const handleTerminateSession = useCallback(
    (sessionId: string) => {
      terminateSession(sessionId);
    },
    [terminateSession]
  );

  const handleRenameSession = useCallback(
    (sessionId: string, newTitle: string) => {
      renameSession(sessionId, newTitle);
    },
    [renameSession]
  );

  return (
    <div
      className={`relative flex flex-col ${className}`}
      style={{
        // When keyboard is open, limit height to visible viewport
        height: viewportHeight > 0 ? `${viewportHeight}px` : '100%',
      }}
    >
      {/* Session Header */}
      {showHeader && (
        <TerminalHeader
          sessions={sessions}
          currentSessionId={currentSessionId}
          connected={connected}
          onOpenSessionList={() => setShowSessionList(true)}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onTerminateSession={handleTerminateSession}
        />
      )}

      {/* Session List Modal */}
      <AnimatePresence>
        {showSessionList && (
          <TerminalSessionList
            isOpen={showSessionList}
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelect={handleSelectSession}
            onNew={handleNewSession}
            onClose={() => setShowSessionList(false)}
            onTerminate={handleTerminateSession}
            onRename={handleRenameSession}
          />
        )}
      </AnimatePresence>


      {/* Terminal Container */}
      <div
        className="flex-1 min-h-0 relative"
        style={{
          // Reserve space for fixed toolbar when keyboard is open
          paddingBottom: keyboardHeight > 0 ? toolbarHeight : 0,
        }}
      >
        <div
          ref={containerRef}
          className="h-full w-full select-text"
          style={{
            padding: '8px',
            backgroundColor: '#1a1a1a',
            touchAction: 'pan-y pinch-zoom',
            WebkitUserSelect: 'text',
            userSelect: 'text',
          }}
        />
        {/* Selection mode indicator */}
        {selectMode && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-[var(--accent)] text-white text-xs rounded-full">
            Select Mode
          </div>
        )}
        {!connected && ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-[var(--text-secondary)] text-sm">{t('terminal.connecting')}</div>
          </div>
        )}
        {connected && !currentSessionId && ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-4">
            <div className="text-[var(--text-secondary)] text-sm">{t('terminal.noSession')}</div>
            <button
              onClick={handleNewSession}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:opacity-90"
            >
              {t('terminal.newSession')}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Toolbar - fixed when keyboard open, static when closed */}
      {(isTouch || true) && isActive && ( /* DEBUG */
        <div
          ref={toolbarRef}
          className="bg-[var(--bg-secondary)] shrink-0"
          style={keyboardHeight > 0 ? {
            position: 'fixed',
            bottom: Math.max(0, keyboardHeight - TAB_BAR_HEIGHT - scrollOffset),
            left: 0,
            right: 0,
            zIndex: 50,
          } : undefined}
        >
          {/* Text Input (collapsible) */}
          {showTextInput && (
            <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <input
                type="text"
                value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                onKeyDown={handleTextInputKeyDown}
                placeholder={t('terminal.textInputPlaceholder')}
                className="flex-1 h-9 px-3 text-sm bg-[var(--bg-primary)] border border-[var(--border-default)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
              />
              <button
                onClick={sendTextInput}
                disabled={!textInputValue}
                className="px-4 h-9 text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                ↵
              </button>
            </div>
          )}

          {/* Command History (collapsible) */}
          {showHistory && commandHistory.length > 0 && (
            <div className="max-h-28 overflow-y-auto border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
              {commandHistory.slice(0, 8).map((command, index) => (
                <button
                  key={index}
                  onClick={() => selectHistoryItem(command)}
                  className="w-full px-3 py-2 text-left text-xs font-mono text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] truncate"
                >
                  {command}
                </button>
              ))}
            </div>
          )}

          {/* Function Keys Row (collapsible) */}
          {showFnKeys && (
            <div className="h-10 flex items-center overflow-x-auto scrollbar-hide border-b border-[var(--border-default)] bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-1 px-2 min-w-max">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                  <button
                    key={`f${n}`}
                    onTouchStart={preventDismiss}
                    onMouseDown={preventDismiss}
                    onClick={() => {
                      const seq = n <= 4
                        ? `\x1bO${'PQRS'[n-1]}`
                        : `\x1b[${[15,17,18,19,20,21,23,24][n-5]}~`;
                      sendEscape(seq);
                    }}
                    className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95"
                  >
                    F{n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Keys Row (collapsible) */}
          {showNavKeys && (
            <div className="h-10 flex items-center overflow-x-auto scrollbar-hide border-b border-[var(--border-default)] bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-1 px-2 min-w-max">
                <button onTouchStart={preventDismiss} onMouseDown={preventDismiss} onClick={() => sendEscape('\x1b[H')} className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95">Home</button>
                <button onTouchStart={preventDismiss} onMouseDown={preventDismiss} onClick={() => sendEscape('\x1b[F')} className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95">End</button>
                <button onTouchStart={preventDismiss} onMouseDown={preventDismiss} onClick={() => sendEscape('\x1b[5~')} className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95">PgUp</button>
                <button onTouchStart={preventDismiss} onMouseDown={preventDismiss} onClick={() => sendEscape('\x1b[6~')} className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95">PgDn</button>
                <button onTouchStart={preventDismiss} onMouseDown={preventDismiss} onClick={() => sendEscape('\x1b[2~')} className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95">Ins</button>
                <button onTouchStart={preventDismiss} onMouseDown={preventDismiss} onClick={() => sendEscape('\x1b[3~')} className="h-7 px-2 text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-default)] active:scale-95">Del</button>
              </div>
            </div>
          )}

          {/* Scrollable Toolbar */}
          <div className="h-12 flex items-center overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 px-3 min-w-max">
              {/* Selection Mode Toggle - First */}
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => setSelectMode(!selectMode)}
                className={`h-9 px-2 text-xs font-medium rounded-lg ${selectMode ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
                title="Toggle selection mode for text copy"
              >
                Sel
              </button>
              {/* Copy button - visible in select mode */}
              {selectMode && (
                <button
                  onTouchStart={preventDismiss}
                  onMouseDown={preventDismiss}
                  onClick={() => {
                    const selection = terminalRef.current?.getSelection();
                    if (selection) {
                      navigator.clipboard.writeText(selection);
                      // Brief visual feedback
                      const btn = document.activeElement as HTMLButtonElement;
                      if (btn) {
                        btn.textContent = '✓';
                        setTimeout(() => { btn.textContent = 'Copy'; }, 500);
                      }
                    }
                  }}
                  className="h-9 px-2 text-xs font-medium rounded-lg bg-green-600 text-white active:scale-95 transition-transform"
                >
                  Copy
                </button>
              )}

              <div className="w-px h-6 bg-[var(--border-strong)]" />

              {/* Modifier Keys */}
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => setCtrlDown(!ctrlDown)}
                className={`min-w-[44px] h-9 px-3 text-sm font-medium rounded-lg ${ctrlDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
              >
                Ctrl
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => setAltDown(!altDown)}
                className={`min-w-[44px] h-9 px-3 text-sm font-medium rounded-lg ${altDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
              >
                Alt
              </button>

              <div className="w-px h-6 bg-[var(--border-strong)]" />

              {/* Special Keys */}
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => sendEscape('\x1b')}
                className="min-w-[44px] h-9 px-3 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] active:scale-95 transition-transform"
              >
                Esc
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => sendKey('\t')}
                className="min-w-[44px] h-9 px-3 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] active:scale-95 transition-transform"
              >
                Tab
              </button>

              <div className="w-px h-6 bg-[var(--border-strong)]" />

              {/* Fn & Nav toggles - before arrows */}
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => setShowFnKeys(!showFnKeys)}
                className={`h-9 px-2 text-xs font-medium rounded-lg ${showFnKeys ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
              >
                Fn
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => setShowNavKeys(!showNavKeys)}
                className={`h-9 px-2 text-xs font-medium rounded-lg ${showNavKeys ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
              >
                Nav
              </button>

              <div className="w-px h-6 bg-[var(--border-strong)]" />

              {/* Arrow Keys */}
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => sendEscape('\x1b[A')}
                className="w-9 h-9 text-base font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] active:scale-95 transition-transform"
              >
                ↑
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => sendEscape('\x1b[B')}
                className="w-9 h-9 text-base font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] active:scale-95 transition-transform"
              >
                ↓
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => sendEscape('\x1b[D')}
                className="w-9 h-9 text-base font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] active:scale-95 transition-transform"
              >
                ←
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => sendEscape('\x1b[C')}
                className="w-9 h-9 text-base font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)] active:scale-95 transition-transform"
              >
                →
              </button>

              <div className="w-px h-6 bg-[var(--border-strong)]" />

              {/* Text Input & History */}
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => {
                  setShowTextInput(!showTextInput);
                  if (!showTextInput) setShowHistory(false);
                }}
                className={`w-9 h-9 text-base rounded-lg ${showTextInput ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
              >
                ⌨
              </button>
              <button
                onTouchStart={preventDismiss}
                onMouseDown={preventDismiss}
                onClick={() => {
                  setShowHistory(!showHistory);
                  if (!showHistory) setShowTextInput(true);
                }}
                className={`w-9 h-9 text-base rounded-lg ${showHistory ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-default)]'} active:scale-95 transition-transform`}
              >
                ↺
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
