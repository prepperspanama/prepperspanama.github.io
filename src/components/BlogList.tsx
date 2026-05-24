import Link from "next/link";
import { ALL_POSTS, Post } from "@/lib/posts";

export const POSTS_PER_PAGE = 6;

export function getPaginatedPosts(page: number) {
  const start = (page - 1) * POSTS_PER_PAGE;
  return ALL_POSTS.slice(start, start + POSTS_PER_PAGE);
}

export function getTotalPages() {
  return Math.ceil(ALL_POSTS.length / POSTS_PER_PAGE);
}

export default function BlogList({
  posts,
  currentPage,
}: {
  posts: Post[];
  currentPage: number;
}) {
  const totalPages = getTotalPages();

  return (
    <>
      <div className="grid md:grid-cols-2 gap-8">
        {posts.length > 0 ? (
          posts.map((post) => (
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
                  {post.tags.map((tag) => (
                    <span key={tag} className="text-zinc-600">
                      #{tag}
                    </span>
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

      {totalPages > 1 && (
        <nav className="mt-16 flex justify-center items-center gap-4" aria-label="Paginación">
          {currentPage > 1 && (
            <Link
              href={currentPage === 2 ? "/blog" : `/blog/page/${currentPage - 1}`}
              className="px-4 py-2 text-sm font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 rounded-lg hover:text-cyan-400 hover:border-cyan-700 transition-colors"
            >
              ← Anterior
            </Link>
          )}

          <div className="flex gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const href = p === 1 ? "/blog" : `/blog/page/${p}`;
              const isCurrent = p === currentPage;
              return isCurrent ? (
                <span
                  key={p}
                  className="px-3 py-2 text-sm font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800 rounded-lg"
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={href}
                  className="px-3 py-2 text-sm font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 rounded-lg hover:text-cyan-400 hover:border-cyan-700 transition-colors"
                >
                  {p}
                </Link>
              );
            })}
          </div>

          {currentPage < totalPages && (
            <Link
              href={`/blog/page/${currentPage + 1}`}
              className="px-4 py-2 text-sm font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 rounded-lg hover:text-cyan-400 hover:border-cyan-700 transition-colors"
            >
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
