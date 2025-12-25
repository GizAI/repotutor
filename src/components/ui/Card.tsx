'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hover = false, padding = 'md' }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--border-default)] bg-[var(--card-bg)]',
        hover && 'transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--hover-bg)]',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface AnimatedCardProps extends CardProps {
  delay?: number;
}

export function AnimatedCard({ children, className, hover, padding, delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration: 0.4, delay: delay * 0.08, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className={className} hover={hover} padding={padding}>
        {children}
      </Card>
    </motion.div>
  );
}
