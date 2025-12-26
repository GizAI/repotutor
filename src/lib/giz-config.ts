/**
 * Giz Code Configuration System
 *
 * ~/.giz-code/ 폴더에서 설정과 프로젝트 목록을 관리
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

export interface GizConfig {
  password?: string;
  defaultProject?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
}

export interface ProjectsConfig {
  projects: Project[];
  currentProject?: string;
}

const GIZ_CODE_DIR = path.join(os.homedir(), '.giz-code');
const CONFIG_FILE = path.join(GIZ_CODE_DIR, 'config.yaml');
const PROJECTS_FILE = path.join(GIZ_CODE_DIR, 'projects.yaml');

// 간단한 YAML 파서 (의존성 최소화)
function parseYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let currentKey = '';
  let currentArray: unknown[] | null = null;
  let currentObject: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 배열 항목
    if (trimmed.startsWith('- ')) {
      if (currentArray) {
        const item = trimmed.slice(2).trim();
        // 객체 시작 (- id: xxx)
        if (item.includes(':')) {
          const [key, ...valueParts] = item.split(':');
          const value = valueParts.join(':').trim();
          currentObject = { [key.trim()]: parseValue(value) };
          currentArray.push(currentObject);
        } else {
          currentArray.push(parseValue(item));
          currentObject = null;
        }
      }
      continue;
    }

    // 배열 내 객체의 속성
    if (line.startsWith('    ') && currentObject) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      currentObject[key.trim()] = parseValue(value);
      continue;
    }

    // 일반 키-값
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (!value) {
        // 배열 시작
        currentKey = key;
        currentArray = [];
        currentObject = null;
        result[key] = currentArray;
      } else {
        result[key] = parseValue(value);
        currentKey = '';
        currentArray = null;
        currentObject = null;
      }
    }
  }

  return result;
}

function parseValue(value: string): unknown {
  if (!value) return '';
  // 따옴표 제거
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  // boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  // number
  if (!isNaN(Number(value))) return Number(value);
  return value;
}

// YAML 직렬화
function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${prefix}${key}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length > 0) {
            const [firstKey, firstValue] = entries[0];
            lines.push(`${prefix}  - ${firstKey}: ${formatValue(firstValue)}`);
            for (let i = 1; i < entries.length; i++) {
              const [k, v] = entries[i];
              lines.push(`${prefix}    ${k}: ${formatValue(v)}`);
            }
          }
        } else {
          lines.push(`${prefix}  - ${formatValue(item)}`);
        }
      }
    } else {
      lines.push(`${prefix}${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    if (value.includes(':') || value.includes('#') || value.includes("'") || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value || '""';
  }
  return String(value);
}

// ~/.giz-code 디렉토리 초기화
export function ensureGizCodeDir(): void {
  if (!fs.existsSync(GIZ_CODE_DIR)) {
    fs.mkdirSync(GIZ_CODE_DIR, { recursive: true });
  }
}

// 설정 파일 읽기
export function getGizConfig(): GizConfig {
  ensureGizCodeDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    // 기존 .env 값으로 초기화
    const envPassword = process.env.REPOTUTOR_PASSWORD || process.env.GIZ_CODE_PASSWORD;
    const config: GizConfig = {};
    if (envPassword) {
      config.password = envPassword;
    }
    saveGizConfig(config);
    return config;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return parseYaml(content) as GizConfig;
  } catch {
    return {};
  }
}

// 설정 저장
export function saveGizConfig(config: GizConfig): void {
  ensureGizCodeDir();
  const yaml = toYaml(config as Record<string, unknown>);
  fs.writeFileSync(CONFIG_FILE, yaml, 'utf-8');
}

// 프로젝트 목록 읽기
export function getProjects(): ProjectsConfig {
  ensureGizCodeDir();

  if (!fs.existsSync(PROJECTS_FILE)) {
    // 기존 REPO_PATH로 첫 프로젝트 초기화
    const envPath = process.env.REPO_PATH || process.env.REPOTUTOR_PATH;
    const config: ProjectsConfig = { projects: [] };

    if (envPath && fs.existsSync(envPath)) {
      const name = getProjectName(envPath);
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      config.projects.push({ id, name, path: envPath });
      config.currentProject = id;
    }

    saveProjects(config);
    return config;
  }

  try {
    const content = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    const parsed = parseYaml(content);
    return {
      projects: (parsed.projects as Project[]) || [],
      currentProject: parsed.currentProject as string | undefined,
    };
  } catch {
    return { projects: [] };
  }
}

// 프로젝트 목록 저장
export function saveProjects(config: ProjectsConfig): void {
  ensureGizCodeDir();
  const yaml = toYaml(config as unknown as Record<string, unknown>);
  fs.writeFileSync(PROJECTS_FILE, yaml, 'utf-8');
}

// 프로젝트 이름 추출 (package.json 또는 디렉토리명)
function getProjectName(projectPath: string): string {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch {
      // ignore
    }
  }
  return path.basename(projectPath);
}

// 프로젝트 추가
export function addProject(projectPath: string, name?: string, id?: string): Project {
  const config = getProjects();
  const resolvedPath = path.resolve(projectPath);

  // 이미 존재하는지 확인
  const existing = config.projects.find(p => p.path === resolvedPath);
  if (existing) {
    return existing;
  }

  const projectName = name || getProjectName(resolvedPath);
  const projectId = id || projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // ID 중복 방지
  let finalId = projectId;
  let counter = 1;
  while (config.projects.some(p => p.id === finalId)) {
    finalId = `${projectId}-${counter++}`;
  }

  const project: Project = {
    id: finalId,
    name: projectName,
    path: resolvedPath,
  };

  config.projects.push(project);

  // 첫 프로젝트면 현재 프로젝트로 설정
  if (!config.currentProject) {
    config.currentProject = finalId;
  }

  saveProjects(config);
  return project;
}

// 프로젝트 삭제
export function removeProject(projectId: string): boolean {
  const config = getProjects();
  const index = config.projects.findIndex(p => p.id === projectId);

  if (index === -1) return false;

  config.projects.splice(index, 1);

  // 현재 프로젝트가 삭제되면 첫 번째 프로젝트로 전환
  if (config.currentProject === projectId) {
    config.currentProject = config.projects[0]?.id;
  }

  saveProjects(config);
  return true;
}

// 현재 프로젝트 설정
export function setCurrentProject(projectId: string): boolean {
  const config = getProjects();
  const project = config.projects.find(p => p.id === projectId);

  if (!project) return false;

  config.currentProject = projectId;
  saveProjects(config);
  return true;
}

// 현재 프로젝트 가져오기
export function getCurrentProject(): Project | null {
  const config = getProjects();

  if (!config.currentProject) {
    return config.projects[0] || null;
  }

  return config.projects.find(p => p.id === config.currentProject) || config.projects[0] || null;
}

// 현재 프로젝트 경로 가져오기
export function getCurrentProjectPath(): string | null {
  const project = getCurrentProject();
  return project?.path || null;
}

// 비밀번호 가져오기 (config.yaml 우선, .env fallback)
export function getPassword(): string | undefined {
  const config = getGizConfig();
  return config.password || process.env.REPOTUTOR_PASSWORD || process.env.GIZ_CODE_PASSWORD;
}

// 비밀번호 설정
export function setPassword(password: string): void {
  const config = getGizConfig();
  config.password = password;
  saveGizConfig(config);
}

export const GIZ_CODE_PATH = GIZ_CODE_DIR;
