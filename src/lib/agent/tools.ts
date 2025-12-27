/**
 * Giz Code Agent Tools
 *
 * Custom tools for the deep agent to explore and understand the codebase
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { toAbsolutePath, isInsideRepo, isExcluded, getRepoConfig } from '@/lib/repo-config';

// Read file content
export const readRepoFile = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      const absolutePath = toAbsolutePath(filePath);

      if (!isInsideRepo(absolutePath)) {
        return `Error: Path is outside repository: ${filePath}`;
      }

      if (!fs.existsSync(absolutePath)) {
        return `Error: File not found: ${filePath}`;
      }

      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) {
        return `Error: Not a file: ${filePath}`;
      }

      if (stat.size > 100 * 1024) {
        return `Error: File too large (${(stat.size / 1024).toFixed(1)}KB). Maximum is 100KB.`;
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      return `File: ${filePath}\n\n${content}`;
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: 'read_repo_file',
    description: 'Read the content of a file in the repository. Use this to understand code, configuration, or documentation.',
    schema: z.object({
      filePath: z.string().describe('The relative path to the file from the repository root'),
    }),
  }
);

// List directory contents
export const listDirectory = tool(
  async ({ dirPath = '' }: { dirPath?: string }) => {
    try {
      const absolutePath = toAbsolutePath(dirPath);

      if (!isInsideRepo(absolutePath)) {
        return `Error: Path is outside repository: ${dirPath}`;
      }

      if (!fs.existsSync(absolutePath)) {
        return `Error: Directory not found: ${dirPath}`;
      }

      const stat = fs.statSync(absolutePath);
      if (!stat.isDirectory()) {
        return `Error: Not a directory: ${dirPath}`;
      }

      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
      const result: string[] = [`Directory: ${dirPath || '/'}\n`];

      for (const entry of entries) {
        const entryPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

        if (isExcluded(entryPath)) continue;

        const type = entry.isDirectory() ? '📁' : '📄';
        result.push(`${type} ${entry.name}`);
      }

      return result.join('\n');
    } catch (error) {
      return `Error listing directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a given path. Use this to explore the project structure.',
    schema: z.object({
      dirPath: z.string().optional().default('').describe('The relative path to the directory (empty for root)'),
    }),
  }
);

// Search for files by name pattern
export const findFiles = tool(
  async ({ pattern, directory = '' }: { pattern: string; directory?: string }) => {
    try {
      const basePath = toAbsolutePath(directory);

      if (!isInsideRepo(basePath)) {
        return `Error: Path is outside repository: ${directory}`;
      }

      const results: string[] = [];
      const patternLower = pattern.toLowerCase();

      function walkDir(dir: string, relativePath: string) {
        if (results.length >= 50) return;

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (results.length >= 50) break;

            const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            if (isExcluded(entryRelativePath)) continue;

            if (entry.name.toLowerCase().includes(patternLower)) {
              const type = entry.isDirectory() ? '📁' : '📄';
              results.push(`${type} ${entryRelativePath}`);
            }

            if (entry.isDirectory()) {
              walkDir(path.join(dir, entry.name), entryRelativePath);
            }
          }
        } catch {
          // Ignore errors
        }
      }

      walkDir(basePath, directory);

      if (results.length === 0) {
        return `No files found matching pattern: ${pattern}`;
      }

      return `Found ${results.length} files matching "${pattern}":\n\n${results.join('\n')}`;
    } catch (error) {
      return `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: 'find_files',
    description: 'Search for files by name pattern. Returns up to 50 matching files.',
    schema: z.object({
      pattern: z.string().describe('The pattern to search for in file names'),
      directory: z.string().optional().default('').describe('The directory to search in (empty for entire repo)'),
    }),
  }
);

// Search for text in files
export const searchCode = tool(
  async ({ query, filePattern, maxResults = 20 }: { query: string; filePattern?: string; maxResults?: number }) => {
    try {
      const basePath = toAbsolutePath('');
      const results: { path: string; line: number; content: string }[] = [];
      const queryLower = query.toLowerCase();
      const limit = Math.min(maxResults, 50);

      function walkDir(dir: string, relativePath: string) {
        if (results.length >= limit) return;

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (results.length >= limit) break;

            const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            const absoluteEntryPath = path.join(dir, entry.name);

            if (isExcluded(entryRelativePath)) continue;

            if (entry.isDirectory()) {
              walkDir(absoluteEntryPath, entryRelativePath);
            } else if (entry.isFile()) {
              // Check file pattern if provided
              if (filePattern && !entry.name.includes(filePattern)) continue;

              // Skip binary files
              const ext = path.extname(entry.name).toLowerCase();
              const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.woff', '.woff2', '.ttf'];
              if (binaryExts.includes(ext)) continue;

              try {
                const stat = fs.statSync(absoluteEntryPath);
                if (stat.size > 100 * 1024) continue; // Skip large files

                const content = fs.readFileSync(absoluteEntryPath, 'utf-8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length && results.length < limit; i++) {
                  if (lines[i].toLowerCase().includes(queryLower)) {
                    results.push({
                      path: entryRelativePath,
                      line: i + 1,
                      content: lines[i].trim().slice(0, 100),
                    });
                  }
                }
              } catch {
                // Ignore file read errors
              }
            }
          }
        } catch {
          // Ignore directory read errors
        }
      }

      walkDir(basePath, '');

      if (results.length === 0) {
        return `No matches found for: ${query}`;
      }

      const output = results.map(r => `${r.path}:${r.line} - ${r.content}`).join('\n');
      return `Found ${results.length} matches for "${query}":\n\n${output}`;
    } catch (error) {
      return `Error searching code: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: 'search_code',
    description: 'Search for text/code patterns across all files in the repository.',
    schema: z.object({
      query: z.string().describe('The text or code pattern to search for'),
      filePattern: z.string().optional().describe('Optional file name pattern to filter (e.g., ".ts", "config")'),
      maxResults: z.number().optional().default(20).describe('Maximum number of results to return'),
    }),
  }
);

// Get project overview
export const getProjectOverview = tool(
  async () => {
    try {
      const config = getRepoConfig();
      const basePath = toAbsolutePath('');

      let overview = `# Project Overview: ${config.name}\n\n`;

      if (config.description) {
        overview += `${config.description}\n\n`;
      }

      // Try to read README
      const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
      for (const readmeFile of readmeFiles) {
        const readmePath = path.join(basePath, readmeFile);
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, 'utf-8');
          overview += `## From ${readmeFile}\n\n${content.slice(0, 3000)}\n\n`;
          break;
        }
      }

      // Try to read package.json
      const packagePath = path.join(basePath, 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        overview += `## Package Info\n\n`;
        overview += `- Name: ${packageJson.name || 'N/A'}\n`;
        overview += `- Version: ${packageJson.version || 'N/A'}\n`;
        overview += `- Description: ${packageJson.description || 'N/A'}\n`;

        if (packageJson.dependencies) {
          overview += `\n### Dependencies\n`;
          overview += Object.keys(packageJson.dependencies).slice(0, 20).join(', ');
          overview += '\n';
        }
      }

      // Directory structure (2 levels)
      overview += `\n## Directory Structure\n\n`;

      function getStructure(dir: string, relativePath: string, depth: number): string {
        if (depth > 1) return '';

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          let result = '';

          for (const entry of entries) {
            const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            if (isExcluded(entryPath)) continue;

            const indent = '  '.repeat(depth);
            const icon = entry.isDirectory() ? '📁' : '📄';
            result += `${indent}${icon} ${entry.name}\n`;

            if (entry.isDirectory()) {
              result += getStructure(path.join(dir, entry.name), entryPath, depth + 1);
            }
          }

          return result;
        } catch {
          return '';
        }
      }

      overview += getStructure(basePath, '', 0);

      return overview;
    } catch (error) {
      return `Error getting project overview: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: 'get_project_overview',
    description: 'Get a comprehensive overview of the project including README, package info, and directory structure.',
    schema: z.object({}),
  }
);

// All tools for the agent
export const repoTools = [
  readRepoFile,
  listDirectory,
  findFiles,
  searchCode,
  getProjectOverview,
];
