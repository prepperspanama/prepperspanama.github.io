import Link from "next/link";
import { ALL_POSTS } from "@/lib/posts";

export default function RelatedPosts({ currentSlug, tags }: { currentSlug: string; tags: string[] }) {
  const related = ALL_POSTS
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({
      post: p,
      score: p.tags.filter((t) => tags.includes(t)).length,
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((p) => p.post);

  if (related.length === 0) return null;

  return (
    <div className="mt-20 pt-10 border-t border-zinc-800/60">
      <h3 className="text-white font-bold mb-6">Artículos Relacionados</h3>
      <div className="grid md:grid-cols-2 gap-6">
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group p-6 rounded-2xl bg-zinc-900/20 border border-zinc-800/40 hover:border-cyan-900/60 transition-all"
          >
            <div className="flex gap-3 mb-3">
              <span className="text-[10px] font-mono text-cyan-500 border border-cyan-500/30 px-2 py-0.5 rounded uppercase">
                {post.category}
              </span>
              <span className="text-[10px] font-mono text-zinc-600 uppercase">{post.date}</span>
            </div>
            <h4 className="text-base font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
              {post.title}
            </h4>
            <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
