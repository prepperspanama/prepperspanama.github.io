import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

function stripMarkdown(md) {
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, "")
    .replace(/---+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMetadata(content) {
  const match = content.match(
    /export const metadata\s*=\s*(\{[\s\S]*?\})\s*\n/
  );
  if (!match) return null;
  return new Function(`return ${match[1]}`)();
}

function extractTextContent(content) {
  const body = content.replace(
    /export const metadata\s*=\s*\{[\s\S]*?\}\s*\n/,
    ""
  );
  return stripMarkdown(body);
}

const contentDir = join(process.cwd(), "src/content/blog");
const files = readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));

const index = files
  .map((file) => {
    const content = readFileSync(join(contentDir, file), "utf-8");
    const meta = parseMetadata(content);
    if (!meta) {
      console.warn(`⚠ No metadata found in ${file}, skipping`);
      return null;
    }
    const slug = file.replace(/\.mdx$/, "");
    return {
      slug,
      title: meta.title,
      date: meta.date,
      excerpt: meta.excerpt,
      category: meta.category,
      tags: meta.tags,
      content: extractTextContent(content).slice(0, 2000),
    };
  })
  .filter(Boolean)
  .sort(
    (a, b) => new Date(b.dateISO || b.date).getTime() - new Date(a.dateISO || a.date).getTime()
  );

writeFileSync(
  join(process.cwd(), "public", "search-index.json"),
  JSON.stringify(index),
  "utf-8"
);

console.log(`✓ Search index generated at public/search-index.json (${index.length} posts)`);
