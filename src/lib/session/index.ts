/**
 * Session Management Module
 *
 * Unified session management for RepoTutor AI modes:
 * - Claude Code (full agent SDK)
 * - DeepAgents (LangGraph)
 *
 * Design Patterns:
 * - Strategy: AISessionStrategy for different backends
 * - Factory: SessionManager creates appropriate strategies
 * - Observer: Stream events for real-time UI updates
 */

export * from './types';
export * from './storage';
export * from './manager';
export * from './claude-strategy';
export * from './langgraph-strategy';
