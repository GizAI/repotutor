'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  hover?: boolean;
}

export function Card({ children, className = '', glow = false, hover = false }: CardProps) {
  const baseClasses = clsx(
    'relative rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 p-5',
    'shadow-[0_0_0_1px_rgba(0,0,0,.35),0_40px_120px_var(--shadow)] backdrop-blur-md',
    hover && 'transition-transform duration-300 hover:scale-[1.01]',
    className
  );

  if (glow) {
    return (
      <div className={baseClasses}>
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-70 [mask-image:radial-gradient(120px_120px_at_20%_10%,black,transparent)]">
          <div className="h-full w-full rounded-2xl bg-[conic-gradient(from_120deg_at_20%_10%,var(--accent),transparent_20%,var(--accent2),transparent_60%,var(--accent))]" />
        </div>
        <div className="relative">{children}</div>
      </div>
    );
  }

  return <div className={baseClasses}>{children}</div>;
}

interface AnimatedCardProps extends CardProps {
  delay?: number;
}

export function AnimatedCard({ children, className, glow, hover, delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -20% 0px' }}
      transition={{ duration: 0.6, delay: delay * 0.1 }}
    >
      <Card className={className} glow={glow} hover={hover}>
        {children}
      </Card>
    </motion.div>
  );
}
