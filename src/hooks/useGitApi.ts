'use client';

import { useState, useCallback } from 'react';

/**
 * Generic Git API hook - Single source of truth for all Git operations
 * Following Eric Gamma's "Program to interfaces" principle
 */

interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface UseApiResult<T> extends ApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

// Generic API hook factory
function useApi<T>(
  fetcher: (...args: unknown[]) => Promise<T>
): UseApiResult<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(async (...args: unknown[]) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const data = await fetcher(...args);
      setState({ data, isLoading: false, error: null });
      return data;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setState((s) => ({ ...s, isLoading: false, error }));
      return null;
    }
  }, [fetcher]);

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

// API Response types
export interface GitStatus {
  branch: string;
  hasCommits: boolean;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface RemoteStatus {
  hasRemote: boolean;
  remoteName?: string;
  ahead?: number;
  behind?: number;
}

export interface StashEntry {
  index: number;
  message: string;
  branch: string;
  date: string;
  files: number;
}

export interface CommitNode {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  email: string;
  date: string;
  relativeDate: string;
  branches: string[];
  tags: string[];
  isHead: boolean;
}

export interface ConflictHunk {
  id: number;
  startLine: number;
  endLine: number;
  current: string;
  incoming: string;
  base?: string;
}

export interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
}

// API fetchers - Pure functions
const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`/api/git/${path}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async post<T>(path: string, body?: object): Promise<T> {
    const res = await fetch(`/api/git/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async put<T>(path: string, body: object): Promise<T> {
    const res = await fetch(`/api/git/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },
};

// Composed hooks for specific operations
export function useGitStatus() {
  return useApi<GitStatus>(() => api.get('status'));
}

export function useRemoteStatus() {
  return useApi<RemoteStatus>(() => api.get('remote-status'));
}

export function useBranches() {
  return useApi<{ branches: string[] }>(() => api.get('branches'));
}

export function useStashes() {
  return useApi<{ stashes: StashEntry[] }>(() => api.get('stash'));
}

export function useCommitGraph(branch = '--all', limit = 50) {
  return useApi<{ commits: CommitNode[]; branches: string[]; currentBranch: string }>(
    () => api.get(`graph?branch=${encodeURIComponent(branch)}&limit=${limit}`)
  );
}

export function useConflicts() {
  return useApi<{ hasConflicts: boolean; files: ConflictFile[]; totalConflicts: number }>(
    () => api.get('conflicts')
  );
}

export function useDiff() {
  return useApi<{ diff: string }>(
    (file: unknown) => api.get(`diff?file=${encodeURIComponent(file as string)}`)
  );
}

// Mutation hooks
export function useGitMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async <T>(
    action: () => Promise<T>,
    onSuccess?: (data: T) => void
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await action();
      onSuccess?.(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error, clearError: () => setError(null) };
}

// Pre-built mutations
export const gitActions = {
  commit: (message: string, files?: string[]) =>
    api.post('commit', { message, files }),

  push: () => api.post('push'),
  pull: () => api.post('pull'),

  checkout: (branch: string) =>
    api.post('checkout', { branch }),

  createBranch: (branch: string) =>
    api.post('branches', { branch }),

  discard: (file: string) =>
    api.post('discard', { file }),

  stash: {
    create: (message?: string) =>
      api.post('stash', { action: 'create', message }),
    apply: (index: number) =>
      api.post('stash', { action: 'apply', index }),
    pop: (index: number) =>
      api.post('stash', { action: 'pop', index }),
    drop: (index: number) =>
      api.post('stash', { action: 'drop', index }),
    show: (index: number) =>
      api.post<{ diff: string }>('stash', { action: 'show', index }),
  },

  conflict: {
    resolve: (file: string, hunkId: number, resolution: string, content?: string) =>
      api.post('resolve-conflict', { file, hunkId, resolution, content }),
    resolveFile: (file: string, strategy: 'ours' | 'theirs') =>
      api.put('resolve-conflict', { file, strategy }),
  },

  generateCommitMessage: (files?: string[]) =>
    api.post<{ message: string }>('ai-commit-message', { files }),
};
