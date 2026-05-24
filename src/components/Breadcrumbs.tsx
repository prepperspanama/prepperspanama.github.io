import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-12">
      <ol className="flex items-center gap-2 text-xs font-mono text-zinc-500">
        <li>
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            Inicio
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-zinc-700">/</span>
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-cyan-400 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-zinc-300 truncate max-w-[200px] md:max-w-[400px]">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
