import clsx from 'clsx';

interface ChipProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'accent' | 'muted';
}

export function Chip({ children, className = '', variant = 'default' }: ChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-3 py-1.5',
        'text-[10px] tracking-[0.24em] uppercase',
        variant === 'default' && 'border-[var(--line)] bg-[rgba(255,255,255,0.04)] text-[var(--muted)]',
        variant === 'accent' && 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]',
        variant === 'muted' && 'border-[var(--line)] bg-[var(--bg1)] text-[var(--muted)]',
        className
      )}
    >
      {children}
    </span>
  );
}
