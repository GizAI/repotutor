import { getRepoConfig } from '@/lib/repo-config';
import { getPathInfo, readFileTree, getSiblingDocs, type DocSibling } from '@/lib/files';
import { BrowsePageClient } from './page-client';

interface BrowsePageProps {
  params: Promise<{ path?: string[] }>;
}

export default async function BrowsePage({ params }: BrowsePageProps) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments?.join('/') || '';

  const config = getRepoConfig();
  const pathInfo = getPathInfo(relativePath);

  // Root 또는 디렉토리인 경우 파일 트리 로드
  let entries = null;
  if (!pathInfo || pathInfo.type === 'directory') {
    try {
      entries = await readFileTree(relativePath, 3);
    } catch {
      entries = [];
    }
  }

  // 마크다운 파일인 경우 sibling 문서 로드
  let siblings: DocSibling[] = [];
  if (pathInfo?.type === 'file') {
    siblings = await getSiblingDocs(relativePath);
  }

  return (
    <BrowsePageClient
      repoName={config.name}
      currentPath={relativePath}
      pathInfo={pathInfo}
      entries={entries}
      siblings={siblings}
    />
  );
}

export async function generateMetadata({ params }: BrowsePageProps) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments?.join('/') || '';
  const config = getRepoConfig();

  if (!relativePath) {
    return {
      title: `Browse - ${config.name}`,
    };
  }

  const pathInfo = getPathInfo(relativePath);
  const name = pathInfo?.name || relativePath.split('/').pop() || 'File';

  return {
    title: `${name} - ${config.name}`,
  };
}
