import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
  icon: string;
  category?: string;
}

export interface Doc extends DocMeta {
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), 'content');

export function getAllDocs(): DocMeta[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'));

  const docs = files.map((filename) => {
    const filePath = path.join(CONTENT_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(fileContent);

    const slug = filename.replace(/^\d+-/, '').replace(/\.mdx$/, '');

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      order: data.order ?? (parseInt(filename.split('-')[0]) || 999),
      icon: data.icon || 'spark',
      category: data.category,
    } as DocMeta;
  });

  return docs.sort((a, b) => a.order - b.order);
}

export function getDocBySlug(slug: string): Doc | null {
  if (!fs.existsSync(CONTENT_DIR)) {
    return null;
  }

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'));

  for (const filename of files) {
    const fileSlug = filename.replace(/^\d+-/, '').replace(/\.mdx$/, '');
    if (fileSlug === slug) {
      const filePath = path.join(CONTENT_DIR, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);

      return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        order: data.order ?? (parseInt(filename.split('-')[0]) || 999),
        icon: data.icon || 'spark',
        category: data.category,
        content,
      };
    }
  }

  return null;
}

export function getAllSlugs(): string[] {
  return getAllDocs().map((doc) => doc.slug);
}

export function getAdjacentDocs(currentSlug: string): { prev: DocMeta | null; next: DocMeta | null } {
  const docs = getAllDocs();
  const currentIndex = docs.findIndex((d) => d.slug === currentSlug);

  return {
    prev: currentIndex > 0 ? docs[currentIndex - 1] : null,
    next: currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null,
  };
}
