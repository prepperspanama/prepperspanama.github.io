"use client";

import { useEffect, useState } from "react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const article = document.querySelector(".prose-prepper");
    if (!article) return;

    const headings = article.querySelectorAll("h2, h3");
    const tocItems: TOCItem[] = [];

    headings.forEach((h, index) => {
      const text = h.textContent ?? "";
      const id =
        text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/^-+|-+$/g, "") || `heading-${index}`;
      h.id = id;
      tocItems.push({
        id,
        text,
        level: h.tagName === "H2" ? 2 : 3,
      });
    });

    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setItems(tocItems);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  if (items.length < 2) return null;

  return (
    <nav className="mb-12 p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/40" aria-label="Tabla de contenidos">
      <p className="text-cyan-500 font-mono text-xs tracking-widest uppercase mb-4">Contenido</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level === 3 ? "1rem" : "0" }}>
            <a
              href={`#${item.id}`}
              className={`text-sm font-mono transition-colors ${
                activeId === item.id ? "text-cyan-400" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
