import fs from "fs";
import path from "path";

export interface Post {
  slug: string;
  title: string;
  date: string;
  dateISO: string;
  readTime: string;
  excerpt: string;
  category: "Tecnología" | "Equipo" | "Salud" | "Táctica" | "Geografía";
  tags: string[];
  ogImage?: string;
}

function sanitizeSlugFromFileName(fileName: string): string {
  const rawSlug = fileName.replace(/\.mdx$/, "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) {
    throw new Error(`Slug inválido derivado del archivo: ${fileName}`);
  }
  return rawSlug;
}

function loadAllPosts(): Post[] {
  const contentDir = path.join(process.cwd(), "src/content/blog");
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));

  const posts = files.map((file) => {
    const content = fs.readFileSync(path.join(contentDir, file), "utf-8");
    const match = content.match(
      /export const metadata\s*=\s*(\{[\s\S]*?\})\s*\n/
    );
    if (!match) {
      throw new Error(`No se encontró metadata en ${file}`);
    }

    const metadata: Record<string, unknown> = new Function(
      `return ${match[1]}`
    )();
    const slug = sanitizeSlugFromFileName(file);

    return {
      slug,
      title: metadata.title as string,
      date: metadata.date as string,
      dateISO: metadata.dateISO as string,
      readTime: metadata.readTime as string,
      excerpt: metadata.excerpt as string,
      category: metadata.category as Post["category"],
      tags: metadata.tags as string[],
      ogImage: metadata.ogImage as string | undefined,
    };
  });

  return posts.sort(
    (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
  );
}

export const ALL_POSTS: Post[] = loadAllPosts();

export function getPostsByCategory(category: string) {
  return ALL_POSTS.filter((p) => p.category === category);
}

export function getPostsByTag(tag: string) {
  return ALL_POSTS.filter((p) => p.tags.includes(tag));
}

export function getAllCategories() {
  return [...new Set(ALL_POSTS.map((p) => p.category))];
}

export function getAllTags() {
  return [...new Set(ALL_POSTS.flatMap((p) => p.tags))];
}
