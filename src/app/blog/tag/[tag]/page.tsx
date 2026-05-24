import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostsByTag, getAllTags } from "@/lib/posts";
import Breadcrumbs from "@/components/Breadcrumbs";

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateStaticParams() {
  return getAllTags().map((tag) => ({
    tag: tag.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { tag } = await params;
  return {
    title: `Tag: #${tag}`,
    description: `Artículos etiquetados con #${tag} en Preppers Panamá.`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);

  if (posts.length === 0) {
    notFound();
  }

  return (
    <div className="bg-zinc-950 min-h-screen pt-32 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        <Breadcrumbs
          items={[
            { label: "Blog", href: "/blog" },
            { label: `#${decoded}` },
          ]}
        />

        <header className="mb-16">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
            #{decoded}
          </h1>
          <p className="text-zinc-400 text-xl font-light max-w-2xl">
            Artículos etiquetados con #{decoded}.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group relative bg-zinc-900/40 border border-zinc-800/60 p-8 rounded-3xl hover:border-cyan-500/50 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/40 rounded border border-cyan-800/50">
                  {post.category}
                </span>
                <span className="text-zinc-500 text-xs font-mono">{post.date}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors">
                {post.title}
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-6">{post.excerpt}</p>
              <div className="flex items-center text-xs font-mono text-zinc-500 gap-4">
                <span>{post.readTime} de lectura</span>
                <div className="flex gap-2">
                  {post.tags.map((t) => (
                    <span key={t} className={`text-zinc-600 ${t === decoded ? "text-cyan-500" : ""}`}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
