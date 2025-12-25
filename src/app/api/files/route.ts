/**
 * Files API - 디렉토리 목록 및 파일 트리
 *
 * GET /api/files?path=src/lib&tree=true&depth=2
 */

import { NextRequest, NextResponse } from 'next/server';
import { readDirectory, readFileTree, getPathInfo } from '@/lib/files';
import { getRepoConfig } from '@/lib/repo-config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path') || '';
    const isTree = searchParams.get('tree') === 'true';
    const depth = parseInt(searchParams.get('depth') || '2', 10);

    const config = getRepoConfig();
    const pathInfo = getPathInfo(relativePath);

    if (!pathInfo) {
      return NextResponse.json(
        { error: 'Path not found', path: relativePath },
        { status: 404 }
      );
    }

    if (pathInfo.type !== 'directory') {
      return NextResponse.json(
        { error: 'Not a directory', path: relativePath },
        { status: 400 }
      );
    }

    const entries = isTree
      ? await readFileTree(relativePath, Math.min(depth, 5))
      : await readDirectory(relativePath);

    return NextResponse.json({
      repo: {
        name: config.name,
        gitUrl: config.gitUrl,
      },
      path: relativePath,
      pathInfo,
      entries,
    });
  } catch (error) {
    console.error('Files API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
