'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVNC } from '@/hooks/useVNC';
import { Loader2, Monitor } from 'lucide-react';
import { TouchpadOverlay } from './TouchpadOverlay';
import { useT } from '@/lib/i18n';

interface DesktopViewerProps {
  className?: string;
}

type ServerState = 'checking' | 'not_running' | 'starting' | 'ready';
type ScaleMode = 'off' | 'scale' | 'remote';

// Check if device is touch-capable
function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function DesktopViewer({ className = '' }: DesktopViewerProps) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const keyboardInputRef = useRef<HTMLInputElement>(null);
  const [serverState, setServerState] = useState<ServerState>('checking');
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [showClipboard, setShowClipboard] = useState(false);
  const [showPower, setShowPower] = useState(false);
  const [clipboardInput, setClipboardInput] = useState('');

  // Settings
  const [scaleMode, setScaleMode] = useState<ScaleMode>('remote');
  const [viewOnly, setViewOnly] = useState(false);
  const [quality, setQuality] = useState(6);
  const [compression, setCompression] = useState(2);

  // Touch/mobile features - touchpad mode enabled by default on touch devices
  const [touchpadMode, setTouchpadMode] = useState(() => isTouchDevice());
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isTouch] = useState(() => isTouchDevice());

  // Keyboard height tracking for fullscreen mode
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Modifier keys state
  const [ctrlDown, setCtrlDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const [winDown, setWinDown] = useState(false);

  const vnc = useVNC(canvasContainerRef);

  // Track canvas container size for touchpad overlay
  // Use getBoundingClientRect to get actual container size, not content size
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({
        width: rect.width,
        height: rect.height,
      });
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize(); // Initial size

    return () => observer.disconnect();
  }, []);

  // Track virtual keyboard using visualViewport (fixes fullscreen keyboard issues)
  useEffect(() => {
    if (!isTouch || typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      // Calculate keyboard height by comparing visualViewport height with window height
      // In fullscreen, window.innerHeight is the full screen, visualViewport.height shrinks when keyboard opens
      const calculatedKeyboardHeight = window.innerHeight - viewport.height;
      setKeyboardHeight(Math.max(0, calculatedKeyboardHeight));
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);

    // Initial check
    handleResize();

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, [isTouch]);

  // Keyboard toggle handler
  const toggleKeyboard = useCallback(() => {
    setShowKeyboard(prev => {
      const newState = !prev;
      // Focus or blur the hidden input based on new state
      if (newState && keyboardInputRef.current) {
        keyboardInputRef.current.focus();
      } else if (!newState && keyboardInputRef.current) {
        keyboardInputRef.current.blur();
      }
      return newState;
    });
  }, []);

  // Handle keyboard input from hidden input
  const handleKeyboardInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Send key to VNC
    const key = e.key;
    const code = e.code;

    // Map special keys to X11 keysyms
    const keySymMap: Record<string, number> = {
      'Backspace': 0xFF08,
      'Tab': 0xFF09,
      'Enter': 0xFF0D,
      'Escape': 0xFF1B,
      'Delete': 0xFFFF,
      'Home': 0xFF50,
      'End': 0xFF57,
      'PageUp': 0xFF55,
      'PageDown': 0xFF56,
      'ArrowLeft': 0xFF51,
      'ArrowUp': 0xFF52,
      'ArrowRight': 0xFF53,
      'ArrowDown': 0xFF54,
    };

    if (keySymMap[key]) {
      vnc.sendKey(keySymMap[key], code, true);
      vnc.sendKey(keySymMap[key], code, false);
    } else if (key.length === 1) {
      // Regular character - use char code as keysym
      const charCode = key.charCodeAt(0);
      vnc.sendKey(charCode, code, true);
      vnc.sendKey(charCode, code, false);
    }

    e.preventDefault();
  }, [vnc]);

  // Touchpad overlay handlers
  const handleTouchpadMove = useCallback((x: number, y: number) => {
    // Send mouse move event (mask=0 means no buttons pressed)
    vnc.sendPointerEvent(x, y, 0);
  }, [vnc]);

  const handleTouchpadClick = useCallback((x: number, y: number, button: number) => {
    // Convert button to RFB mask: 1=left, 4=right (bit positions)
    const mask = button === 1 ? 1 : button === 2 ? 4 : 2;

    // Send mouse down
    vnc.sendPointerEvent(x, y, mask);

    // Send mouse up after short delay
    setTimeout(() => {
      vnc.sendPointerEvent(x, y, 0);
    }, 50);
  }, [vnc]);

  // Drag handlers for double-tap + drag
  const handleDragStart = useCallback((x: number, y: number) => {
    // Send left mouse button down (mask=1)
    vnc.sendPointerEvent(x, y, 1);
  }, [vnc]);

  const handleDragMove = useCallback((x: number, y: number) => {
    // Keep left button pressed while moving (mask=1)
    vnc.sendPointerEvent(x, y, 1);
  }, [vnc]);

  const handleDragEnd = useCallback((x: number, y: number) => {
    // Release left button (mask=0)
    vnc.sendPointerEvent(x, y, 0);
  }, [vnc]);

  // Build WebSocket URL
  const getWsUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/vnc`;
  }, []);

  // Check VNC server status
  const checkServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/vnc/status');
      if (!res.ok) return false;
      const data = await res.json();
      return data.running;
    } catch {
      return false;
    }
  }, []);

  // Start VNC server
  const startServer = useCallback(async () => {
    setServerState('starting');
    try {
      const res = await fetch('/api/vnc/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start VNC');
      const data = await res.json();
      if (data.success) {
        // Just set ready - the connect effect will handle the connection
        setServerState('ready');
      } else {
        throw new Error(data.message || 'VNC start failed');
      }
    } catch {
      setServerState('not_running');
    }
  }, []);

  // Initial check - only set server state
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const running = await checkServer();
      if (!mounted) return;

      if (running) {
        setServerState('ready');
      } else {
        setServerState('not_running');
      }
    };

    init();
    return () => { mounted = false; };
  }, [checkServer]);

  // Connect when server is ready AND container is mounted
  useEffect(() => {
    if (serverState !== 'ready') return;
    if (!canvasContainerRef.current) return;
    if (vnc.status === 'connected' || vnc.status === 'connecting') return;

    vnc.connect(getWsUrl(), {
      resizeSession: scaleMode === 'remote',
      scaleViewport: scaleMode === 'scale',
      viewOnly,
      qualityLevel: quality,
      compressionLevel: compression,
      dragViewport: touchpadMode,  // Disable direct touch when touchpad mode is on
    });
  }, [serverState, vnc, getWsUrl, scaleMode, viewOnly, quality, compression, touchpadMode]);

  // Apply settings changes
  useEffect(() => {
    vnc.setResizeSession(scaleMode === 'remote');
    vnc.setScaleViewport(scaleMode === 'scale');
  }, [scaleMode, vnc]);

  // Handle touchpad mode changes
  useEffect(() => {
    vnc.setDragViewport(touchpadMode);
  }, [touchpadMode, vnc]);

  useEffect(() => {
    vnc.setViewOnly(viewOnly);
  }, [viewOnly, vnc]);

  useEffect(() => {
    vnc.setQualityLevel(quality);
  }, [quality, vnc]);

  useEffect(() => {
    vnc.setCompressionLevel(compression);
  }, [compression, vnc]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Send modifier key
  const toggleCtrl = useCallback(() => {
    const newState = !ctrlDown;
    setCtrlDown(newState);
    vnc.sendKey(0xFFE3, 'ControlLeft', newState);
  }, [ctrlDown, vnc]);

  const toggleAlt = useCallback(() => {
    const newState = !altDown;
    setAltDown(newState);
    vnc.sendKey(0xFFE9, 'AltLeft', newState);
  }, [altDown, vnc]);

  const toggleWin = useCallback(() => {
    const newState = !winDown;
    setWinDown(newState);
    vnc.sendKey(0xFFEB, 'MetaLeft', newState);
  }, [winDown, vnc]);

  // Send single key
  const sendTab = useCallback(() => {
    vnc.sendKey(0xFF09, 'Tab', true);
    vnc.sendKey(0xFF09, 'Tab', false);
  }, [vnc]);

  const sendEsc = useCallback(() => {
    vnc.sendKey(0xFF1B, 'Escape', true);
    vnc.sendKey(0xFF1B, 'Escape', false);
  }, [vnc]);

  // Sync clipboard from server
  useEffect(() => {
    if (vnc.clipboardText) {
      setClipboardInput(vnc.clipboardText);
    }
  }, [vnc.clipboardText]);

  // Close panels when clicking outside
  const closePanels = useCallback(() => {
    setShowSettings(false);
    setShowKeys(false);
    setShowClipboard(false);
    setShowPower(false);
  }, []);

  // Render loading/error states
  if (serverState === 'checking') {
    return (
      <div className={`flex items-center justify-center h-full bg-[var(--bg-secondary)] ${className}`}>
        <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (serverState === 'not_running') {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-[var(--bg-secondary)] ${className}`}>
        <Monitor className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
        <p className="text-[var(--text-secondary)] text-sm mb-2">{t('desktop.remoteDesktop')}</p>
        <p className="text-[var(--text-tertiary)] text-xs mb-4">{t('desktop.vncNotRunning')}</p>
        <button
          onClick={startServer}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          {t('desktop.startDesktop')}
        </button>
      </div>
    );
  }

  if (serverState === 'starting') {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-[var(--bg-secondary)] ${className}`}>
        <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin mb-3" />
        <p className="text-[var(--text-secondary)] text-sm">{t('desktop.starting')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full bg-black ${className}`}
      onClick={closePanels}
    >
      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-[var(--bg-primary)]/90 backdrop-blur border-b border-[var(--border-default)] flex items-center justify-between px-2 z-20">
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${vnc.status === 'connected' ? 'bg-green-500' : vnc.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[var(--text-secondary)]">
            {vnc.status === 'connected' ? t('desktop.connected', { name: vnc.desktopName || 'Desktop' }) : vnc.status === 'connecting' ? t('desktop.connecting') : vnc.error || t('desktop.disconnected')}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-1">
          {/* === Input Group === */}
          {/* Keyboard Toggle (for touch devices) */}
          {isTouch && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleKeyboard(); }}
              className={`p-1.5 rounded ${showKeyboard ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
              title={t('desktop.keyboard')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="14" rx="2" />
                <rect x="4" y="6" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="7" y="6" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="10" y="6" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="13" y="6" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="16" y="6" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="13" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="16" y="9" width="4" height="2" rx="0.5" fill="currentColor" stroke="none" />
                <rect x="6" y="12" width="10" height="2" rx="0.5" fill="currentColor" stroke="none" />
              </svg>
            </button>
          )}

          {/* Extra Keys (Ctrl, Alt, etc.) */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowKeys(!showKeys); setShowSettings(false); setShowClipboard(false); setShowPower(false); }}
            className={`p-1.5 rounded ${showKeys ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
            title={t('desktop.extraKeys')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="7" height="5" rx="1" />
              <rect x="14" y="7" width="7" height="5" rx="1" />
              <rect x="3" y="14" width="18" height="4" rx="1" />
            </svg>
          </button>

          {/* Touchpad Mode (for touch devices) */}
          {isTouch && (
            <button
              onClick={(e) => { e.stopPropagation(); setTouchpadMode(!touchpadMode); }}
              className={`p-1.5 rounded ${touchpadMode ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
              title={t('desktop.touchpad')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="10" r="2" />
                <line x1="6" y1="16" x2="18" y2="16" />
              </svg>
            </button>
          )}

          {/* === Separator === */}
          <div className="w-px h-4 bg-[var(--border-default)] mx-1" />

          {/* === Function Group === */}
          {/* Clipboard */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowClipboard(!showClipboard); setShowSettings(false); setShowKeys(false); setShowPower(false); }}
            className={`p-1.5 rounded ${showClipboard ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
            title={t('desktop.clipboard')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" />
            </svg>
          </button>

          {/* Power */}
          {vnc.capabilities.power && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowPower(!showPower); setShowSettings(false); setShowKeys(false); setShowClipboard(false); }}
              className={`p-1.5 rounded ${showPower ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
              title={t('desktop.power')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v10M18.4 6.6a9 9 0 11-12.8 0" />
              </svg>
            </button>
          )}

          {/* === Separator === */}
          <div className="w-px h-4 bg-[var(--border-default)] mx-1" />

          {/* === View/Settings Group === */}
          {/* Fullscreen */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            title={fullscreen ? t('desktop.exitFullscreen') : t('desktop.fullscreen')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {fullscreen ? (
                <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
              ) : (
                <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
              )}
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowKeys(false); setShowClipboard(false); setShowPower(false); }}
            className={`p-1.5 rounded ${showSettings ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
            title={t('desktop.settings')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </button>

          {/* Disconnect */}
          <button
            onClick={(e) => { e.stopPropagation(); vnc.disconnect(); }}
            className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
            title={t('desktop.disconnect')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Extra Keys Panel */}
      {showKeys && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">{t('desktop.modifierKeys')}</div>
          <div className="flex gap-2 mb-3">
            <button onClick={toggleCtrl} className={`px-3 py-1.5 text-xs rounded ${ctrlDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>Ctrl</button>
            <button onClick={toggleAlt} className={`px-3 py-1.5 text-xs rounded ${altDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>Alt</button>
            <button onClick={toggleWin} className={`px-3 py-1.5 text-xs rounded ${winDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>Win</button>
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">{t('desktop.specialKeys')}</div>
          <div className="flex gap-2">
            <button onClick={sendTab} className="px-3 py-1.5 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">Tab</button>
            <button onClick={sendEsc} className="px-3 py-1.5 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">Esc</button>
            <button onClick={() => vnc.sendCtrlAltDel()} className="px-3 py-1.5 text-xs rounded bg-red-500/20 text-red-500 hover:bg-red-500/30">Ctrl+Alt+Del</button>
          </div>
        </div>
      )}

      {/* Clipboard Panel */}
      {showClipboard && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30 w-64" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">{t('desktop.clipboard')}</div>
          <textarea
            value={clipboardInput}
            onChange={(e) => setClipboardInput(e.target.value)}
            className="w-full h-24 p-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder={t('common.paste') + '...'}
          />
          <button
            onClick={() => vnc.sendClipboard(clipboardInput)}
            className="mt-2 w-full py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90"
          >
            {t('desktop.sendToRemote')}
          </button>
        </div>
      )}

      {/* Power Panel */}
      {showPower && vnc.capabilities.power && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">{t('desktop.power')}</div>
          <div className="flex flex-col gap-2">
            <button onClick={() => { vnc.machineShutdown(); closePanels(); }} className="px-4 py-2 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">{t('desktop.shutdown')}</button>
            <button onClick={() => { vnc.machineReboot(); closePanels(); }} className="px-4 py-2 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">{t('desktop.reboot')}</button>
            <button onClick={() => { vnc.machineReset(); closePanels(); }} className="px-4 py-2 text-xs rounded bg-red-500/20 text-red-500 hover:bg-red-500/30">{t('desktop.reset')}</button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30 w-56" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-3">{t('desktop.settings')}</div>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} className="rounded" />
            <span className="text-sm text-[var(--text-primary)]">{t('desktop.viewOnly')}</span>
          </label>

          <div className="mb-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">{t('desktop.scaling')}</div>
            <select
              value={scaleMode}
              onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded focus:outline-none"
            >
              <option value="off">{t('desktop.scaleNone')}</option>
              <option value="scale">{t('desktop.scaleLocal')}</option>
              <option value="remote">{t('desktop.scaleRemote')}</option>
            </select>
          </div>

          <div className="mb-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">{t('desktop.quality')}: {quality}</div>
            <input
              type="range" min="0" max="9" value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="mb-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">{t('desktop.compression')}: {compression}</div>
            <input
              type="range" min="0" max="9" value={compression}
              onChange={(e) => setCompression(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Touch gestures help - only show on touch devices */}
          {isTouch && touchpadMode && (
            <div className="pt-3 border-t border-[var(--border-default)]">
              <div className="text-xs text-[var(--text-tertiary)] mb-2">{t('desktop.touchGestures')}</div>
              <div className="text-xs text-[var(--text-secondary)] space-y-1">
                <div className="flex justify-between">
                  <span>{t('desktop.gestureTap')}</span>
                  <span className="text-[var(--text-tertiary)]">{t('desktop.leftClick')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('desktop.gestureLongTap')}</span>
                  <span className="text-[var(--text-tertiary)]">{t('desktop.rightClick')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('desktop.gestureTwoFinger')}</span>
                  <span className="text-[var(--text-tertiary)]">{t('desktop.rightClick')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('desktop.gestureDoubleTapDrag')}</span>
                  <span className="text-[var(--text-tertiary)]">{t('desktop.dragDrop')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VNC Canvas Container */}
      <div
        ref={canvasContainerRef}
        className="absolute top-8 left-0 right-0"
        style={{
          // Adjust bottom to account for virtual keyboard in fullscreen
          bottom: fullscreen && keyboardHeight > 0 ? keyboardHeight : 0,
          cursor: touchpadMode ? 'none' : undefined,
        }}
        onClick={(e) => { e.stopPropagation(); vnc.focus(); }}
      >
        {/* Touchpad Overlay */}
        <TouchpadOverlay
          enabled={touchpadMode && vnc.status === 'connected'}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          onMove={handleTouchpadMove}
          onClick={handleTouchpadClick}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      </div>

      {/* Hidden keyboard input (for mobile keyboard) */}
      {isTouch && (
        <input
          ref={keyboardInputRef}
          type="text"
          className="absolute opacity-0 pointer-events-none"
          style={{ left: -9999 }}
          onKeyDown={handleKeyboardInput}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      )}

      {/* Connecting Overlay */}
      {vnc.status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}

      {/* Error Overlay */}
      {vnc.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <p className="text-red-500 text-sm mb-4">{vnc.error}</p>
          <button
            onClick={() => vnc.connect(getWsUrl())}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded hover:opacity-90"
          >
            {t('common.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
