'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { AlertTriangle, X, ChevronLeft, ChevronDown, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBanner, EmptyState, LoadingSpinner } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface ConflictHunk {
  id: number;
  startLine: number;
  endLine: number;
  current: string;
  incoming: string;
  base?: string;
}

interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
}

interface MergeConflictEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function MergeConflictEditor({ isOpen, onClose, onRefresh }: MergeConflictEditorProps) {
  const { t } = useT();
  const isMobile = useIsMobile();
  const [files, setFiles] = useState<ConflictFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ConflictFile | null>(null);
  const [selectedHunk, setSelectedHunk] = useState<ConflictHunk | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fetchConflicts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/conflicts');
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFiles(data.files || []);
        setError(null);
      }
    } catch {
      setError('Failed to fetch conflicts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchConflicts();
  }, [isOpen, fetchConflicts]);

  const resolveHunk = async (
    file: string,
    hunkId: number,
    resolution: 'current' | 'incoming' | 'both' | 'manual',
    content?: string
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, hunkId, resolution, content }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchConflicts();
        setSelectedHunk(null);
        setIsEditing(false);
        onRefresh?.();
      }
    } catch {
      setError('Failed to resolve conflict');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveFile = async (file: string, strategy: 'ours' | 'theirs') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/resolve-conflict', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, strategy }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchConflicts();
        setSelectedFile(null);
        onRefresh?.();
      }
    } catch {
      setError('Failed to resolve file');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalConflicts = files.reduce((sum, f) => sum + f.hunks.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 h-14 px-4 border-b shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500">
          <AlertTriangle className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{t('git.conflict.title')}</div>
          <div className="text-xs text-muted-foreground">
            {totalConflicts > 0 ? t('git.conflict.remaining', { count: totalConflicts }) : t('git.conflict.noConflicts')}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && files.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : files.length === 0 ? (
          <EmptyState
            icon={<Check className="w-8 h-8 text-emerald-500" />}
            iconBg="bg-emerald-500/10"
            title={t('git.conflict.noConflicts')}
            description="All conflicts have been resolved"
          />
        ) : (
          <div className="p-4 space-y-3">
            {files.map((file) => (
              <ConflictFileCard
                key={file.path}
                file={file}
                isMobile={isMobile}
                isSelected={selectedFile?.path === file.path}
                onSelect={() => setSelectedFile(selectedFile?.path === file.path ? null : file)}
                onResolveFile={(strategy) => resolveFile(file.path, strategy)}
                onSelectHunk={(hunk) => {
                  setSelectedHunk(hunk);
                  setEditContent(hunk.current + '\n' + hunk.incoming);
                }}
                disabled={isLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hunk Resolution Modal */}
      <AnimatePresence>
        {selectedHunk && selectedFile && (
          <HunkResolutionModal
            file={selectedFile.path}
            hunk={selectedHunk}
            isMobile={isMobile}
            isEditing={isEditing}
            editContent={editContent}
            onEditContentChange={setEditContent}
            onStartEditing={() => setIsEditing(true)}
            onResolve={(resolution, content) =>
              resolveHunk(selectedFile.path, selectedHunk.id, resolution, content)
            }
            onClose={() => { setSelectedHunk(null); setIsEditing(false); }}
            disabled={isLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConflictFileCard({
  file,
  isMobile,
  isSelected,
  onSelect,
  onResolveFile,
  onSelectHunk,
  disabled,
}: {
  file: ConflictFile;
  isMobile: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onResolveFile: (strategy: 'ours' | 'theirs') => void;
  onSelectHunk: (hunk: ConflictHunk) => void;
  disabled: boolean;
}) {
  return (
    <motion.div layout className="rounded-xl bg-muted border overflow-hidden">
      <button onClick={onSelect} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{file.path}</div>
          <div className="text-xs text-muted-foreground">
            {file.hunks.length} {file.hunks.length === 1 ? 'conflict' : 'conflicts'}
          </div>
        </div>
        <motion.div animate={{ rotate: isSelected ? 180 : 0 }} className="text-muted-foreground">
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 px-4 py-2 border-t">
              <Button variant="outline" size="sm" className="flex-1 text-blue-500" onClick={() => onResolveFile('ours')} disabled={disabled}>
                Accept All Current
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-purple-500" onClick={() => onResolveFile('theirs')} disabled={disabled}>
                Accept All Incoming
              </Button>
            </div>

            <div className="px-4 pb-4 space-y-2">
              {file.hunks.map((hunk) => (
                <button
                  key={hunk.id}
                  onClick={() => onSelectHunk(hunk)}
                  className="w-full p-3 rounded-lg bg-background border text-left hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Lines {hunk.startLine} - {hunk.endLine}</span>
                    <span className="text-xs text-red-500">Conflict #{hunk.id + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
                      <div className="text-[10px] text-blue-500 mb-1">Current</div>
                      <pre className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{hunk.current || '(empty)'}</pre>
                    </div>
                    <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
                      <div className="text-[10px] text-purple-500 mb-1">Incoming</div>
                      <pre className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{hunk.incoming || '(empty)'}</pre>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HunkResolutionModal({
  file,
  hunk,
  isMobile,
  isEditing,
  editContent,
  onEditContentChange,
  onStartEditing,
  onResolve,
  onClose,
  disabled,
}: {
  file: string;
  hunk: ConflictHunk;
  isMobile: boolean;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onStartEditing: () => void;
  onResolve: (resolution: 'current' | 'incoming' | 'both' | 'manual', content?: string) => void;
  onClose: () => void;
  disabled: boolean;
}) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<'current' | 'base' | 'incoming'>('current');

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeTab === 'current') setActiveTab(hunk.base ? 'base' : 'incoming');
      else if (activeTab === 'base') setActiveTab('incoming');
    },
    onSwipedRight: () => {
      if (activeTab === 'incoming') setActiveTab(hunk.base ? 'base' : 'current');
      else if (activeTab === 'base') setActiveTab('current');
    },
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex items-center gap-3 h-14 px-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{file}</div>
          <div className="text-xs text-muted-foreground">Lines {hunk.startLine} - {hunk.endLine}</div>
        </div>
      </header>

      {isMobile && !isEditing && (
        <div className="flex border-b">
          {(['current', ...(hunk.base ? ['base'] : []), 'incoming'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? tab === 'current' ? 'text-blue-500 border-b-2 border-blue-500'
                  : tab === 'incoming' ? 'text-purple-500 border-b-2 border-purple-500'
                  : 'text-muted-foreground border-b-2 border-muted-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {tab === 'current' ? t('git.conflict.current') : tab === 'incoming' ? t('git.conflict.incoming') : t('git.conflict.base')}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto" {...(isMobile ? handlers : {})}>
        {isEditing ? (
          <div className="h-full p-4">
            <textarea
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              className="w-full h-full p-4 rounded-xl bg-muted border font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter your resolution..."
            />
          </div>
        ) : isMobile ? (
          <div className="p-4">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CodeBlock
                  content={activeTab === 'current' ? hunk.current : activeTab === 'incoming' ? hunk.incoming : hunk.base || ''}
                  variant={activeTab}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-4 h-full">
            <div className="flex flex-col">
              <div className="text-sm font-medium text-blue-500 mb-2">{t('git.conflict.current')}</div>
              <CodeBlock content={hunk.current} variant="current" className="flex-1" />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-purple-500 mb-2">{t('git.conflict.incoming')}</div>
              <CodeBlock content={hunk.incoming} variant="incoming" className="flex-1" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t space-y-2 shrink-0">
        {isEditing ? (
          <Button className="w-full" onClick={() => onResolve('manual', editContent)} disabled={disabled}>
            Save Resolution
          </Button>
        ) : (
          <>
            <div className="flex gap-2">
              <Button className="flex-1 bg-blue-500 hover:bg-blue-600" onClick={() => onResolve('current')} disabled={disabled}>
                {t('git.conflict.acceptCurrent')}
              </Button>
              <Button className="flex-1 bg-purple-500 hover:bg-purple-600" onClick={() => onResolve('incoming')} disabled={disabled}>
                {t('git.conflict.acceptIncoming')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onResolve('both')} disabled={disabled}>
                {t('git.conflict.acceptBoth')}
              </Button>
              <Button variant="outline" className="flex-1" onClick={onStartEditing} disabled={disabled}>
                {t('git.conflict.edit')}
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function CodeBlock({ content, variant, className = '' }: { content: string; variant: 'current' | 'base' | 'incoming'; className?: string }) {
  const bgColor = variant === 'current' ? 'bg-blue-500/5' : variant === 'incoming' ? 'bg-purple-500/5' : 'bg-muted';
  const borderColor = variant === 'current' ? 'border-blue-500/20' : variant === 'incoming' ? 'border-purple-500/20' : 'border-border';

  return (
    <pre className={`p-4 rounded-xl ${bgColor} border ${borderColor} overflow-auto font-mono text-sm whitespace-pre-wrap ${className}`}>
      {content || '(empty)'}
    </pre>
  );
}
