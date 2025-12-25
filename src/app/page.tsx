import { getAllDocs } from '@/lib/mdx';
import { HomePageClient } from './home-client';

// 서버에서 docs 데이터를 가져옴
export default function HomePage() {
  const docs = getAllDocs();
  return <HomePageClient docs={docs} />;
}
