'use client';

import { motion } from 'framer-motion';
import { Icon, type IconName } from '../ui/Icon';

interface SectionProps {
  id: string;
  number: string;
  title: string;
  kicker: string;
  icon: IconName;
  children: React.ReactNode;
  delay?: number;
}

export function Section({ id, number, title, kicker, icon, children, delay = 0 }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px -20% 0px' }}
        transition={{ duration: 0.6, delay: delay * 0.06 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_50px_var(--shadow)]">
              <Icon name={icon} className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-[10px] tracking-[0.32em] uppercase text-[var(--muted)]">{kicker}</div>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl leading-tight text-[var(--ink)]">{title}</h2>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/60 px-3 py-1.5 backdrop-blur">
            <span className="text-[10px] tracking-[0.26em] uppercase text-[var(--muted)]">{number}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}
