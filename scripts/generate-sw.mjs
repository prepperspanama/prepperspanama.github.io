import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

function loadAllSlugs() {
  const contentDir = join(process.cwd(), "src/content/blog");
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));
  return files.map((f) => f.replace(/\.mdx$/, ""));
}

const slugs = loadAllSlugs();

const postUrls = slugs.map((slug) => `  '/blog/${slug}/'`).join(",\n");

const sw = `const CACHE_NAME = 'preppers-panama-v2';
const STATIC_ASSETS = [
  '/',
  '/blog/',
  '/mapa/',
${postUrls},
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.origin.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
`;

writeFileSync(join(process.cwd(), "public", "sw.js"), sw, "utf-8");
console.log(`✓ SW generated at public/sw.js (${slugs.length} posts)`);
