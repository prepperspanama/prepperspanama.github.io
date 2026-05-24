import Link from "next/link";

import { ALL_POSTS } from "@/lib/posts";
import { SITE_URL } from "@/lib/constants";

export const metadata = {
  title: "Blog | Preppers Panamá",
  description: "Artículos sobre preparación, tecnología y supervivencia.",
};

export default function BlogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog | Preppers Panamá",
    description: "Artículos sobre preparación, tecnología y supervivencia.",
    url: `${SITE_URL}/blog/`,
    blogPost: ALL_POSTS.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      datePublished: post.dateISO,
      url: `${SITE_URL}/blog/${post.slug}/`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="bg-zinc-950 min-h-screen pt-32 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        <header className="mb-16">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
            BLOG
          </h1>
          <p className="text-zinc-400 text-xl font-light max-w-2xl">
            Información técnica y táctica para la resiliencia en el istmo.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {ALL_POSTS.length > 0 ? (
            ALL_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group relative bg-zinc-900/40 border border-zinc-800/60 p-8 rounded-3xl hover:border-cyan-500/50 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-mono text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/40 rounded border border-cyan-800/50">
                    {post.category}
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">
                    {post.date}
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors">
                  {post.title}
                </h2>

                <p className="text-zinc-400 leading-relaxed mb-6">
                  {post.excerpt}
                </p>

                <div className="flex items-center text-xs font-mono text-zinc-500 gap-4">
                  <span>{post.readTime} de lectura</span>
                  <div className="flex gap-2">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-zinc-600">#{tag}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">
                Próximamente: Transmisiones en curso...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
