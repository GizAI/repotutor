/**
 * File System Reader
 *
 * 리포지토리 파일을 안전하게 읽고 메타데이터를 추출합니다.
 */

import fs from 'fs';
import path from 'path';
import { getRepoConfig, isExcluded, isInsideRepo, toAbsolutePath } from '../repo-config';

export interface FileEntry {
  name: string;
  path: string;  // 리포지토리 상대 경로
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  extension?: string;
}

export interface FileTree extends FileEntry {
  children?: FileTree[];
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  lines: number;
  extension: string;
}

// 파일 확장자로 언어 추론
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.prisma': 'prisma',
  '.env': 'dotenv',
  '.gitignore': 'gitignore',
  '.dockerignore': 'gitignore',
  'Dockerfile': 'dockerfile',
  '.toml': 'toml',
  '.xml': 'xml',
  '.svg': 'xml',  // SVG는 XML 구문으로 하이라이팅
};

export function getLanguageFromPath(filePath: string): string {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // 확장자 없는 특수 파일
  if (EXTENSION_TO_LANGUAGE[name]) {
    return EXTENSION_TO_LANGUAGE[name];
  }

  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext';
}

// 바이너리 파일 확장자
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.tar', '.gz',
  '.mp3', '.mp4', '.wav', '.webm',
  '.exe', '.dll', '.so', '.dylib',
]);

export function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// 디렉토리 내용 읽기
export async function readDirectory(relativePath: string = ''): Promise<FileEntry[]> {
  const absolutePath = toAbsolutePath(relativePath);

  // 보안 검사
  if (!isInsideRepo(absolutePath)) {
    throw new Error('Access denied: path is outside repository');
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Directory not found: ${relativePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${relativePath}`);
  }

  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  const result: FileEntry[] = [];

  for (const entry of entries) {
    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    // 제외 패턴 확인
    if (isExcluded(entryRelativePath)) continue;

    const entryAbsolutePath = path.join(absolutePath, entry.name);
    const entryStat = fs.statSync(entryAbsolutePath);

    result.push({
      name: entry.name,
      path: entryRelativePath,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isFile() ? entryStat.size : undefined,
      modified: entryStat.mtime.toISOString(),
      extension: entry.isFile() ? path.extname(entry.name) : undefined,
    });
  }

  // 정렬: 디렉토리 먼저, 그 다음 이름순
  result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}

// 파일 트리 읽기 (재귀)
export async function readFileTree(
  relativePath: string = '',
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<FileTree[]> {
  if (currentDepth >= maxDepth) return [];

  const entries = await readDirectory(relativePath);
  const result: FileTree[] = [];

  for (const entry of entries) {
    const treeEntry: FileTree = { ...entry };

    if (entry.type === 'directory') {
      treeEntry.children = await readFileTree(entry.path, maxDepth, currentDepth + 1);
    }

    result.push(treeEntry);
  }

  return result;
}

// 파일 내용 읽기
export async function readFileContent(relativePath: string): Promise<FileContent> {
  const absolutePath = toAbsolutePath(relativePath);

  // 보안 검사
  if (!isInsideRepo(absolutePath)) {
    throw new Error('Access denied: path is outside repository');
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${relativePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${relativePath}`);
  }

  // 바이너리 파일 확인
  if (isBinaryFile(absolutePath)) {
    throw new Error(`Binary file cannot be displayed: ${relativePath}`);
  }

  // 파일 크기 제한 (1MB)
  const MAX_SIZE = 1024 * 1024;
  if (stat.size > MAX_SIZE) {
    throw new Error(`File too large (max 1MB): ${relativePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const name = path.basename(relativePath);
  const extension = path.extname(relativePath);

  return {
    path: relativePath,
    name,
    content,
    language: getLanguageFromPath(relativePath),
    size: stat.size,
    lines: content.split('\n').length,
    extension,
  };
}

// 파일 존재 확인
export function fileExists(relativePath: string): boolean {
  const absolutePath = toAbsolutePath(relativePath);
  if (!isInsideRepo(absolutePath)) return false;
  return fs.existsSync(absolutePath);
}

// 경로 정보 가져오기
export function getPathInfo(relativePath: string): FileEntry | null {
  const absolutePath = toAbsolutePath(relativePath);
  if (!isInsideRepo(absolutePath) || !fs.existsSync(absolutePath)) {
    return null;
  }

  const stat = fs.statSync(absolutePath);
  const name = path.basename(relativePath) || getRepoConfig().name;

  return {
    name,
    path: relativePath,
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.isFile() ? stat.size : undefined,
    modified: stat.mtime.toISOString(),
    extension: stat.isFile() ? path.extname(relativePath) : undefined,
  };
}

// Markdown/MDX frontmatter에서 메타데이터 파싱
function parseFrontmatterFromFile(absolutePath: string): { title?: string; order?: number } {
  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return {};

    const frontmatter = match[1];
    const title = frontmatter.match(/title:\s*(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
    const orderMatch = frontmatter.match(/order:\s*(\d+)/);
    const order = orderMatch ? parseInt(orderMatch[1], 10) : undefined;

    return { title, order };
  } catch {
    return {};
  }
}

export interface DocSibling {
  path: string;
  title: string;
  order?: number;
}

// 같은 디렉토리의 마크다운/MDX 파일 목록 가져오기 (이전/다음 네비게이션용)
export async function getSiblingDocs(relativePath: string): Promise<DocSibling[]> {
  const MARKDOWN_EXTENSIONS = ['.md', '.mdx', '.markdown'];
  const ext = path.extname(relativePath).toLowerCase();

  // 마크다운 파일이 아니면 빈 배열 반환
  if (!MARKDOWN_EXTENSIONS.includes(ext)) {
    return [];
  }

  const dirPath = path.dirname(relativePath);
  const absoluteDirPath = toAbsolutePath(dirPath);

  if (!isInsideRepo(absoluteDirPath) || !fs.existsSync(absoluteDirPath)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(absoluteDirPath, { withFileTypes: true });
    const siblings: DocSibling[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const entryExt = path.extname(entry.name).toLowerCase();
      if (!MARKDOWN_EXTENSIONS.includes(entryExt)) continue;

      const entryPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
      const absoluteEntryPath = path.join(absoluteDirPath, entry.name);

      // frontmatter에서 title과 order 추출
      const { title, order } = parseFrontmatterFromFile(absoluteEntryPath);

      siblings.push({
        path: entryPath,
        title: title || entry.name.replace(/\.(md|mdx|markdown)$/i, '').replace(/^\d+-/, ''),
        order,
      });
    }

    // order로 정렬, order 없으면 파일명으로
    siblings.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.path.localeCompare(b.path);
    });

    return siblings;
  } catch {
    return [];
  }
}
