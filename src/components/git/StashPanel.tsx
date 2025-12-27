'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, X, Trash2, ChevronLeft } from 'lucide-react';
import { DiffViewer } from '@/components/ui/DiffViewer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBanner, EmptyState, LoadingSpinner } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n';

interface StashEntry {
  index: number;
  message: string;
  branch: string;
  date: string;
  files: number;
}

interface StashPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function StashPanel({ isOpen, onClose, onRefresh }: StashPanelProps) {
  const { t } = useT();
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStashMessage, setNewStashMessage] = useState('');
  const [selectedStash, setSelectedStash] = useState<number | null>(null);
  const [stashDiff, setStashDiff] = useState<string | null>(null);
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);

  const fetchStashes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/stash');
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setStashes(data.stashes || []);
        setError(null);
      }
    } catch {
      setError(t('git.stash.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) fetchStashes();
  }, [isOpen, fetchStashes]);

  const createStash = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', message: newStashMessage }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNewStashMessage('');
        setShowCreateModal(false);
        fetchStashes();
        onRefresh?.();
      }
    } catch {
      setError(t('git.stash.createError'));
    } finally {
      setIsLoading(false);
    }
  };

  const applyStash = async (index: number) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', index }),
      });
      const data = await response.json();
      if (data.error) setError(data.error);
      else onRefresh?.();
    } catch {
      setError(t('git.stash.applyError'));
    } finally {
      setIsLoading(false);
    }
  };

  const popStash = async (index: number) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pop', index }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchStashes();
        onRefresh?.();
      }
    } catch {
      setError(t('git.stash.popError'));
    } finally {
      setIsLoading(false);
    }
  };

  const dropStash = async (index: number) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drop', index }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchStashes();
        setSwipedIndex(null);
      }
    } catch {
      setError(t('git.stash.dropError'));
    } finally {
      setIsLoading(false);
    }
  };

  const viewStashDiff = async (index: number) => {
    try {
      const response = await fetch('/api/git/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'show', index }),
      });
      const data = await response.json();
      if (data.diff) {
        setSelectedStash(index);
        setStashDiff(data.diff);
      }
    } catch {
      setError(t('git.stash.viewError'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500">
          <Layers className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{t('git.stash.title')}</div>
          <div className="text-xs text-muted-foreground">{stashes.length} {t('git.stash.count')}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(true)} title={t('git.stash.create')}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && stashes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : stashes.length === 0 ? (
          <EmptyState
            icon={<Layers className="w-8 h-8 text-muted-foreground" />}
            title={t('git.stash.empty')}
            description={t('git.stash.emptyHint')}
          />
        ) : (
          <div className="space-y-3">
            {stashes.map((stash) => (
              <StashCard
                key={stash.index}
                stash={stash}
                isSwiped={swipedIndex === stash.index}
                onSwipe={(swiped) => setSwipedIndex(swiped ? stash.index : null)}
                onApply={() => applyStash(stash.index)}
                onPop={() => popStash(stash.index)}
                onDrop={() => dropStash(stash.index)}
                onView={() => viewStashDiff(stash.index)}
                disabled={isLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('git.stash.createTitle')}</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={newStashMessage}
            onChange={(e) => setNewStashMessage(e.target.value)}
            placeholder={t('git.stash.messagePlaceholder')}
            className="w-full px-4 py-3 rounded-xl bg-muted border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={createStash} disabled={isLoading}>
              {isLoading ? t('common.saving') : t('git.stash.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff Viewer Modal - Full screen on mobile */}
      <Dialog open={stashDiff !== null} onOpenChange={() => { setStashDiff(null); setSelectedStash(null); }}>
        <DialogContent className="w-full h-full max-w-full max-h-full sm:max-w-4xl sm:max-h-[85vh] sm:h-auto rounded-none sm:rounded-lg flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
            <DialogTitle className="text-sm font-mono">
              stash@{'{' + selectedStash + '}'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground truncate">
              {stashes.find((s) => s.index === selectedStash)?.message || ''}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-2 sm:p-4 min-h-0">
            {stashDiff && <DiffViewer diff={stashDiff} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// StashCard with swipe-to-delete
function StashCard({
  stash,
  isSwiped,
  onSwipe,
  onApply,
  onPop,
  onDrop,
  onView,
  disabled,
}: {
  stash: StashEntry;
  isSwiped: boolean;
  onSwipe: (swiped: boolean) => void;
  onApply: () => void;
  onPop: () => void;
  onDrop: () => void;
  onView: () => void;
  disabled: boolean;
}) {
  const { t } = useT();

  const handlers = useSwipeable({
    onSwipedLeft: () => onSwipe(true),
    onSwipedRight: () => onSwipe(false),
    trackMouse: false,
    trackTouch: true,
    delta: 50,
  });

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-500 text-white">
        <button onClick={onDrop} disabled={disabled} className="flex items-center gap-2 font-medium">
          <Trash2 className="h-5 w-5" />
          {t('git.stash.drop')}
        </button>
      </div>

      {/* Card */}
      <motion.div
        {...handlers}
        animate={{ x: isSwiped ? -100 : 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-muted border rounded-xl p-4"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {stash.message || t('git.stash.noMessage')}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{stash.date}</span>
              {stash.branch && (
                <>
                  <span>•</span>
                  <span className="text-primary">{stash.branch}</span>
                </>
              )}
            </div>
          </div>
          <Badge variant="secondary">{stash.files} {t('git.stash.files')}</Badge>
        </div>

        <div className="flex gap-2 mt-3">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onView} disabled={disabled}>
            {t('git.stash.view')}
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={onApply} disabled={disabled}>
            {t('git.stash.apply')}
          </Button>
          <Button size="sm" className="flex-1" onClick={onPop} disabled={disabled}>
            {t('git.stash.pop')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
