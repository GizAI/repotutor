'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { DiffViewer } from '@/components/ui/DiffViewer';

interface GitStatus {
  branch: string;
  hasCommits: boolean;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

interface RemoteStatus {
  hasRemote: boolean;
  remoteName?: string;
  hasUpstream?: boolean;
  ahead?: number;
  behind?: number;
  isUpToDate?: boolean;
}

interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface GitPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'changes' | 'branches' | 'history';

export function GitPanel({ isOpen, onClose }: GitPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('changes');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<{ file: string; diff: string } | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  // Fetch git status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/git/status');
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setStatus(data);
      setCurrentBranch(data.branch);
      setError(null);
    } catch (err) {
      setError('Failed to get git status');
    }
  }, []);

  // Fetch remote status
  const fetchRemoteStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/git/remote-status');
      const data = await response.json();
      setRemoteStatus(data);
    } catch (err) {
      // Ignore remote status errors
    }
  }, []);

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch('/api/git/branches');
      const data = await response.json();
      setBranches(data.branches || []);
    } catch (err) {
      // Ignore
    }
  }, []);

  // Fetch commits
  const fetchCommits = useCallback(async () => {
    try {
      const response = await fetch('/api/git/commits?limit=20');
      const data = await response.json();
      setCommits(data.commits || []);
    } catch (err) {
      // Ignore
    }
  }, []);

  // Fetch diff for a file
  const fetchDiff = useCallback(async (file: string) => {
    try {
      const response = await fetch(`/api/git/diff?file=${encodeURIComponent(file)}`);
      const data = await response.json();
      setSelectedDiff({ file, diff: data.diff || '' });
    } catch (err) {
      setSelectedDiff({ file, diff: 'Failed to get diff' });
    }
  }, []);

  // Load data when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchRemoteStatus();
      fetchBranches();
      fetchCommits();
    }
  }, [isOpen, fetchStatus, fetchRemoteStatus, fetchBranches, fetchCommits]);

  // Toggle file selection
  const toggleFile = (file: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(file)) {
      newSelected.delete(file);
    } else {
      newSelected.add(file);
    }
    setSelectedFiles(newSelected);
  };

  // Select all files
  const selectAll = () => {
    if (!status) return;
    const allFiles = [...status.modified, ...status.added, ...status.deleted, ...status.untracked];
    setSelectedFiles(new Set(allFiles));
  };

  // Commit changes
  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMessage,
          files: selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCommitMessage('');
        setSelectedFiles(new Set());
        fetchStatus();
        fetchCommits();
      }
    } catch (err) {
      setError('Failed to commit');
    } finally {
      setIsLoading(false);
    }
  };

  // Push to remote
  const handlePush = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/push', { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchRemoteStatus();
      }
    } catch (err) {
      setError('Failed to push');
    } finally {
      setIsLoading(false);
    }
  };

  // Pull from remote
  const handlePull = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/pull', { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchStatus();
        fetchRemoteStatus();
        fetchCommits();
      }
    } catch (err) {
      setError('Failed to pull');
    } finally {
      setIsLoading(false);
    }
  };

  // Checkout branch
  const handleCheckout = async (branch: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCurrentBranch(branch);
        fetchStatus();
        fetchRemoteStatus();
      }
    } catch (err) {
      setError('Failed to checkout branch');
    } finally {
      setIsLoading(false);
    }
  };

  // Create new branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/git/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: newBranchName }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNewBranchName('');
        setShowNewBranch(false);
        setCurrentBranch(newBranchName);
        fetchBranches();
      }
    } catch (err) {
      setError('Failed to create branch');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate AI commit message
  const generateAICommitMessage = async () => {
    setIsGeneratingMessage(true);
    try {
      const response = await fetch('/api/git/ai-commit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else if (data.message) {
        setCommitMessage(data.message);
      }
    } catch (err) {
      setError('Failed to generate commit message');
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  // Discard changes
  const handleDiscard = async (file: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        fetchStatus();
        setSelectedDiff(null);
      }
    } catch (err) {
      setError('Failed to discard changes');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const allFiles = status ? [...status.modified, ...status.added, ...status.deleted, ...status.untracked] : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:h-screen sm:w-[480px] z-[90] flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-default)]"
      >
        {/* Header */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-[var(--border-default)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500">
            <Icon name="code" className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)]">Git</div>
            <div className="text-xs text-[var(--text-tertiary)]">{currentBranch || 'No branch'}</div>
          </div>

          {/* Remote Status */}
          {remoteStatus?.hasRemote && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              {remoteStatus.ahead !== undefined && remoteStatus.ahead > 0 && (
                <span className="text-emerald-500">↑{remoteStatus.ahead}</span>
              )}
              {remoteStatus.behind !== undefined && remoteStatus.behind > 0 && (
                <span className="text-amber-500">↓{remoteStatus.behind}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePull}
              disabled={isLoading || !remoteStatus?.hasRemote}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
              title="Pull"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              onClick={handlePush}
              disabled={isLoading || !remoteStatus?.hasRemote}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
              title="Push"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={() => { fetchStatus(); fetchRemoteStatus(); fetchBranches(); fetchCommits(); }}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
          >
            <Icon name="close" className="w-5 h-5" />
          </button>
        </header>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-500 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-default)]">
          {(['changes', 'branches', 'history'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'changes' && allFiles.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[10px]">
                  {allFiles.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'changes' && (
            <div className="p-4 space-y-4">
              {/* File List */}
              {allFiles.length === 0 ? (
                <div className="text-center text-[var(--text-tertiary)] py-8">
                  No changes
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)]">{allFiles.length} changed files</span>
                    <button onClick={selectAll} className="text-xs text-[var(--accent)]">
                      Select All
                    </button>
                  </div>

                  <div className="space-y-1">
                    {status?.modified.map((file) => (
                      <FileItem
                        key={file}
                        file={file}
                        type="modified"
                        selected={selectedFiles.has(file)}
                        onToggle={() => toggleFile(file)}
                        onViewDiff={() => fetchDiff(file)}
                        onDiscard={() => handleDiscard(file)}
                      />
                    ))}
                    {status?.added.map((file) => (
                      <FileItem
                        key={file}
                        file={file}
                        type="added"
                        selected={selectedFiles.has(file)}
                        onToggle={() => toggleFile(file)}
                        onViewDiff={() => fetchDiff(file)}
                        onDiscard={() => handleDiscard(file)}
                      />
                    ))}
                    {status?.deleted.map((file) => (
                      <FileItem
                        key={file}
                        file={file}
                        type="deleted"
                        selected={selectedFiles.has(file)}
                        onToggle={() => toggleFile(file)}
                        onViewDiff={() => fetchDiff(file)}
                        onDiscard={() => handleDiscard(file)}
                      />
                    ))}
                    {status?.untracked.map((file) => (
                      <FileItem
                        key={file}
                        file={file}
                        type="untracked"
                        selected={selectedFiles.has(file)}
                        onToggle={() => toggleFile(file)}
                        onViewDiff={() => fetchDiff(file)}
                        onDiscard={() => {}}
                      />
                    ))}
                  </div>

                  {/* Diff Preview */}
                  {selectedDiff && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{selectedDiff.file}</span>
                        <button
                          onClick={() => setSelectedDiff(null)}
                          className="text-xs text-[var(--text-tertiary)]"
                        >
                          Close
                        </button>
                      </div>
                      <DiffViewer diff={selectedDiff.diff} />
                    </div>
                  )}

                  {/* Commit Form */}
                  <div className="pt-4 border-t border-[var(--border-default)]">
                    <div className="relative">
                      <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Commit message..."
                        rows={3}
                        className="w-full p-3 pr-12 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                      />
                      {/* AI Generate Button */}
                      <button
                        onClick={generateAICommitMessage}
                        disabled={isGeneratingMessage || allFiles.length === 0}
                        className="absolute top-2 right-2 p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] disabled:opacity-50 transition-colors"
                        title="Generate commit message with AI"
                      >
                        {isGeneratingMessage ? (
                          <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={handleCommit}
                      disabled={isLoading || !commitMessage.trim()}
                      className="mt-2 w-full py-2 px-4 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
                    >
                      {isLoading
                        ? 'Committing...'
                        : !status?.hasCommits
                          ? 'Create Initial Commit'
                          : `Commit ${selectedFiles.size > 0 ? `(${selectedFiles.size} files)` : '(All)'}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="p-4 space-y-4">
              {/* New Branch */}
              {showNewBranch ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="New branch name..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm"
                  />
                  <button
                    onClick={handleCreateBranch}
                    disabled={isLoading || !newBranchName.trim()}
                    className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewBranch(false)}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewBranch(true)}
                  className="w-full py-2 px-4 rounded-lg border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  + New Branch
                </button>
              )}

              {/* Branch List */}
              <div className="space-y-1">
                {branches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => handleCheckout(branch)}
                    disabled={isLoading || branch === currentBranch}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      branch === currentBranch
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    {branch === currentBranch && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                    <span className={branch !== currentBranch ? 'ml-6' : ''}>{branch}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-4 space-y-2">
              {commits.length === 0 ? (
                <div className="text-center text-[var(--text-tertiary)] py-8">
                  No commits yet
                </div>
              ) : (
                commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-mono text-xs text-[var(--accent)]">{commit.hash.slice(0, 7)}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{commit.date}</div>
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-primary)]">{commit.message}</div>
                    <div className="mt-1 text-xs text-[var(--text-tertiary)]">{commit.author}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// File Item Component
function FileItem({
  file,
  type,
  selected,
  onToggle,
  onViewDiff,
  onDiscard,
}: {
  file: string;
  type: 'modified' | 'added' | 'deleted' | 'untracked';
  selected: boolean;
  onToggle: () => void;
  onViewDiff: () => void;
  onDiscard: () => void;
}) {
  const typeColors = {
    modified: 'text-amber-500',
    added: 'text-emerald-500',
    deleted: 'text-red-500',
    untracked: 'text-blue-500',
  };

  const typeLabels = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    untracked: 'U',
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] group">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 rounded border-[var(--border-default)]"
      />
      <span className={`w-4 text-xs font-mono ${typeColors[type]}`}>{typeLabels[type]}</span>
      <button
        onClick={onViewDiff}
        className="flex-1 text-left text-sm text-[var(--text-primary)] truncate hover:underline"
      >
        {file}
      </button>
      {type !== 'untracked' && (
        <button
          onClick={onDiscard}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500"
          title="Discard changes"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
