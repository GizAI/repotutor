/**
 * Repository Configuration
 *
 * Giz Code는 특정 리포지토리에 하드코딩되지 않습니다.
 * ~/.giz-code에서 프로젝트를 관리하거나, 환경 변수로 설정할 수 있습니다.
 */

import path from 'path';
import fs from 'fs';
import { getCurrentProjectPath, getCurrentProject, type Project } from './giz-config';

export interface RepoConfig {
  /** 리포지토리 루트 경로 (절대 경로) */
  rootPath: string;
  /** 리포지토리 이름 */
  name: string;
  /** 리포지토리 설명 */
  description?: string;
  /** Git URL (선택적) */
  gitUrl?: string;
  /** 표시할 디렉토리 목록 (비어있으면 전체) */
  includeDirs?: string[];
  /** 제외할 디렉토리/파일 패턴 */
  excludePatterns: string[];
}

// 기본 제외 패턴
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  '.cache',
  'dist',
  'build',
  '.env.local',
  '.env',
  '*.log',
  '.DS_Store',
  'coverage',
  '.nyc_output',
];

// .gitignore 파일 파싱
function parseGitignore(rootPath: string): string[] {
  const gitignorePath = path.join(rootPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];

  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')) // 빈 줄, 주석 제외
      .map(line => line.replace(/^\//, '')) // 앞의 / 제거
      .filter(line => !line.startsWith('!')); // 부정 패턴 제외 (단순화)
  } catch {
    return [];
  }
}

// gitignore 패턴 캐시
let _gitignorePatterns: string[] | null = null;

export function getGitignorePatterns(): string[] {
  if (_gitignorePatterns) return _gitignorePatterns;

  const rootPath = getRepoPathFromEnv();
  _gitignorePatterns = parseGitignore(rootPath);
  return _gitignorePatterns;
}

// 프로젝트 경로 가져오기 (giz-config 우선, 환경 변수 fallback)
function getRepoPathFromEnv(): string {
  // 1. ~/.giz-code/projects.yaml에서 현재 프로젝트
  const gizPath = getCurrentProjectPath();
  if (gizPath) {
    return path.resolve(gizPath);
  }

  // 2. 환경 변수 fallback
  const envPath = process.env.REPO_PATH || process.env.REPOTUTOR_PATH;
  if (envPath) {
    return path.resolve(envPath);
  }

  // 3. 기본값
  return path.resolve(process.cwd(), '../..');
}

// 현재 프로젝트 정보 export (Header 등에서 사용)
export function getActiveProject(): Project | null {
  return getCurrentProject();
}

// 리포지토리 이름과 설명 추출
function getRepoInfo(rootPath: string): { name: string; description?: string } {
  // package.json에서 정보 가져오기 시도
  const packageJsonPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return {
        name: pkg.name || path.basename(rootPath),
        description: pkg.description,
      };
    } catch {
      // 무시
    }
  }

  // 디렉토리 이름 사용
  return { name: path.basename(rootPath) };
}

// Git URL 가져오기
function getGitUrl(rootPath: string): string | undefined {
  const gitConfigPath = path.join(rootPath, '.git', 'config');
  if (!fs.existsSync(gitConfigPath)) return undefined;

  try {
    const config = fs.readFileSync(gitConfigPath, 'utf-8');
    const match = config.match(/url\s*=\s*(.+)/);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

// 싱글톤 설정
let _config: RepoConfig | null = null;

export function getRepoConfig(): RepoConfig {
  if (_config) return _config;

  const rootPath = getRepoPathFromEnv();
  const { name, description } = getRepoInfo(rootPath);

  _config = {
    rootPath,
    name,
    description,
    gitUrl: getGitUrl(rootPath),
    excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
  };

  return _config;
}

// 설정 재설정 (테스트용)
export function setRepoConfig(config: Partial<RepoConfig>): void {
  const current = getRepoConfig();
  _config = { ...current, ...config };
}

// 캐시 무효화 (프로젝트 전환 시)
export function invalidateCache(): void {
  _config = null;
  _gitignorePatterns = null;
}

// 패턴 매칭 헬퍼
function matchesPattern(relativePath: string, pattern: string): boolean {
  const name = path.basename(relativePath);
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // 디렉토리 패턴 (끝에 / 있음)
  if (pattern.endsWith('/')) {
    const dirPattern = pattern.slice(0, -1);
    return name === dirPattern || normalizedPath.includes(`/${dirPattern}/`) || normalizedPath.startsWith(`${dirPattern}/`);
  }

  // glob 패턴 (**)
  if (pattern.includes('**')) {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
    return regex.test(normalizedPath) || regex.test(name);
  }

  // 단순 glob 패턴 (*)
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return regex.test(name);
  }

  // 정확한 매칭 또는 경로 내 포함
  return name === pattern || normalizedPath === pattern || normalizedPath.includes(`/${pattern}/`) || normalizedPath.startsWith(`${pattern}/`);
}

// 경로가 제외 패턴과 일치하는지 확인
export function isExcluded(relativePath: string, config?: RepoConfig): boolean {
  const cfg = config || getRepoConfig();

  // 기본 제외 패턴 확인
  if (cfg.excludePatterns.some(pattern => matchesPattern(relativePath, pattern))) {
    return true;
  }

  // gitignore 패턴 확인
  const gitignorePatterns = getGitignorePatterns();
  return gitignorePatterns.some(pattern => matchesPattern(relativePath, pattern));
}

// 절대 경로를 리포지토리 상대 경로로 변환
export function toRelativePath(absolutePath: string): string {
  const config = getRepoConfig();
  return path.relative(config.rootPath, absolutePath);
}

// 상대 경로를 절대 경로로 변환
export function toAbsolutePath(relativePath: string): string {
  const config = getRepoConfig();
  return path.join(config.rootPath, relativePath);
}

// 경로가 리포지토리 내부인지 확인 (보안)
export function isInsideRepo(targetPath: string): boolean {
  const config = getRepoConfig();
  const resolved = path.resolve(config.rootPath, targetPath);
  return resolved.startsWith(config.rootPath);
}
