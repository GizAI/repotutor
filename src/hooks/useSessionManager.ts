'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface SessionSummary {
  id: string;
  mode: 'claude-code';
  title: string;
  preview: string;
  messageCount: number;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

interface SessionDetail {
  id: string;
  mode: 'claude-code';
  title: string;
  messages: Message[];
  metadata: {
    cwd?: string;
    gitBranch?: string;
    model?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function useSessionManager() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track current session ID for resume
  const currentSessionIdRef = useRef<string | null>(null);

  // Fetch sessions from API (cookie auth handled automatically by middleware)
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sessions?limit=30', {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Select and load a session
  const selectSession = useCallback(async (id: string): Promise<SessionDetail | null> => {
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${id}`, {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('Failed to load session');
      }

      const data = await response.json();
      const session = data.session as SessionDetail;

      currentSessionIdRef.current = id;
      setCurrentSession(session);

      return session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      return null;
    }
  }, []);

  // Clear current session (for new chat)
  const clearCurrent = useCallback(() => {
    currentSessionIdRef.current = null;
    setCurrentSession(null);
  }, []);

  // Get resume ID for Claude API
  const getResumeId = useCallback((): string | undefined => {
    return currentSessionIdRef.current || undefined;
  }, []);

  // Set current session ID (after creating new session via chat)
  const setCurrentSessionId = useCallback((id: string) => {
    currentSessionIdRef.current = id;
  }, []);

  // Refresh sessions list
  const refresh = useCallback(() => {
    return fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    currentSession,
    isLoading,
    error,
    selectSession,
    clearCurrent,
    getResumeId,
    setCurrentSessionId,
    refresh,
  };
}
