'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVNC } from '@/hooks/useVNC';
import { Icon } from '@/components/ui/Icon';

interface DesktopViewerProps {
  className?: string;
}

type ServerState = 'checking' | 'not_running' | 'starting' | 'ready';
type ScaleMode = 'off' | 'scale' | 'remote';

export function DesktopViewer({ className = '' }: DesktopViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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

  // Modifier keys state
  const [ctrlDown, setCtrlDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const [winDown, setWinDown] = useState(false);

  const vnc = useVNC(canvasContainerRef);

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
    });
  }, [serverState, vnc, getWsUrl, scaleMode, viewOnly, quality, compression]);

  // Apply settings changes
  useEffect(() => {
    vnc.setResizeSession(scaleMode === 'remote');
    vnc.setScaleViewport(scaleMode === 'scale');
  }, [scaleMode, vnc]);

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
        <Icon name="loader" className="w-6 h-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (serverState === 'not_running') {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-[var(--bg-secondary)] ${className}`}>
        <Icon name="monitor" className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
        <p className="text-[var(--text-secondary)] text-sm mb-2">Remote Desktop</p>
        <p className="text-[var(--text-tertiary)] text-xs mb-4">VNC server not running</p>
        <button
          onClick={startServer}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          Start Desktop
        </button>
      </div>
    );
  }

  if (serverState === 'starting') {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-[var(--bg-secondary)] ${className}`}>
        <Icon name="loader" className="w-6 h-6 text-[var(--accent)] animate-spin mb-3" />
        <p className="text-[var(--text-secondary)] text-sm">Starting VNC server...</p>
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
            {vnc.status === 'connected' ? `Connected to ${vnc.desktopName || 'Desktop'}` : vnc.status === 'connecting' ? 'Connecting...' : vnc.error || 'Disconnected'}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-1">
          {/* Extra Keys */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowKeys(!showKeys); setShowSettings(false); setShowClipboard(false); setShowPower(false); }}
            className={`p-1.5 rounded ${showKeys ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
            title="Extra Keys"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h4M14 8h4M8 12h8M6 16h12" />
            </svg>
          </button>

          {/* Clipboard */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowClipboard(!showClipboard); setShowSettings(false); setShowKeys(false); setShowPower(false); }}
            className={`p-1.5 rounded ${showClipboard ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
            title="Clipboard"
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
              title="Power"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v10M18.4 6.6a9 9 0 11-12.8 0" />
              </svg>
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
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
            title="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          {/* Disconnect */}
          <button
            onClick={(e) => { e.stopPropagation(); vnc.disconnect(); }}
            className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
            title="Disconnect"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.36 6.64A9 9 0 015.64 18.36M5.64 5.64A9 9 0 0118.36 18.36" />
            </svg>
          </button>
        </div>
      </div>

      {/* Extra Keys Panel */}
      {showKeys && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">Modifier Keys</div>
          <div className="flex gap-2 mb-3">
            <button onClick={toggleCtrl} className={`px-3 py-1.5 text-xs rounded ${ctrlDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>Ctrl</button>
            <button onClick={toggleAlt} className={`px-3 py-1.5 text-xs rounded ${altDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>Alt</button>
            <button onClick={toggleWin} className={`px-3 py-1.5 text-xs rounded ${winDown ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'}`}>Win</button>
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">Special Keys</div>
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
          <div className="text-xs text-[var(--text-tertiary)] mb-2">Clipboard</div>
          <textarea
            value={clipboardInput}
            onChange={(e) => setClipboardInput(e.target.value)}
            className="w-full h-24 p-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder="Paste text here..."
          />
          <button
            onClick={() => vnc.sendClipboard(clipboardInput)}
            className="mt-2 w-full py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90"
          >
            Send to Remote
          </button>
        </div>
      )}

      {/* Power Panel */}
      {showPower && vnc.capabilities.power && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">Power</div>
          <div className="flex flex-col gap-2">
            <button onClick={() => { vnc.machineShutdown(); closePanels(); }} className="px-4 py-2 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">Shutdown</button>
            <button onClick={() => { vnc.machineReboot(); closePanels(); }} className="px-4 py-2 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]">Reboot</button>
            <button onClick={() => { vnc.machineReset(); closePanels(); }} className="px-4 py-2 text-xs rounded bg-red-500/20 text-red-500 hover:bg-red-500/30">Reset</button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-9 right-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl p-3 z-30 w-56" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs text-[var(--text-tertiary)] mb-3">Settings</div>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} className="rounded" />
            <span className="text-sm text-[var(--text-primary)]">View only</span>
          </label>

          <div className="mb-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Scaling</div>
            <select
              value={scaleMode}
              onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded focus:outline-none"
            >
              <option value="off">None</option>
              <option value="scale">Local Scaling</option>
              <option value="remote">Remote Resizing</option>
            </select>
          </div>

          <div className="mb-3">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Quality: {quality}</div>
            <input
              type="range" min="0" max="9" value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-1">Compression: {compression}</div>
            <input
              type="range" min="0" max="9" value={compression}
              onChange={(e) => setCompression(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* VNC Canvas Container */}
      <div
        ref={canvasContainerRef}
        className="absolute top-8 left-0 right-0 bottom-0"
        onClick={(e) => { e.stopPropagation(); vnc.focus(); }}
      />

      {/* Connecting Overlay */}
      {vnc.status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <Icon name="loader" className="w-8 h-8 text-white animate-spin" />
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
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
