/**
 * knownTools - Tool-specific rendering configuration
 * Inspired by Happy project's knownTools.tsx
 */

import { ToolCall } from '../types';

// Tool configuration type
export interface KnownToolConfig {
  // Display name or dynamic title function
  title?: string | ((tool: ToolCall) => string);
  // Icon name (lucide-react)
  icon: string;
  // Whether to show minimal (collapsed) view by default
  minimal?: boolean | ((tool: ToolCall) => boolean);
  // Whether tool can modify files
  isMutable?: boolean;
  // Hide default error display
  hideDefaultError?: boolean;
  // Extract subtitle/description from input
  extractSubtitle?: (tool: ToolCall) => string | null;
  // Extract preview text from input
  extractPreview?: (tool: ToolCall) => string | null;
}

// Parse JSON input safely
function parseInput<T>(input?: string): T | null {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

// Extract filename from path
function basename(path: string): string {
  return path.split('/').pop() || path;
}

// Truncate string
function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

export const knownTools: Record<string, KnownToolConfig> = {
  // File Operations
  Read: {
    title: (tool) => {
      const input = parseInput<{ file_path?: string }>(tool.input);
      return input?.file_path ? basename(input.file_path) : 'Read File';
    },
    icon: 'Eye',
    minimal: true,
    extractPreview: (tool) => {
      const input = parseInput<{ file_path?: string }>(tool.input);
      return input?.file_path || null;
    },
  },

  Write: {
    title: (tool) => {
      const input = parseInput<{ file_path?: string }>(tool.input);
      return input?.file_path ? basename(input.file_path) : 'Write File';
    },
    icon: 'FilePlus',
    isMutable: true,
    extractPreview: (tool) => {
      const input = parseInput<{ file_path?: string }>(tool.input);
      return input?.file_path || null;
    },
  },

  Edit: {
    title: (tool) => {
      const input = parseInput<{ file_path?: string }>(tool.input);
      return input?.file_path ? basename(input.file_path) : 'Edit File';
    },
    icon: 'FileDiff',
    isMutable: true,
    minimal: false, // Show diff view
    extractPreview: (tool) => {
      const input = parseInput<{ file_path?: string }>(tool.input);
      return input?.file_path || null;
    },
  },

  MultiEdit: {
    title: (tool) => {
      const input = parseInput<{ file_path?: string; edits?: unknown[] }>(tool.input);
      if (input?.file_path && input?.edits) {
        return `${basename(input.file_path)} (${input.edits.length} edits)`;
      }
      return input?.file_path ? basename(input.file_path) : 'Multi Edit';
    },
    icon: 'FileEdit',
    isMutable: true,
    minimal: false,
  },

  // Terminal
  Bash: {
    title: (tool) => {
      const input = parseInput<{ description?: string; command?: string }>(tool.input);
      if (input?.description) return input.description;
      if (input?.command) {
        const cmd = input.command.split(' ')[0];
        return `$ ${cmd}`;
      }
      return 'Terminal';
    },
    icon: 'Terminal',
    isMutable: true,
    hideDefaultError: true,
    extractSubtitle: (tool) => {
      const input = parseInput<{ command?: string }>(tool.input);
      return input?.command ? truncate(input.command, 80) : null;
    },
  },

  // Search
  Glob: {
    title: (tool) => {
      const input = parseInput<{ pattern?: string }>(tool.input);
      return input?.pattern || 'Search Files';
    },
    icon: 'Search',
    minimal: true,
    extractPreview: (tool) => {
      const input = parseInput<{ pattern?: string; path?: string }>(tool.input);
      return input?.path || null;
    },
  },

  Grep: {
    title: (tool) => {
      const input = parseInput<{ pattern?: string }>(tool.input);
      return input?.pattern ? `grep: ${truncate(input.pattern, 30)}` : 'Search Content';
    },
    icon: 'FileSearch',
    minimal: true,
    extractPreview: (tool) => {
      const input = parseInput<{ path?: string }>(tool.input);
      return input?.path || null;
    },
  },

  LS: {
    title: (tool) => {
      const input = parseInput<{ path?: string }>(tool.input);
      return input?.path ? basename(input.path) : 'List Files';
    },
    icon: 'FolderOpen',
    minimal: true,
  },

  // Web
  WebFetch: {
    title: (tool) => {
      const input = parseInput<{ url?: string }>(tool.input);
      if (input?.url) {
        try {
          return new URL(input.url).hostname;
        } catch { /* ignore */ }
      }
      return 'Fetch URL';
    },
    icon: 'Globe',
    minimal: true,
    extractPreview: (tool) => {
      const input = parseInput<{ url?: string }>(tool.input);
      return input?.url || null;
    },
  },

  WebSearch: {
    title: (tool) => {
      const input = parseInput<{ query?: string }>(tool.input);
      return input?.query ? truncate(input.query, 40) : 'Web Search';
    },
    icon: 'Search',
    minimal: true,
  },

  // Agent
  Task: {
    title: (tool) => {
      const input = parseInput<{ description?: string }>(tool.input);
      return input?.description || 'Sub-Task';
    },
    icon: 'Rocket',
    isMutable: true,
    minimal: (tool) => {
      // Show expanded if running or has sub-tasks
      return tool.status !== 'running';
    },
    extractSubtitle: (tool) => {
      const input = parseInput<{ subagent_type?: string }>(tool.input);
      return input?.subagent_type || null;
    },
  },

  // Planning
  TodoWrite: {
    title: 'Todo List',
    icon: 'ListTodo',
    minimal: (tool) => {
      const input = parseInput<{ todos?: unknown[] }>(tool.input);
      return !input?.todos || input.todos.length === 0;
    },
  },

  ExitPlanMode: {
    title: 'Plan Proposal',
    icon: 'FileText',
    isMutable: false,
  },

  // Notebook
  NotebookRead: {
    title: (tool) => {
      const input = parseInput<{ notebook_path?: string }>(tool.input);
      return input?.notebook_path ? basename(input.notebook_path) : 'Read Notebook';
    },
    icon: 'BookOpen',
    minimal: true,
  },

  NotebookEdit: {
    title: (tool) => {
      const input = parseInput<{ notebook_path?: string }>(tool.input);
      return input?.notebook_path ? basename(input.notebook_path) : 'Edit Notebook';
    },
    icon: 'BookOpen',
    isMutable: true,
  },

  // LSP
  LSP: {
    title: (tool) => {
      const input = parseInput<{ operation?: string }>(tool.input);
      return input?.operation || 'LSP';
    },
    icon: 'Code',
    minimal: true,
  },

  // Misc
  AskUserQuestion: {
    title: 'Question',
    icon: 'MessageSquare',
    minimal: false,
  },

  EnterPlanMode: {
    title: 'Enter Plan Mode',
    icon: 'Map',
  },

  Skill: {
    title: (tool) => {
      const input = parseInput<{ skill?: string }>(tool.input);
      return input?.skill ? `/${input.skill}` : 'Skill';
    },
    icon: 'Zap',
  },

  KillShell: {
    title: 'Kill Shell',
    icon: 'XCircle',
    isMutable: true,
  },
};

// Get tool config with fallback
export function getToolConfig(toolName: string): KnownToolConfig {
  // Handle MCP tools
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.replace('mcp__', '').split('__');
    const serverName = parts[0] || 'mcp';
    const toolFn = parts[1] || '';
    return {
      title: `${serverName}:${toolFn}`,
      icon: 'Puzzle',
      minimal: true,
    };
  }

  return knownTools[toolName] || {
    title: toolName,
    icon: 'Wrench',
    minimal: true,
  };
}

// Get tool title
export function getToolTitle(tool: ToolCall): string {
  const config = getToolConfig(tool.name);
  if (typeof config.title === 'function') {
    return config.title(tool);
  }
  return config.title || tool.name;
}

// Check if tool should be minimal
export function isToolMinimal(tool: ToolCall): boolean {
  const config = getToolConfig(tool.name);
  if (typeof config.minimal === 'function') {
    return config.minimal(tool);
  }
  return config.minimal ?? true;
}

// Check if tool is mutable
export function isToolMutable(toolName: string): boolean {
  const config = getToolConfig(toolName);
  // Unknown tools are assumed mutable for safety
  return config.isMutable ?? !knownTools[toolName];
}
