import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { getDocBySlug, getAllSlugs, getAdjacentDocs, getAllDocs } from '@/lib/mdx';
import { DocPageClient } from './client';

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug: [slug] }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug[0]);

  if (!doc) {
    return { title: 'Not Found' };
  }

  return {
    title: `${doc.title} - Reson Atlas`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug[0]);

  if (!doc) {
    notFound();
  }

  const adjacent = getAdjacentDocs(slug[0]);
  const docs = getAllDocs();

  return (
    <DocPageClient doc={doc} adjacent={adjacent} docs={docs}>
      <MDXRemote
        source={doc.content}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug],
          },
        }}
      />
    </DocPageClient>
  );
}
