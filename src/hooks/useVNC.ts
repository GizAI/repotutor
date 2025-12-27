'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// RFB will be dynamically imported
type RFBType = InstanceType<typeof import('@/lib/novnc/rfb').default>;

export interface VNCState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  desktopName: string;
  capabilities: {
    power: boolean;
  };
}

export interface VNCOptions {
  scaleViewport?: boolean;
  resizeSession?: boolean;
  viewOnly?: boolean;
  qualityLevel?: number;
  compressionLevel?: number;
  showDotCursor?: boolean;
}

export function useVNC(containerRef: React.RefObject<HTMLDivElement | null>) {
  const rfbRef = useRef<RFBType | null>(null);
  const [state, setState] = useState<VNCState>({
    status: 'disconnected',
    error: null,
    desktopName: '',
    capabilities: { power: false },
  });
  const [clipboardText, setClipboardText] = useState('');

  // Connect to VNC server
  const connect = useCallback(async (url: string, options: VNCOptions = {}) => {
    if (!containerRef.current) {
      setState(s => ({ ...s, status: 'error', error: 'Container not ready' }));
      return;
    }

    // Disconnect existing connection
    if (rfbRef.current) {
      rfbRef.current.disconnect();
      rfbRef.current = null;
    }

    setState(s => ({ ...s, status: 'connecting', error: null }));

    try {
      // Dynamic import RFB
      const RFB = (await import('@/lib/novnc/rfb')).default;

      const rfb = new RFB(containerRef.current, url, {
        credentials: { password: '' },
      });

      // Apply options
      rfb.scaleViewport = options.scaleViewport ?? false;
      rfb.resizeSession = options.resizeSession ?? true;
      rfb.viewOnly = options.viewOnly ?? false;
      rfb.qualityLevel = options.qualityLevel ?? 6;
      rfb.compressionLevel = options.compressionLevel ?? 2;
      rfb.showDotCursor = options.showDotCursor ?? false;

      // Event handlers
      rfb.addEventListener('connect', () => {
        setState(s => ({ ...s, status: 'connected', error: null }));
      });

      rfb.addEventListener('disconnect', (e: CustomEvent) => {
        const clean = e.detail?.clean ?? true;
        setState(s => ({
          ...s,
          status: 'disconnected',
          error: clean ? null : 'Connection lost',
        }));
        rfbRef.current = null;
      });

      rfb.addEventListener('credentialsrequired', () => {
        // For now, send empty password
        rfb.sendCredentials({ password: '' });
      });

      rfb.addEventListener('securityfailure', (e: CustomEvent) => {
        setState(s => ({
          ...s,
          status: 'error',
          error: e.detail?.reason || 'Security failure',
        }));
      });

      rfb.addEventListener('clipboard', (e: CustomEvent) => {
        setClipboardText(e.detail?.text || '');
      });

      rfb.addEventListener('desktopname', (e: CustomEvent) => {
        setState(s => ({ ...s, desktopName: e.detail?.name || '' }));
      });

      rfb.addEventListener('capabilities', (e: CustomEvent) => {
        setState(s => ({
          ...s,
          capabilities: {
            power: e.detail?.capabilities?.power ?? false,
          },
        }));
      });

      rfbRef.current = rfb;
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error: (err as Error).message || 'Failed to connect',
      }));
    }
  }, [containerRef]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (rfbRef.current) {
      rfbRef.current.disconnect();
      rfbRef.current = null;
    }
  }, []);

  // Send key
  const sendKey = useCallback((keysym: number, code: string, down?: boolean) => {
    rfbRef.current?.sendKey(keysym, code, down);
  }, []);

  // Send Ctrl+Alt+Del
  const sendCtrlAltDel = useCallback(() => {
    rfbRef.current?.sendCtrlAltDel();
  }, []);

  // Machine power actions
  const machineShutdown = useCallback(() => {
    rfbRef.current?.machineShutdown();
  }, []);

  const machineReboot = useCallback(() => {
    rfbRef.current?.machineReboot();
  }, []);

  const machineReset = useCallback(() => {
    rfbRef.current?.machineReset();
  }, []);

  // Clipboard
  const sendClipboard = useCallback((text: string) => {
    if (rfbRef.current) {
      rfbRef.current.clipboardPasteFrom(text);
    }
  }, []);

  // Focus
  const focus = useCallback(() => {
    rfbRef.current?.focus();
  }, []);

  const blur = useCallback(() => {
    rfbRef.current?.blur();
  }, []);

  // Update options
  const setScaleViewport = useCallback((scale: boolean) => {
    if (rfbRef.current) rfbRef.current.scaleViewport = scale;
  }, []);

  const setResizeSession = useCallback((resize: boolean) => {
    if (rfbRef.current) rfbRef.current.resizeSession = resize;
  }, []);

  const setViewOnly = useCallback((viewOnly: boolean) => {
    if (rfbRef.current) rfbRef.current.viewOnly = viewOnly;
  }, []);

  const setQualityLevel = useCallback((level: number) => {
    if (rfbRef.current) rfbRef.current.qualityLevel = level;
  }, []);

  const setCompressionLevel = useCallback((level: number) => {
    if (rfbRef.current) rfbRef.current.compressionLevel = level;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rfbRef.current) {
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    clipboardText,
    connect,
    disconnect,
    sendKey,
    sendCtrlAltDel,
    machineShutdown,
    machineReboot,
    machineReset,
    sendClipboard,
    focus,
    blur,
    setScaleViewport,
    setResizeSession,
    setViewOnly,
    setQualityLevel,
    setCompressionLevel,
  };
}
