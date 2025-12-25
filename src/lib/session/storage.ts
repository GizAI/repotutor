/**
 * Session Storage
 *
 * Unified storage layer for both AI modes.
 * Uses localStorage for persistence with graceful degradation.
 */

import type { SessionState, SessionSummary, AIMode, Message } from './types';

const STORAGE_KEY = 'repotutor_sessions';
const MAX_SESSIONS = 50;

export class SessionStorage {
  private cache = new Map<string, SessionState>();

  // Generate unique session ID
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Create new session
  create(mode: AIMode, title?: string): SessionState {
    const id = this.generateId();
    const now = new Date();

    const session: SessionState = {
      id,
      mode,
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    this.cache.set(id, session);
    this.persist();

    return session;
  }

  // Get session by ID
  get(id: string): SessionState | undefined {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    this.loadFromStorage();
    return this.cache.get(id);
  }

  // Update session
  update(id: string, updates: Partial<SessionState>): SessionState | undefined {
    const session = this.get(id);
    if (!session) return undefined;

    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    this.cache.set(id, updated);
    this.persist();

    return updated;
  }

  // Add message to session
  addMessage(sessionId: string, message: Message): SessionState | undefined {
    const session = this.get(sessionId);
    if (!session) return undefined;

    session.messages.push(message);
    session.updatedAt = new Date();

    this.cache.set(sessionId, session);
    this.persist();

    return session;
  }

  // Delete session
  delete(id: string): boolean {
    const deleted = this.cache.delete(id);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  // List all sessions
  list(mode?: AIMode): SessionSummary[] {
    this.loadFromStorage();

    const sessions = Array.from(this.cache.values())
      .filter((s) => !mode || s.mode === mode)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((s) => this.toSummary(s));

    return sessions;
  }

  // Get recent sessions
  recent(limit = 10): SessionSummary[] {
    return this.list().slice(0, limit);
  }

  // Convert to summary (lightweight)
  private toSummary(session: SessionState): SessionSummary {
    const firstUserMsg = session.messages.find((m) => m.role === 'user');
    const lastMsg = session.messages[session.messages.length - 1];

    return {
      id: session.id,
      mode: session.mode,
      title: this.extractTitle(firstUserMsg?.content || '새 대화'),
      preview: lastMsg?.content.slice(0, 100) || '',
      messageCount: session.messages.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  // Extract title from message
  private extractTitle(content: string): string {
    const cleaned = content.replace(/\n/g, ' ').trim();
    return cleaned.length > 40 ? cleaned.slice(0, 40) + '...' : cleaned;
  }

  // Persist to localStorage
  private persist(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, MAX_SESSIONS);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist sessions:', e);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return;

      const entries: [string, SessionState][] = JSON.parse(data);
      entries.forEach(([id, session]) => {
        // Restore Date objects
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        session.messages.forEach((m) => {
          m.timestamp = new Date(m.timestamp);
        });
        this.cache.set(id, session);
      });
    } catch (e) {
      console.warn('Failed to load sessions:', e);
    }
  }

  // Clear all sessions
  clear(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Fork session (create copy with new ID)
  fork(sourceId: string): SessionState | undefined {
    const source = this.get(sourceId);
    if (!source) return undefined;

    const forked = this.create(source.mode);
    forked.messages = [...source.messages];
    forked.metadata = { ...source.metadata };

    this.cache.set(forked.id, forked);
    this.persist();

    return forked;
  }
}

// Singleton instance
export const sessionStorage = new SessionStorage();
