'use client';

interface TokenUsagePieProps {
  used: number;
  total: number;
  className?: string;
}

export function TokenUsagePie({ used, total, className = '' }: TokenUsagePieProps) {
  // Only render if we have valid values
  if (used == null || total == null || total <= 0) return null;

  const percentage = Math.min(100, (used / total) * 100);
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on usage level
  const getColor = () => {
    if (percentage < 50) return 'var(--accent)'; // blue
    if (percentage < 75) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className={`flex items-center gap-2 text-xs text-[var(--text-secondary)] ${className}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="2"
        />
        {/* Progress circle */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <span title={`${used.toLocaleString()} / ${total.toLocaleString()} tokens`}>
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}
