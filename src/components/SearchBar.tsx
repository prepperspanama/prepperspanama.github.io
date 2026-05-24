"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Fuse from "fuse.js";

interface SearchItem {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/search-index.json")
      .then((r) => r.json())
      .then(setIndex);
  }, []);

  const fuse = useMemo(
    () =>
      index.length > 0
        ? new Fuse(index, {
            keys: [
              { name: "title", weight: 3 },
              { name: "excerpt", weight: 1.5 },
              { name: "tags", weight: 2 },
              { name: "category", weight: 1.5 },
              { name: "content", weight: 1 },
            ],
            threshold: 0.4,
            includeScore: true,
          })
        : null,
    [index]
  );

  const results = useMemo(() => {
    if (!fuse || !query.trim()) return [];
    return fuse.search(query).slice(0, 6).map((r) => r.item);
  }, [fuse, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(() => {
    setQuery("");
    setOpen(false);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          placeholder="Buscar…  (⌘K)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim()) setOpen(true); }}
          onFocus={() => { if (results.length) setOpen(true); }}
          className="w-48 lg:w-64 pl-8 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/30 transition-colors font-mono"
          aria-label="Buscar artículos"
          autoComplete="off"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full right-0 mt-2 w-80 lg:w-96 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[100]">
          <div className="max-h-96 overflow-y-auto">
            {results.map((item) => (
              <Link
                key={item.slug}
                href={`/blog/${item.slug}`}
                onClick={handleSelect}
                className="block px-4 py-3 hover:bg-zinc-800/60 transition-colors border-b border-zinc-800 last:border-b-0"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest px-1.5 py-0.5 bg-cyan-950/40 rounded border border-cyan-800/50">
                    {item.category}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{item.date}</span>
                </div>
                <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{item.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
