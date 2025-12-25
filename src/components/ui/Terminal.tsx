import clsx from 'clsx';

interface TerminalProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Terminal({ children, title, className = '' }: TerminalProps) {
  return (
    <div className={clsx('rounded-xl terminal p-4', className)}>
      {title && (
        <div className="mb-3 text-[10px] tracking-[0.26em] uppercase text-[var(--muted)]">
          {title}
        </div>
      )}
      <pre className="overflow-auto text-xs text-[var(--ink)] font-mono leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}
