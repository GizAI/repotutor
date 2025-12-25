import { getRepoConfig } from '@/lib/repo-config';

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {children}
    </div>
  );
}

export async function generateMetadata() {
  const config = getRepoConfig();
  return {
    title: `Browse - ${config.name}`,
    description: `Browse the source code of ${config.name}`,
  };
}
