/**
 * Files Siblings API - 같은 디렉토리의 마크다운 문서 목록
 *
 * GET /api/files/siblings?path=docs/guide/intro.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSiblingDocs } from '@/lib/files';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path') || '';

    if (!relativePath) {
      return NextResponse.json({ siblings: [] });
    }

    const siblings = await getSiblingDocs(relativePath);

    return NextResponse.json({ siblings });
  } catch (error) {
    console.error('Files siblings API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', siblings: [] },
      { status: 500 }
    );
  }
}
