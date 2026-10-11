import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import JSON5 from "json5";

const SITE_URL = "https://prepperspanama.github.io";
const SITE_NAME = "Preppers Panamá";
const SITE_DESCRIPTION =
  "Blog y mapa satelital en vivo sobre preparacionismo y resiliencia en Panamá: terremotos, sismos, huracanes, El Niño y microclimas. Incluye guías de primeros auxilios, kits de emergencia y protocolos de acción ante desastres, con foco específico en la geografía y los riesgos propios del país.";

function loadAllPosts() {
  const contentDir = join(process.cwd(), "src/content/blog");
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const content = readFileSync(join(contentDir, file), "utf-8");
      const match = content.match(/export const metadata\s*=\s*(\{[\s\S]*?\})\s*\n/);
      if (!match) throw new Error(`No metadata found in ${file}`);
      const metadata = JSON5.parse(match[1]);
      return {
        slug: file.replace(/\.mdx$/, ""),
        title: metadata.title,
        excerpt: metadata.excerpt,
        dateISO: metadata.dateISO,
        tags: metadata.tags ?? [],
      };
    })
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

function postLine(p) {
  return `- [${p.title}](${SITE_URL}/blog/${p.slug}/): ${p.excerpt}`;
}

const posts = loadAllPosts();
const quakePosts = posts.filter((p) => p.tags.includes("Sismos") || p.tags.includes("Terremoto"));
const quakeSlugs = new Set(quakePosts.map((p) => p.slug));
const otherPosts = posts.filter((p) => !quakeSlugs.has(p.slug));

const lines = [];
lines.push(`# ${SITE_NAME}`);
lines.push("");
lines.push(`> ${SITE_DESCRIPTION}`);
lines.push("");
lines.push("## Páginas principales");
lines.push("");
lines.push(`- [Inicio](${SITE_URL}/): presentación del sitio y los pilares de preparación.`);
lines.push(`- [Blog](${SITE_URL}/blog/): todos los artículos, organizados por categoría y tag.`);
lines.push(
  `- [Mapa Satelital GOES-19](${SITE_URL}/mapa/): imágenes satelitales NOAA en vivo, clima por ciudad y sismos recientes (USGS + IGC-UP) en Panamá.`
);
lines.push(`- [Tags](${SITE_URL}/tags/): índice de todos los temas cubiertos en el blog.`);
lines.push(`- [RSS](${SITE_URL}/rss.xml): feed de artículos nuevos.`);
lines.push("");

if (quakePosts.length > 0) {
  lines.push("## Terremoto de Panamá (9 de octubre de 2026) y preparación sísmica");
  lines.push("");
  quakePosts.forEach((p) => lines.push(postLine(p)));
  lines.push("");
}

if (otherPosts.length > 0) {
  lines.push("## Otros artículos del blog");
  lines.push("");
  otherPosts.forEach((p) => lines.push(postLine(p)));
  lines.push("");
}

lines.push("## Licencia");
lines.push("");
lines.push(`- [Licencia GPL-3.0](${SITE_URL}/license/): el código y contenido del sitio están bajo esta licencia.`);
lines.push("");

writeFileSync(join(process.cwd(), "public", "llms.txt"), lines.join("\n"), "utf-8");
console.log(`✓ llms.txt generado en public/llms.txt (${posts.length} artículos)`);
