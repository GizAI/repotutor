import clsx from 'clsx';

interface ChipProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
}

export function Chip({
  children,
  className = '',
  variant = 'default',
  size = 'sm'
}: ChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        // Size
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-3 py-1 text-xs',
        // Variants
        variant === 'default' && 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        variant === 'accent' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
        variant === 'success' && 'bg-emerald-500/10 text-emerald-500',
        variant === 'warning' && 'bg-amber-500/10 text-amber-500',
        variant === 'error' && 'bg-red-500/10 text-red-500',
        className
      )}
    >
      {children}
    </span>
  );
}
