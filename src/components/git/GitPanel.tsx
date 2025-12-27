'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, GitBranch, Layers, RefreshCw, ArrowUp, ArrowDown, Sparkles, AlertTriangle, Check, FileText, Zap } from 'lucide-react';
import { DiffViewer } from '@/components/ui/DiffViewer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SwipeCard, ErrorBanner, EmptyState } from '@/components/ui/primitives';
import { useIsMobile } from '@/hooks/useMediaQuery';
import {
  useGitStatus,
  useRemoteStatus,
  useBranches,
  useConflicts,
  useGitMutation,
  gitActions,
  GitStatus,
} from '@/hooks/useGitApi';
import { StashPanel } from './StashPanel';
import { CommitGraph } from './CommitGraph';
import { CommitTimeline } from './CommitTimeline';
import { MergeConflictEditor } from './MergeConflictEditor';

// ============================================================================
// Types
// ============================================================================

interface GitPanelProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function GitPanel({ isOpen, onClose, embedded = false }: GitPanelProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('changes');
  const [diffModal, setDiffModal] = useState<{ file: string; diff: string; type: string } | null>(null);
  const [showConflictEditor, setShowConflictEditor] = useState(false);

  // Data hooks
  const status = useGitStatus();
  const remote = useRemoteStatus();
  const branches = useBranches();
  const conflicts = useConflicts();
  const mutation = useGitMutation();

  // Load all data
  const fetchAll = useCallback(() => {
    status.execute();
    remote.execute();
    branches.execute();
    conflicts.execute();
  }, [status, remote, branches, conflicts]);

  useEffect(() => {
    if (isOpen) fetchAll();
  }, [isOpen]);

  // Derived state
  const allFiles = status.data
    ? [...status.data.modified, ...status.data.added, ...status.data.deleted, ...status.data.untracked]
    : [];

  if (!isOpen) return null;

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{status.data?.branch || 'No branch'}</div>
            <div className="text-xs text-muted-foreground">{formatSync(remote.data)}</div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1">
            {conflicts.data?.hasConflicts && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConflictEditor(true)}
                className="text-red-500 animate-pulse gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflicts.data.totalConflicts}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => mutation.mutate(gitActions.pull, fetchAll)} disabled={mutation.isLoading || !remote.data?.hasRemote} title="Pull">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => mutation.mutate(gitActions.push, () => remote.execute())} disabled={mutation.isLoading || !remote.data?.hasRemote} title="Push">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {!embedded && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ErrorBanner message={mutation.error || status.error} onDismiss={mutation.clearError} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 w-auto">
          <TabsTrigger value="changes" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Changes
            {allFiles.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{allFiles.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="graph" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Graph
          </TabsTrigger>
          <TabsTrigger value="stash" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Stash
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Branches
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="changes" className="mt-0 p-4">
            <ChangesTab
              status={status.data}
              isLoading={mutation.isLoading}
              onViewDiff={async (file, type) => {
                const res = await fetch(`/api/git/diff?file=${encodeURIComponent(file)}`);
                const data = await res.json();
                setDiffModal({ file, diff: data.diff || '', type });
              }}
              onDiscard={(file) => mutation.mutate(() => gitActions.discard(file), () => status.execute())}
              onCommit={(msg, files) => mutation.mutate(() => gitActions.commit(msg, files), fetchAll)}
              onGenerateMessage={(files) => gitActions.generateCommitMessage(files)}
            />
          </TabsContent>

          <TabsContent value="graph" className="mt-0 h-full">
            {isMobile ? <CommitTimeline embedded /> : <CommitGraph embedded />}
          </TabsContent>

          <TabsContent value="stash" className="mt-0 h-full">
            <StashPanel isOpen onClose={() => {}} onRefresh={() => status.execute()} />
          </TabsContent>

          <TabsContent value="branches" className="mt-0 p-4">
            <BranchesTab
              branches={branches.data?.branches || []}
              currentBranch={status.data?.branch || ''}
              isLoading={mutation.isLoading}
              onCheckout={(b) => mutation.mutate(() => gitActions.checkout(b), fetchAll)}
              onCreate={(b) => mutation.mutate(() => gitActions.createBranch(b), () => branches.execute())}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  return (
    <>
      {embedded ? (
        <div className="h-full bg-background">{content}</div>
      ) : (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
            {content}
          </SheetContent>
        </Sheet>
      )}

      {/* Diff Modal - Full screen on mobile */}
      <Dialog open={!!diffModal} onOpenChange={() => setDiffModal(null)}>
        <DialogContent fullScreenMobile className="sm:max-w-4xl flex flex-col p-0 gap-0">
          {diffModal && (
            <>
              <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-row items-center justify-between pr-14 shrink-0">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-sm font-mono truncate">{diffModal.file}</DialogTitle>
                  <p className="text-xs text-muted-foreground">{diffModal.type}</p>
                </div>
                {diffModal.type !== 'untracked' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0 ml-2"
                    onClick={() => {
                      mutation.mutate(() => gitActions.discard(diffModal.file), () => {
                        status.execute();
                        setDiffModal(null);
                      });
                    }}
                  >
                    Discard
                  </Button>
                )}
              </DialogHeader>
              <div className="flex-1 overflow-auto p-2 sm:p-4 min-h-0">
                <DiffViewer diff={diffModal.diff} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflict Editor */}
      <AnimatePresence>
        {showConflictEditor && (
          <MergeConflictEditor isOpen onClose={() => setShowConflictEditor(false)} onRefresh={fetchAll} />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Changes Tab
// ============================================================================

function ChangesTab({
  status,
  isLoading,
  onViewDiff,
  onDiscard,
  onCommit,
  onGenerateMessage,
}: {
  status: GitStatus | null;
  isLoading: boolean;
  onViewDiff: (file: string, type: string) => void;
  onDiscard: (file: string) => void;
  onCommit: (message: string, files?: string[]) => void;
  onGenerateMessage: (files?: string[]) => Promise<{ message: string }>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  const allFiles = status
    ? [...status.modified, ...status.added, ...status.deleted, ...status.untracked]
    : [];

  const toggleFile = (f: string) => {
    const next = new Set(selected);
    next.has(f) ? next.delete(f) : next.add(f);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(allFiles));

  const generateMessage = async () => {
    setGenerating(true);
    try {
      const { message: msg } = await onGenerateMessage(selected.size > 0 ? Array.from(selected) : undefined);
      setMessage(msg);
    } finally {
      setGenerating(false);
    }
  };

  const fileGroups = [
    { title: 'Modified', files: status?.modified || [], type: 'modified' as const },
    { title: 'Added', files: status?.added || [], type: 'added' as const },
    { title: 'Deleted', files: status?.deleted || [], type: 'deleted' as const },
    { title: 'Untracked', files: status?.untracked || [], type: 'untracked' as const },
  ].filter((g) => g.files.length > 0);

  if (allFiles.length === 0) {
    return (
      <EmptyState
        icon={<Check className="w-8 h-8 text-emerald-500" />}
        iconBg="bg-emerald-500/10"
        title="No changes"
        description="Working tree is clean"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Commit form - TOP */}
      <div className="pb-4 border-b">
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message..."
            rows={2}
            className="w-full p-3 pr-12 rounded-xl bg-muted border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={generateMessage}
            disabled={generating || allFiles.length === 0}
            className="absolute top-2.5 right-2.5"
            title="Generate with Claude"
          >
            {generating ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
        <Button
          className="w-full mt-3"
          disabled={!message.trim() || isLoading}
          onClick={() => {
            onCommit(message, selected.size > 0 ? Array.from(selected) : undefined);
            setMessage('');
            setSelected(new Set());
          }}
        >
          {!status?.hasCommits ? 'Create Initial Commit' : selected.size > 0 ? `Commit (${selected.size} files)` : 'Commit All'}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{allFiles.length} changed files</span>
        <button onClick={selectAll} className="text-xs text-primary font-medium hover:underline">
          Select All
        </button>
      </div>

      {fileGroups.map((group) => (
        <FileGroup
          key={group.type}
          {...group}
          selected={selected}
          onToggle={toggleFile}
          onViewDiff={onViewDiff}
          onDiscard={onDiscard}
        />
      ))}
    </div>
  );
}

// ============================================================================
// File Group
// ============================================================================

const fileColors = {
  modified: { text: 'text-amber-500', badge: 'M', variant: 'outline' as const },
  added: { text: 'text-emerald-500', badge: 'A', variant: 'outline' as const },
  deleted: { text: 'text-red-500', badge: 'D', variant: 'destructive' as const },
  untracked: { text: 'text-blue-500', badge: 'U', variant: 'secondary' as const },
};

function FileGroup({
  title,
  files,
  type,
  selected,
  onToggle,
  onViewDiff,
  onDiscard,
}: {
  title: string;
  files: string[];
  type: keyof typeof fileColors;
  selected: Set<string>;
  onToggle: (f: string) => void;
  onViewDiff: (f: string, t: string) => void;
  onDiscard: (f: string) => void;
}) {
  const color = fileColors[type];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={color.variant}>{title}</Badge>
        <span className="text-xs text-muted-foreground">{files.length}</span>
      </div>
      <div className="space-y-1">
        {files.map((file) => (
          <SwipeCard
            key={file}
            onSwipeLeft={type !== 'untracked' ? () => onDiscard(file) : undefined}
            leftAction={type !== 'untracked' ? { label: 'Discard', color: 'bg-red-500' } : undefined}
          >
            <div className="flex items-center gap-2 px-3 py-2 group">
              <input
                type="checkbox"
                checked={selected.has(file)}
                onChange={() => onToggle(file)}
                className="w-4 h-4 rounded"
              />
              <span className={`w-5 text-center text-xs font-mono font-bold ${color.text}`}>
                {color.badge}
              </span>
              <button
                onClick={() => onViewDiff(file, type)}
                className="flex-1 text-left text-sm truncate hover:text-primary hover:underline"
              >
                {file}
              </button>
              {type !== 'untracked' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDiscard(file)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </SwipeCard>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Branches Tab
// ============================================================================

function BranchesTab({
  branches,
  currentBranch,
  isLoading,
  onCheckout,
  onCreate,
}: {
  branches: string[];
  currentBranch: string;
  isLoading: boolean;
  onCheckout: (branch: string) => void;
  onCreate: (branch: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName);
      setNewName('');
      setShowNew(false);
    }
  };

  return (
    <div className="space-y-4">
      {showNew ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New branch name..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={isLoading || !newName.trim()}>Create</Button>
          <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed text-muted-foreground text-sm font-medium hover:border-primary hover:text-primary transition-colors"
        >
          + New Branch
        </button>
      )}

      <div className="space-y-1">
        {branches.map((branch) => (
          <button
            key={branch}
            onClick={() => onCheckout(branch)}
            disabled={isLoading || branch === currentBranch}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all ${
              branch === currentBranch
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {branch === currentBranch ? <Check className="h-4 w-4" /> : <GitBranch className="h-4 w-4 opacity-50" />}
            <span className="truncate">{branch}</span>
            {branch === currentBranch && <span className="ml-auto text-xs opacity-70">current</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatSync(remote: { ahead?: number; behind?: number } | null) {
  if (!remote) return 'Source Control';
  const parts = [];
  if (remote.ahead) parts.push(`${remote.ahead} ahead`);
  if (remote.behind) parts.push(`${remote.behind} behind`);
  return parts.length ? parts.join(', ') : 'Up to date';
}

const Spinner = () => <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
