import Link from "next/link";
import { ALL_POSTS } from "@/lib/posts";
import { SITE_URL } from "@/lib/constants";
import BlogList, { getPaginatedPosts } from "@/components/BlogList";

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
            <div className="mt-4">
              <Link
                href="/tags"
                className="text-xs font-mono text-zinc-500 hover:text-cyan-400 transition-colors"
              >
                Explorar tags →
              </Link>
            </div>
          </header>

          <BlogList posts={getPaginatedPosts(1)} currentPage={1} />
        </div>
      </div>
    </>
  );
}
