import { redirect } from 'next/navigation';

// 메인 페이지는 파일 브라우저로 리다이렉트
export default function HomePage() {
  redirect('/browse');
}
