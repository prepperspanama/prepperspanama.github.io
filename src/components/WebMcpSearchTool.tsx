"use client";

import { useEffect, useRef } from "react";
import Fuse from "fuse.js";
import { getWebMcpContext } from "@/lib/webmcp";

interface SearchItem {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string;
}

interface SearchBlogInput {
  query: string;
  maxResults?: number;
}

// Headless: no renderiza nada. Registra "searchBlog" como herramienta
// WebMCP apenas se monta, para que un agente de IA en el navegador pueda
// buscar en el blog sin tener que interpretar visualmente la página.
export default function WebMcpSearchTool() {
  const fuseRef = useRef<Fuse<SearchItem> | null>(null);

  useEffect(() => {
    const modelContext = getWebMcpContext();
    if (!modelContext) return;

    const ensureFuse = async (): Promise<Fuse<SearchItem>> => {
      if (fuseRef.current) return fuseRef.current;
      const res = await fetch("/search-index.json");
      const index: SearchItem[] = await res.json();
      const fuse = new Fuse(index, {
        keys: [
          { name: "title", weight: 3 },
          { name: "excerpt", weight: 1.5 },
          { name: "tags", weight: 2 },
          { name: "category", weight: 1.5 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.4,
      });
      fuseRef.current = fuse;
      return fuse;
    };

    modelContext.registerTool({
      name: "searchBlog",
      description:
        "Busca artículos del blog de Preppers Panamá por palabra clave (ej. 'terremoto', 'botiquín', 'kit de emergencia'). Devuelve título, resumen, categoría, fecha y URL de los artículos más relevantes.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Palabras clave a buscar" },
          maxResults: { type: "number", description: "Máximo de resultados a devolver (por defecto 5)" },
        },
        required: ["query"],
      },
      annotations: { readOnlyHint: true },
      async execute(input: SearchBlogInput) {
        const fuse = await ensureFuse();
        const results = fuse
          .search(input.query)
          .slice(0, input.maxResults ?? 5)
          .map((r) => ({
            title: r.item.title,
            excerpt: r.item.excerpt,
            category: r.item.category,
            date: r.item.date,
            url: `https://prepperspanama.github.io/blog/${r.item.slug}/`,
          }));
        return { results };
      },
    });

    return () => {
      modelContext.unregisterTool?.("searchBlog");
    };
  }, []);

  return null;
}
