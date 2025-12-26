'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message } from '../types';
import { Icon } from '@/components/ui/Icon';
import { CodeBlock } from './CodeBlock';

export function MessageBubble({ message }: { message: Message }) {
  const [showThinking, setShowThinking] = useState(false);

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
        {/* Thinking (collapsible) */}
        {message.thinking && (
          <div className="mb-3">
            <button onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 mb-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="font-medium">Thinking</span>
              <svg className={`w-3 h-3 transition-transform ${showThinking ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <AnimatePresence>
              {showThinking && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700/80 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {message.thinking}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Tool calls summary */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {message.toolCalls.map((tool) => (
              <span key={tool.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-mono">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {tool.name}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
            components={{ code: CodeBlock }}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
          {message.model && <span>{message.model.replace('claude-', '').replace('-20251101', '')}</span>}
          {message.usage?.costUsd !== undefined && <span>${message.usage.costUsd.toFixed(4)}</span>}
          {message.usage?.durationMs !== undefined && <span>{(message.usage.durationMs / 1000).toFixed(1)}s</span>}
        </div>
      </div>
    </div>
  );
}
