'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { ToolCall } from '../types';

interface BashViewProps {
  tool: ToolCall;
  showOutput?: boolean;
}

export function BashView({ tool, showOutput = false }: BashViewProps) {
  const [showStderr, setShowStderr] = useState(false);
  const [copied, setCopied] = useState(false);

  const { command, stdout, stderr, exitCode } = useMemo(() => {
    let cmd = '';
    let out = '';
    let err = '';
    let code: number | undefined;

    // Parse input
    try {
      const input = JSON.parse(tool.input || '{}');
      cmd = input.command || '';
    } catch {
      cmd = tool.input || '';
    }

    // Parse output
    if (tool.output) {
      try {
        const result = JSON.parse(tool.output);
        out = result.stdout || '';
        err = result.stderr || '';
        code = result.exitCode;
      } catch {
        out = tool.output;
      }
    }

    return { command: cmd, stdout: out, stderr: err, exitCode: code };
  }, [tool.input, tool.output]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isError = tool.status === 'error' || exitCode !== undefined && exitCode !== 0;
  const hasStderr = stderr && stderr.trim().length > 0;
  const hasOutput = showOutput && (stdout || stderr);

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border-default)]">
      {/* Command line */}
      <div className={`flex items-start gap-2 px-3 py-2 font-mono text-[11px] ${
        isError ? 'bg-red-500/5' : 'bg-[var(--bg-tertiary)]'
      }`}>
        <span className="text-emerald-500 select-none shrink-0">$</span>
        <pre className="flex-1 whitespace-pre-wrap break-all text-[var(--text-primary)]">
          {command}
        </pre>
        <button
          onClick={handleCopy}
          className="shrink-0 p-1 hover:bg-[var(--hover-bg)] rounded"
          title="Copy command"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Copy className="w-3 h-3 text-[var(--text-tertiary)]" />
          )}
        </button>
      </div>

      {/* Exit code badge */}
      {exitCode !== undefined && exitCode !== 0 && (
        <div className="px-3 py-1 bg-red-500/10 border-t border-red-500/20">
          <span className="text-[10px] text-red-500">Exit code: {exitCode}</span>
        </div>
      )}

      {/* Output */}
      {hasOutput && (
        <div className="border-t border-[var(--border-default)]">
          {/* Output tabs if has both stdout and stderr */}
          {hasStderr && (
            <div className="flex border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <button
                onClick={() => setShowStderr(false)}
                className={`px-3 py-1 text-[10px] font-medium ${
                  !showStderr ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-tertiary)]'
                }`}
              >
                stdout
              </button>
              <button
                onClick={() => setShowStderr(true)}
                className={`px-3 py-1 text-[10px] font-medium ${
                  showStderr ? 'text-red-500 border-b-2 border-red-500' : 'text-[var(--text-tertiary)]'
                }`}
              >
                stderr
              </button>
            </div>
          )}
          <pre className={`p-3 text-[11px] font-mono overflow-x-auto max-h-32 ${
            showStderr ? 'bg-red-500/5 text-red-400' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'
          }`}>
            {showStderr ? stderr : stdout || '(no output)'}
          </pre>
        </div>
      )}
    </div>
  );
}
