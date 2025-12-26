'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

interface ContextMeterProps {
  tokens: number;
  maxTokens: number;
  isCompacting?: boolean;
  checkpointId?: string;
  onRequestCompaction?: () => void;
}

export function ContextMeter({ tokens, maxTokens, isCompacting, checkpointId, onRequestCompaction }: ContextMeterProps) {
  const [showDetails, setShowDetails] = useState(false);
  const pct = Math.min((tokens / maxTokens) * 100, 100);
  const isWarning = pct > 70;
  const isCritical = pct > 90;

  return (
    <div className="relative">
      <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-1.5 hover:opacity-80"
        title={`${formatTokens(tokens)} / ${formatTokens(maxTokens)} tokens`}>
        {isCompacting && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
        {checkpointId && (
          <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
        )}
        <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }}
          />
        </div>
        <span className={`text-[9px] font-mono ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>
          {pct.toFixed(0)}%
        </span>
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-2 w-48 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg z-20">
            <div className="text-xs text-[var(--text-secondary)] space-y-2">
              <div className="flex justify-between">
                <span>Used:</span><span className="font-mono">{formatTokens(tokens)}</span>
              </div>
              <div className="flex justify-between">
                <span>Max:</span><span className="font-mono">{formatTokens(maxTokens)}</span>
              </div>
              {checkpointId && (
                <div className="flex justify-between">
                  <span>Checkpoint:</span><span className="font-mono text-emerald-500">{checkpointId.slice(0, 8)}</span>
                </div>
              )}
              <div className={`flex items-center gap-1 ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
                <div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span>{isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'}</span>
              </div>
              {onRequestCompaction && pct > 50 && (
                <button onClick={onRequestCompaction} disabled={isCompacting}
                  className="w-full mt-2 px-2 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[10px] hover:border-[var(--accent)] disabled:opacity-50">
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
