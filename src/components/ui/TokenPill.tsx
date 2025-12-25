interface TokenPillProps {
  label: string;
  value: string;
}

export function TokenPill({ label, value }: TokenPillProps) {
  return (
    <div className="group inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5">
      <span className="text-xs tracking-[0.18em] uppercase text-[var(--muted)]">{label}</span>
      <span className="font-mono text-xs text-[var(--ink)]">{value}</span>
      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-70 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
