import { notFound } from "next/navigation";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import Breadcrumbs from "@/components/Breadcrumbs";
import BlogList, { getPaginatedPosts, getTotalPages } from "@/components/BlogList";

interface PageProps {
  params: Promise<{ page: string }>;
}

export async function generateStaticParams() {
  const total = getTotalPages();
  const pages = Math.max(total, 1);
  return Array.from({ length: pages }, (_, i) => ({
    page: String(i + 2),
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { page } = await params;
  const pageNum = Number(page);

  if (!Number.isInteger(pageNum) || pageNum < 2 || pageNum > getTotalPages()) {
    return {};
  }

  return {
    title: `Blog — Página ${pageNum} | Preppers Panamá`,
    description: `Artículos sobre preparación, tecnología y supervivencia — Página ${pageNum}.`,
    alternates: {
      canonical: `/blog/page/${pageNum}/`,
    },
  };
}

export default async function BlogPagePaginated({ params }: PageProps) {
  const { page } = await params;
  const pageNum = Number(page);

  if (!Number.isInteger(pageNum) || pageNum < 2) {
    notFound();
  }

  const posts = getPaginatedPosts(pageNum);
  const totalPages = getTotalPages();
  const isBeyondLastPage = pageNum > totalPages;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `Blog — Página ${pageNum} | Preppers Panamá`,
    description: `Artículos sobre preparación, tecnología y supervivencia — Página ${pageNum}.`,
    url: `${SITE_URL}/blog/page/${pageNum}/`,
    blogPost: posts.map((post) => ({
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
          <Breadcrumbs
            items={[
              { label: "Blog", href: "/blog" },
              { label: `Página ${pageNum}` },
            ]}
          />

          <header className="mb-16">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
              BLOG
            </h1>
            {!isBeyondLastPage && (
              <p className="text-zinc-400 text-xl font-light max-w-2xl font-mono">
                Página {pageNum} de {totalPages}
              </p>
            )}
          </header>

          {isBeyondLastPage ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mb-2">
                No hay más artículos
              </p>
              <Link
                href="/blog"
                className="text-cyan-500 font-mono text-xs hover:text-cyan-400 transition-colors"
              >
                ← Volver a la página 1
              </Link>
            </div>
          ) : (
            <BlogList posts={posts} currentPage={pageNum} />
          )}
        </div>
      </div>
    </>
  );
}
