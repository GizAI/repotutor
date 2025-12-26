'use client';

import { BrowsePageClient } from './page-client';

// 완전한 클라이언트 사이드 SPA - 서버 재실행 없음
export default function BrowsePage() {
  return <BrowsePageClient repoName="reson" />;
}
