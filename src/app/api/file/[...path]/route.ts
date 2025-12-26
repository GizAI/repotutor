/**
 * File Content API - 개별 파일 내용
 *
 * GET /api/file/src/lib/openai.ts?highlight=true&theme=dark
 * GET /api/file/public/image.png?raw=true (바이너리 파일 직접 서빙)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { readFileContent, getPathInfo } from '@/lib/files';
import { highlightCode } from '@/lib/files/highlighter';
import { toAbsolutePath, isInsideRepo } from '@/lib/repo-config';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

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

    // Raw file serving - serves any file type
    if (isRaw) {
      const absolutePath = toAbsolutePath(relativePath);

      // Security check
      if (!isInsideRepo(absolutePath)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      const fileName = path.basename(relativePath);
      const mimeType = mime.lookup(relativePath) || 'application/octet-stream';
      const stat = fs.statSync(absolutePath);
      const fileSize = stat.size;

      // Handle Range requests for streaming (video/audio)
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const fileStream = fs.createReadStream(absolutePath, { start, end });
        const chunks: Buffer[] = [];
        for await (const chunk of fileStream) {
          chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
          },
        });
      }

      // Regular file serving
      const fileBuffer = fs.readFileSync(absolutePath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Text file content with optional syntax highlighting
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
