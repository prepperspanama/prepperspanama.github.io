import type { MetadataRoute } from "next";
import { ALL_POSTS } from "@/lib/posts";
import { SITE_URL } from "@/lib/constants";
import { getTotalPages } from "@/components/BlogList";

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseSpanishDate(dateStr: string): Date {
  const match = dateStr.match(/(\d+)\s+de\s+(\w+),\s+(\d{4})/);
  if (!match) return new Date();
  const [, day, monthStr, year] = match;
  return new Date(Number(year), MONTHS[monthStr.toLowerCase()] ?? 0, Number(day));
}

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 1 },
    { url: `${SITE_URL}/blog/`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE_URL}/mapa/`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.5 },
  ];

  const totalPages = getTotalPages();
  const paginationPages = totalPages > 1
    ? Array.from({ length: totalPages - 1 }, (_, i) => ({
        url: `${SITE_URL}/blog/page/${i + 2}/`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
    : [];

  const blogPosts = ALL_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}/`,
    lastModified: parseSpanishDate(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...paginationPages, ...blogPosts];
}
