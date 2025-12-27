/**
 * Giz Code AI Agent
 *
 * Uses LangGraph's ReAct agent for intelligent code exploration and Q&A
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { repoTools } from './tools';
import { getRepoConfig } from '@/lib/repo-config';

const SYSTEM_PROMPT = `You are Giz Code AI, an expert at exploring and explaining code repositories.

## Your Role
You help developers understand codebases by:
- Explaining project structure and architecture
- Finding relevant files and code
- Answering questions about how code works
- Providing insights about patterns and best practices used

## Guidelines
- Always respond in Korean (한국어)
- Be concise but thorough
- When referencing files, include the path
- Use code blocks for code examples
- If unsure, say so rather than guessing
- Start by exploring the project structure if you haven't already

## Available Tools
You have access to tools that let you:
- read_repo_file: Read file content
- list_directory: List directory contents
- find_files: Search files by name
- search_code: Search text/code patterns
- get_project_overview: Get project overview

Use these tools to gather information before answering questions.
`;

// Create the agent with appropriate model
function createRepoAgent() {
  const config = getRepoConfig();

  // Determine which model to use based on available API keys
  let model;

  if (process.env.ANTHROPIC_API_KEY) {
    model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0.3,
    });
  } else if (process.env.OPENAI_API_KEY) {
    model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.3,
    });
  } else {
    throw new Error('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
  }

  const systemPrompt = SYSTEM_PROMPT + `\n\n## Current Repository\nName: ${config.name}\nDescription: ${config.description || 'No description'}`;

  const agent = createReactAgent({
    llm: model,
    tools: repoTools,
    messageModifier: systemPrompt,
  });

  return agent;
}

// Singleton agent instance
let agentInstance: ReturnType<typeof createReactAgent> | null = null;

export function getAgent() {
  if (!agentInstance) {
    agentInstance = createRepoAgent();
  }
  return agentInstance;
}
