import { getAllDocs } from '@/lib/mdx';
import { getRepoConfig } from '@/lib/repo-config';
import { HomePageClient } from './home-client';

// 서버에서 docs 데이터를 가져옴
export default function HomePage() {
  const docs = getAllDocs();
  const config = getRepoConfig();

  return (
    <HomePageClient
      docs={docs}
      repoName={config.name}
      repoDescription={config.description}
    />
  );
}
