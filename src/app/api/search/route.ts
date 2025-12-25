import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRepoConfig, isExcluded, toAbsolutePath, isInsideRepo } from '@/lib/repo-config';

interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  excerpt?: string;
  line?: number;
  matchType: 'filename' | 'content';
  score: number;
}

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx', '.markdown',
  '.css', '.scss', '.html', '.yaml', '.yml', '.sql', '.sh', '.bash',
  '.py', '.go', '.rs', '.prisma', '.env', '.gitignore', '.toml', '.xml',
  '.txt', '.svg', '.graphql', '.dockerfile',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.tar', '.gz',
  '.mp3', '.mp4', '.wav', '.webm', '.exe', '.dll', '.so', '.dylib',
]);

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath).toLowerCase();

  // Special files without extension
  if (['dockerfile', 'makefile', 'readme', 'license', 'changelog'].includes(name)) {
    return true;
  }

  if (BINARY_EXTENSIONS.has(ext)) return false;
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Default to text for unknown extensions
  return !ext || ext.length <= 5;
}

function searchInContent(content: string, query: string, maxExcerpts = 3): { line: number; excerpt: string }[] {
  const results: { line: number; excerpt: string }[] = [];
  const lines = content.split('\n');
  const queryLower = query.toLowerCase();

  for (let i = 0; i < lines.length && results.length < maxExcerpts; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    if (lineLower.includes(queryLower)) {
      const start = Math.max(0, lineLower.indexOf(queryLower) - 30);
      const end = Math.min(line.length, lineLower.indexOf(queryLower) + query.length + 30);
      let excerpt = line.slice(start, end).trim();
      if (start > 0) excerpt = '...' + excerpt;
      if (end < line.length) excerpt = excerpt + '...';

      results.push({ line: i + 1, excerpt });
    }
  }

  return results;
}

function walkDirectory(
  dir: string,
  basePath: string,
  query: string,
  results: SearchResult[],
  maxResults = 50
): void {
  if (results.length >= maxResults) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const absolutePath = path.join(dir, entry.name);

      // Skip excluded paths
      if (isExcluded(relativePath)) continue;

      const nameLower = entry.name.toLowerCase();
      const queryLower = query.toLowerCase();

      if (entry.isDirectory()) {
        // Check if directory name matches
        if (nameLower.includes(queryLower)) {
          results.push({
            path: relativePath,
            name: entry.name,
            type: 'directory',
            matchType: 'filename',
            score: nameLower === queryLower ? 100 : nameLower.startsWith(queryLower) ? 80 : 60,
          });
        }

        // Recurse into directory
        walkDirectory(absolutePath, relativePath, query, results, maxResults);
      } else {
        // Check if filename matches
        if (nameLower.includes(queryLower)) {
          results.push({
            path: relativePath,
            name: entry.name,
            type: 'file',
            matchType: 'filename',
            score: nameLower === queryLower ? 100 : nameLower.startsWith(queryLower) ? 80 : 60,
          });
        }

        // Search in file content for text files
        if (isTextFile(entry.name)) {
          try {
            const stat = fs.statSync(absolutePath);
            // Skip large files (> 500KB)
            if (stat.size > 500 * 1024) continue;

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const contentMatches = searchInContent(content, query, 2);

            for (const match of contentMatches) {
              if (results.length >= maxResults) break;

              // Avoid duplicate if already added by filename match
              const existingIdx = results.findIndex(
                r => r.path === relativePath && r.matchType === 'filename'
              );

              if (existingIdx === -1) {
                results.push({
                  path: relativePath,
                  name: entry.name,
                  type: 'file',
                  excerpt: match.excerpt,
                  line: match.line,
                  matchType: 'content',
                  score: 40,
                });
              } else if (!results[existingIdx].excerpt) {
                // Add excerpt to existing filename match
                results[existingIdx].excerpt = match.excerpt;
                results[existingIdx].line = match.line;
              }
            }
          } catch {
            // Ignore file read errors
          }
        }
      }
    }
  } catch {
    // Ignore directory read errors
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const config = getRepoConfig();
  const repoPath = toAbsolutePath('');

  if (!isInsideRepo(repoPath)) {
    return NextResponse.json({ error: 'Invalid repository path' }, { status: 500 });
  }

  const results: SearchResult[] = [];

  walkDirectory(repoPath, '', query, results, 50);

  // Sort by score (higher first), then by match type (filename first)
  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.matchType !== b.matchType) {
      return a.matchType === 'filename' ? -1 : 1;
    }
    return a.path.localeCompare(b.path);
  });

  return NextResponse.json({ results: results.slice(0, 30) });
}
