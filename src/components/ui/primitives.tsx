'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';

/**
 * UI primitives that complement shadcn components
 * Only contains components not available in shadcn
 */

// ============================================================================
// SWIPE CARD - Card with swipe-to-action (mobile gesture)
// ============================================================================

interface SwipeCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: { label: string; color: string; icon?: ReactNode };
  rightAction?: { label: string; color: string; icon?: ReactNode };
  swipeThreshold?: number;
}

export function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  swipeThreshold = 50,
}: SwipeCardProps) {
  const handlers = useSwipeable({
    onSwipedLeft: () => onSwipeLeft?.(),
    onSwipedRight: () => onSwipeRight?.(),
    trackMouse: false,
    trackTouch: true,
    delta: swipeThreshold,
  });

  return (
    <div className="relative overflow-hidden rounded-xl">
      {leftAction && (
        <div className={`absolute inset-y-0 left-0 flex items-center px-4 ${leftAction.color} text-white`}>
          {leftAction.icon}
          <span className="ml-2 font-medium">{leftAction.label}</span>
        </div>
      )}
      {rightAction && (
        <div className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 ${rightAction.color} text-white`}>
          <span className="mr-2 font-medium">{rightAction.label}</span>
          {rightAction.icon}
        </div>
      )}
      <div {...handlers} className="relative bg-[var(--bg-secondary)]">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BANNER - Dismissible error message
// ============================================================================

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-500 text-sm flex items-center justify-between"
        >
          <span>{message}</span>
          <button onClick={onDismiss} className="text-xs underline">Dismiss</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// EMPTY STATE - Placeholder for empty content
// ============================================================================

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  iconBg?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  iconBg = 'bg-[var(--bg-secondary)]',
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <p className="text-[var(--text-secondary)] font-medium">{title}</p>
      {description && (
        <p className="text-xs text-[var(--text-tertiary)] mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================================
// LOADING SPINNER - Centered spinner
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const spinnerSizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
};

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`${spinnerSizes[size]} border-[var(--accent)] border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="md" />
    </div>
  );
}
