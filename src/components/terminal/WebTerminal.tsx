'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTerminal } from '@/hooks/useTerminal';
import type { Terminal as XTerminal } from 'xterm';
import type { FitAddon as XFitAddon } from '@xterm/addon-fit';

interface WebTerminalProps {
  className?: string;
}

export function WebTerminal({ className = '' }: WebTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<XFitAddon | null>(null);
  const [ready, setReady] = useState(false);

  const { connected, connect, disconnect, write, resize, onData, onExit } = useTerminal();

  // Initialize terminal
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
          resize(term.cols, term.rows);
        }
      }, 100);

      setReady(true);

      // Connect to terminal channel
      connect();
    };

    initTerminal();

    return () => {
      mounted = false;
      disconnect();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [connect, disconnect, resize]);

  // Handle terminal input
  useEffect(() => {
    const term = terminalRef.current;
    if (!term || !ready) return;

    const disposable = term.onData((data) => {
      write(data);
    });

    return () => {
      disposable.dispose();
    };
  }, [ready, write]);

  // Handle terminal output from server
  useEffect(() => {
    if (!ready) return;

    onData((data) => {
      terminalRef.current?.write(data);
    });

    onExit((code) => {
      terminalRef.current?.writeln(`\r\n\x1b[33mProcess exited with code ${code}\x1b[0m`);
    });
  }, [ready, onData, onExit]);

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

  return (
    <div className={`relative h-full ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ padding: '8px', backgroundColor: '#1a1a1a' }}
      />
      {!connected && ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-[var(--text-secondary)] text-sm">Connecting...</div>
        </div>
      )}
    </div>
  );
}
