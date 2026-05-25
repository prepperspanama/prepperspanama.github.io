import { notFound } from "next/navigation";
import { ALL_POSTS } from "@/lib/posts";
import { SITE_URL } from "@/lib/constants";
import Link from "next/link";
import TableOfContents from "@/components/TableOfContents";
import RelatedPosts from "@/components/RelatedPosts";
import Breadcrumbs from "@/components/Breadcrumbs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ALL_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = ALL_POSTS.find((p) => p.slug === slug);
  if (!post) return {};

  const ogImage = post.ogImage || "/logo.webp";

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
      url: `${SITE_URL}/blog/${post.slug}/`,
      images: [{ url: `${SITE_URL}${ogImage}`, width: 1200, height: 630 }],
    },
    twitter: {
      title: post.title,
      description: post.excerpt,
      card: "summary_large_image",
      images: [`${SITE_URL}${ogImage}`],
    },
    alternates: {
      canonical: `/blog/${post.slug}/`,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = ALL_POSTS.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  const { default: Content } = await import(`../../../content/blog/${slug}.mdx`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.dateISO,
    author: {
      "@type": "Person",
      name: "Preppers Panamá",
    },
    publisher: {
      "@type": "Organization",
      name: "Preppers Panamá",
    },
    image: post.ogImage || `${SITE_URL}/logo.webp`,
    url: `${SITE_URL}/blog/${post.slug}/`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}/`,
    },
    keywords: post.tags.join(", "),
    articleSection: post.category,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="bg-zinc-950 min-h-screen pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4">
        <Breadcrumbs
          items={[
            { label: "Blog", href: "/blog" },
            { label: post.category, href: `/blog/categoria/${post.category.toLowerCase()}` },
            { label: post.title },
          ]}
        />

        <header className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-xs font-mono text-cyan-500 uppercase tracking-widest px-2 py-1 bg-cyan-950/40 rounded border border-cyan-800/50">
              {post.category}
            </span>
            <span className="text-zinc-500 text-xs font-mono">
              {post.date} • {post.readTime}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight">
            {post.title}
          </h1>
        </header>

        <TableOfContents />

        <div className="prose prose-invert prose-prepper max-w-none">
          <Content />
        </div>

        <div className="mt-10 pt-10 border-t border-zinc-800/60">
          <h3 className="text-white font-bold mb-4">Tags</h3>
          <div className="flex gap-2 flex-wrap">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog/tag/${tag.toLowerCase()}`}
                className="text-sm font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 hover:text-cyan-400 hover:border-cyan-800 transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>

        <RelatedPosts currentSlug={slug} tags={post.tags} />

        {/* ShareButtons */}
        <div className="flex items-center gap-3 mt-8 pt-8 border-t border-zinc-800/40">
          <span className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Compartir</span>
          {[
            { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(post.title)}%20${encodeURIComponent(`${SITE_URL}/blog/${post.slug}/`)}`, icon: "📱" },
            { name: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`${SITE_URL}/blog/${post.slug}/`)}`, icon: "✕" },
            { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE_URL}/blog/${post.slug}/`)}`, icon: "📘" },
          ].map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-cyan-400 transition-colors text-lg"
              aria-label={link.name}
              title={link.name}
            >
              {link.icon}
            </a>
          ))}
        </div>
      </div>
    </article>
    </>
  );
}
