'use client';

import { ReactNode, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '../ui/Icon';

// ============================================
// Architecture Diagram - 인터랙티브 아키텍처 뷰
// ============================================
interface ArchNode {
  id: string;
  label: string;
  icon?: IconName;
  type?: 'client' | 'server' | 'database' | 'external' | 'default';
  x: number;
  y: number;
}

interface ArchConnection {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
}

export function ArchitectureDiagram({
  nodes,
  connections,
  height = 400,
}: {
  nodes: ArchNode[];
  connections: ArchConnection[];
  height?: number;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeColors = {
    client: { bg: 'var(--accent)', border: 'var(--accent)' },
    server: { bg: 'var(--bg-secondary)', border: 'var(--border-default)' },
    database: { bg: 'var(--accent-hover)', border: 'var(--accent-hover)' },
    external: { bg: 'var(--text-secondary)', border: 'var(--text-secondary)' },
    default: { bg: 'var(--bg-secondary)', border: 'var(--border-default)' },
  };

  const getNodePos = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  return (
    <div className="my-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]/50 p-4 overflow-hidden">
      <svg ref={svgRef} width="100%" height={height} className="font-mono">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent)" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connections */}
        {connections.map((conn, i) => {
          const from = getNodePos(conn.from);
          const to = getNodePos(conn.to);
          const isHighlighted = hoveredNode === conn.from || hoveredNode === conn.to;

          return (
            <g key={i}>
              <motion.line
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke={isHighlighted ? 'var(--accent)' : 'var(--border-default)'}
                strokeWidth={isHighlighted ? 2 : 1}
                markerEnd="url(#arrowhead)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: i * 0.1 }}
              />
              {conn.label && (
                <text
                  x={`${(from.x + to.x) / 2}%`}
                  y={`${(from.y + to.y) / 2 - 2}%`}
                  fill="var(--text-secondary)"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {conn.label}
                </text>
              )}
              {conn.animated && (
                <circle r="4" fill="var(--accent)">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={`M${from.x * 4},${from.y * 4} L${to.x * 4},${to.y * 4}`}
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const colors = nodeColors[node.type || 'default'];
          const isHovered = hoveredNode === node.id;

          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
              filter={isHovered ? 'url(#glow)' : undefined}
            >
              <rect
                x={`${node.x - 8}%`}
                y={`${node.y - 5}%`}
                width="16%"
                height="10%"
                rx="12"
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={isHovered ? 2 : 1}
                opacity={isHovered ? 1 : 0.8}
              />
              <text
                x={`${node.x}%`}
                y={`${node.y + 1}%`}
                fill="var(--text-primary)"
                fontSize="11"
                textAnchor="middle"
                fontWeight="500"
              >
                {node.label}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================
// Flow Diagram - 스텝별 흐름도
// ============================================
export function FlowDiagram({ steps }: { steps: { title: string; description: string; icon?: IconName }[] }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="my-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-6">
      {/* Progress bar */}
      <div className="relative h-1 bg-[var(--border-default)] rounded-full mb-6 overflow-hidden">
        <motion.div
          className="absolute h-full bg-[var(--accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Steps */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            className={`flex-shrink-0 w-48 p-4 rounded-xl border cursor-pointer transition-all ${
              i === activeStep
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border-default)] bg-[var(--bg-tertiary)]/50'
            }`}
            onClick={() => setActiveStep(i)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i === activeStep ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'bg-[var(--border-default)] text-[var(--text-secondary)]'
              }`}>
                {i + 1}
              </span>
              {step.icon && <Icon name={step.icon} className="h-4 w-4 text-[var(--accent)]" />}
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</div>
            <div className="text-[10px] text-[var(--text-secondary)] mt-1">{step.description}</div>
          </motion.div>
        ))}
      </div>

      {/* Active step detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-4 p-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-xs text-[var(--accent)]">현재 단계</span>
          </div>
          <div className="mt-2 text-sm text-[var(--text-primary)]">{steps[activeStep].title}</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Comparison Table - 비교 테이블
// ============================================
export function ComparisonTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: { label: string; values: (string | boolean)[] }[];
}) {
  return (
    <div className="my-8 rounded-2xl border border-[var(--border-default)] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[var(--bg-secondary)]">
            <th className="p-4 text-left text-xs font-semibold text-[var(--text-primary)]" />
            {headers.map((h, i) => (
              <th key={i} className="p-4 text-center text-xs font-semibold text-[var(--text-primary)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border-t border-[var(--border-default)]"
            >
              <td className="p-4 text-sm font-medium text-[var(--text-primary)]">{row.label}</td>
              {row.values.map((v, j) => (
                <td key={j} className="p-4 text-center">
                  {typeof v === 'boolean' ? (
                    v ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                        ✓
                      </span>
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--border-default)] text-[var(--text-secondary)]">
                        ✗
                      </span>
                    )
                  ) : (
                    <span className="text-sm text-[var(--text-secondary)]">{v}</span>
                  )}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Stats Grid - 통계 그리드
// ============================================
export function StatsGrid({ stats }: { stats: { label: string; value: string; change?: string }[] }) {
  return (
    <div className="my-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-4"
        >
          <div className="text-2xl font-display text-[var(--text-primary)]">{stat.value}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">{stat.label}</div>
          {stat.change && (
            <div className={`text-[10px] mt-2 ${stat.change.startsWith('+') ? 'text-green-500' : 'text-[var(--accent-hover)]'}`}>
              {stat.change}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// Timeline - 타임라인
// ============================================
export function Timeline({ events }: { events: { date: string; title: string; description: string }[] }) {
  return (
    <div className="my-8 relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-default)]" />
      <div className="space-y-6">
        {events.map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="relative pl-10"
          >
            <div className="absolute left-2 w-5 h-5 rounded-full border-2 border-[var(--accent)] bg-[var(--bg-primary)]" />
            <div className="text-[10px] text-[var(--accent)] tracking-wider uppercase">{event.date}</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] mt-1">{event.title}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">{event.description}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Tabbed Content - 탭 컨텐츠
// ============================================
export function Tabs({ tabs }: { tabs: { label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="my-8">
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-default)]">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              i === active
                ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-4"
        >
          {tabs[active].content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Accordion - 아코디언
// ============================================
export function Accordion({ items }: { items: { title: string; content: ReactNode }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="my-8 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-[var(--border-default)] overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <span className="text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
            <motion.span
              animate={{ rotate: openIndex === i ? 180 : 0 }}
              className="text-[var(--text-secondary)]"
            >
              ▼
            </motion.span>
          </button>
          <AnimatePresence>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)]/50">
                  {item.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Interactive Code - 인터랙티브 코드
// ============================================
export function InteractiveCode({
  files,
}: {
  files: { name: string; language: string; code: string }[];
}) {
  const [activeFile, setActiveFile] = useState(0);

  return (
    <div className="my-8 rounded-2xl border border-[var(--border-default)] overflow-hidden">
      {/* Tab bar */}
      <div className="flex bg-[var(--bg-secondary)]/80 border-b border-[var(--border-default)]">
        {files.map((file, i) => (
          <button
            key={i}
            onClick={() => setActiveFile(i)}
            className={`px-4 py-2 text-xs font-mono transition-all ${
              i === activeFile
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* Code content */}
      <div className="relative">
        <div className="absolute top-2 right-2 text-[10px] text-[var(--text-secondary)] tracking-wider uppercase">
          {files[activeFile].language}
        </div>
        <pre className="p-4 overflow-x-auto bg-[var(--bg-tertiary)]">
          <code className="text-xs font-mono text-[var(--text-primary)] leading-relaxed">
            {files[activeFile].code}
          </code>
        </pre>
      </div>
    </div>
  );
}
