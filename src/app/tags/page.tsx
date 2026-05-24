import Link from "next/link";
import { getAllTags, ALL_POSTS } from "@/lib/posts";
import { SITE_URL } from "@/lib/constants";

export const metadata = {
  title: "Tags | Preppers Panamá",
  description: "Explora todos los temas del blog organizados por etiquetas.",
};

export default function TagsPage() {
  const tags = getAllTags().map((tag) => ({
    name: tag,
    count: ALL_POSTS.filter((p) => p.tags.includes(tag)).length,
  }));

  const maxCount = Math.max(...tags.map((t) => t.count), 1);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Tags | Preppers Panamá",
    description: "Explora todos los temas del blog organizados por etiquetas.",
    url: `${SITE_URL}/tags/`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-zinc-950 min-h-screen pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            href="/blog"
            className="text-cyan-500 font-mono text-xs uppercase tracking-widest mb-12 inline-block hover:text-cyan-400 transition-colors"
          >
            ← Volver al blog
          </Link>

          <header className="mb-16">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
              TAGS
            </h1>
            <p className="text-zinc-400 text-xl font-light max-w-2xl">
              {tags.length} temas disponibles
            </p>
          </header>

          <div className="flex flex-wrap gap-3">
            {tags
              .sort((a, b) => b.count - a.count)
              .map(({ name, count }) => {
                const weight = 0.6 + (count / maxCount) * 0.6;
                return (
                  <Link
                    key={name}
                    href={`/blog/tag/${name.toLowerCase()}`}
                    className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800/60 hover:border-cyan-500/50 transition-all duration-300"
                    style={{ transform: `scale(${weight})` }}
                  >
                    <span
                      className="font-mono font-bold tracking-tight transition-colors group-hover:text-cyan-400"
                      style={{
                        fontSize: `${0.7 + (count / maxCount) * 0.5}rem`,
                      }}
                    >
                      #{name}
                    </span>
                    <span
                      className="text-xs font-mono text-zinc-500 px-1.5 py-0.5 rounded-full bg-zinc-800/60"
                      style={{
                        fontSize: `${0.6 + (count / maxCount) * 0.2}rem`,
                      }}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
