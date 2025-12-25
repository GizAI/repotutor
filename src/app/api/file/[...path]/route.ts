/**
 * File Content API - 개별 파일 내용
 *
 * GET /api/file/src/lib/openai.ts?highlight=true&theme=dark
 * GET /api/file/public/image.png?raw=true (바이너리 파일 직접 서빙)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { readFileContent, getPathInfo } from '@/lib/files';
import { highlightCode } from '@/lib/files/highlighter';
import { toAbsolutePath, isInsideRepo } from '@/lib/repo-config';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join('/');

    const { searchParams } = new URL(request.url);
    const isRaw = searchParams.get('raw') === 'true';
    const shouldHighlight = searchParams.get('highlight') !== 'false';
    const theme = (searchParams.get('theme') || 'dark') as 'dark' | 'light';

    const pathInfo = getPathInfo(relativePath);
    if (!pathInfo) {
      return NextResponse.json(
        { error: 'File not found', path: relativePath },
        { status: 404 }
      );
    }

    if (pathInfo.type !== 'file') {
      return NextResponse.json(
        { error: 'Not a file', path: relativePath },
        { status: 400 }
      );
    }

    // Raw file serving (for images, PDFs, etc.)
    if (isRaw) {
      const absolutePath = toAbsolutePath(relativePath);

      // Security check
      if (!isInsideRepo(absolutePath)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      const ext = path.extname(relativePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      const fileBuffer = fs.readFileSync(absolutePath);
      const fileName = path.basename(relativePath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Text file content
    const fileContent = await readFileContent(relativePath);

    let highlightedHtml: string | undefined;
    if (shouldHighlight) {
      try {
        const result = await highlightCode(fileContent.content, {
          language: fileContent.language,
          theme,
        });
        highlightedHtml = result.html;
      } catch (err) {
        console.error('Highlight error:', err);
        // Continue without highlighting
      }
    }

    return NextResponse.json({
      ...fileContent,
      highlightedHtml,
      theme,
    });
  } catch (error) {
    console.error('File API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
