import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = "https://prepperspanama.github.io/blog";
const SITE_NAME = "Preppers Panamá";
const SITE_DESCRIPTION = "Blog sobre preparacionismo, mochilas de emergencia, primeros auxilios y tecnologías de comunicación para situaciones de crisis en Panamá.";

function loadAllPosts() {
  const contentDir = join(process.cwd(), "src/content/blog");
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));

  return files.map((file) => {
    const content = readFileSync(join(contentDir, file), "utf-8");
    const match = content.match(
      /export const metadata\s*=\s*(\{[\s\S]*?\})\s*\n/
    );
    if (!match) throw new Error(`No metadata found in ${file}`);

    const metadata = new Function(`return ${match[1]}`)();
    const slug = file.replace(/\.mdx$/, "");

    return {
      slug,
      title: metadata.title,
      date: new Date(metadata.dateISO),
      excerpt: metadata.excerpt,
      category: metadata.category,
    };
  }).sort((a, b) => b.date.getTime() - a.date.getTime());
}

const posts = loadAllPosts();

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const items = posts
  .map(
    (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/${p.slug}/</link>
      <guid>${SITE_URL}/${p.slug}/</guid>
      <description>${escapeXml(p.excerpt)}</description>
      <category>${escapeXml(p.category)}</category>
      <pubDate>${p.date.toUTCString()}</pubDate>
    </item>`
  )
  .join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}/</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>es-pa</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

const outDir = resolve(__dirname, "..", "out");
writeFileSync(resolve(outDir, "rss.xml"), rss, "utf-8");
console.log("✓ RSS feed generated at out/rss.xml");
