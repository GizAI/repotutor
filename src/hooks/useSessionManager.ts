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

// Password stored in sessionStorage for the browser session
const PASSWORD_KEY = 'repotutor_password';

export function useSessionManager() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current session ID for resume
  const currentSessionIdRef = useRef<string | null>(null);

  // Get stored password
  const getPassword = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PASSWORD_KEY);
  }, []);

  // Set password
  const setPassword = useCallback((password: string) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PASSWORD_KEY, password);
  }, []);

  // Auth headers
  const getAuthHeaders = useCallback(() => {
    const password = getPassword();
    if (!password) return {};
    return { Authorization: `Bearer ${password}` };
  }, [getPassword]);

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sessions?limit=30', {
        headers: getAuthHeaders(),
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Authenticate with password
  const authenticate = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/sessions?limit=1', {
        headers: { Authorization: `Bearer ${password}` },
      });

      if (response.ok) {
        setPassword(password);
        setIsAuthenticated(true);
        await fetchSessions();
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, [setPassword, fetchSessions]);

  // Select and load a session
  const selectSession = useCallback(async (id: string): Promise<SessionDetail | null> => {
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${id}`, {
        headers: getAuthHeaders(),
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
  }, [getAuthHeaders]);

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
    isAuthenticated,
    error,
    authenticate,
    selectSession,
    clearCurrent,
    getResumeId,
    setCurrentSessionId,
    refresh,
    getPassword,
  };
}
