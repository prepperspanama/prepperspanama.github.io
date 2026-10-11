import Link from "next/link"

export const metadata = {
  title: "Licencia GPL-3.0",
  description: "GNU General Public License v3.0 — términos y condiciones de uso del sitio.",
  alternates: {
    canonical: "/license/",
  },
}

export default function LicensePage() {
  return (
    <div className="bg-zinc-950 min-h-screen pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        <header className="mb-12">
          <Link
            href="/"
            className="text-xs font-mono text-zinc-500 hover:text-cyan-400 transition-colors mb-6 inline-block"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
            Licencia
          </h1>
          <p className="text-zinc-400 text-lg font-light">
            Este sitio y su contenido están protegidos bajo la{" "}
            <span className="text-zinc-200 font-medium">GNU General Public License v3.0</span>.
          </p>
        </header>

        <div className="prose prose-invert prose-zinc max-w-none">
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8 md:p-10 space-y-6 text-zinc-300 text-sm leading-relaxed">

            <h2 className="text-white text-xl font-bold">GNU GENERAL PUBLIC LICENSE</h2>
            <p className="text-zinc-500 text-xs font-mono">Version 3, 29 June 2007</p>

            <div className="border-l-4 border-cyan-800/50 pl-5 py-2 bg-zinc-950/50 rounded-r-xl">
              <p className="italic text-zinc-400">
                &quot;Esta es una copia literal y completa de la licencia, en su versión oficial en inglés.
                Para la versión traducida no oficial, consulte el sitio de la FSF.&quot;
              </p>
            </div>

            <h3 className="text-cyan-400 font-bold text-base">Resumen</h3>

            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-green-500 shrink-0 mt-0.5">✔</span>
                <span><strong className="text-white">Libertad de uso:</strong> Puede usar este software para cualquier propósito.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-green-500 shrink-0 mt-0.5">✔</span>
                <span><strong className="text-white">Libertad de modificación:</strong> Puede modificar el código para sus necesidades.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-green-500 shrink-0 mt-0.5">✔</span>
                <span><strong className="text-white">Libertad de distribución:</strong> Puede redistribuir copias del software.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-500 shrink-0 mt-0.5">!</span>
                <span><strong className="text-white">Misma licencia:</strong> Las obras derivadas deben distribuirse bajo GPL-3.0.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-500 shrink-0 mt-0.5">!</span>
                <span><strong className="text-white">Sin garantía:</strong> Este software se proporciona &quot;tal cual&quot;, sin garantía de ningún tipo.</span>
              </li>
            </ul>

            <hr className="border-zinc-800" />

            <h3 className="text-cyan-400 font-bold text-base">Términos y Condiciones Completos</h3>

            <p>
              El texto completo de la GNU General Public License v3.0 está disponible en el
              archivo <code className="text-cyan-300 bg-zinc-950 px-1.5 py-0.5 rounded text-xs">LICENSE</code> de este repositorio, o en línea en:
            </p>

            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-zinc-700 hover:decoration-cyan-600 transition-all font-mono text-xs"
            >
              https://www.gnu.org/licenses/gpl-3.0.html
            </a>

            <div className="bg-zinc-950/70 border border-zinc-800/60 rounded-2xl p-6 font-mono text-xs text-zinc-400 whitespace-pre-line leading-relaxed">
              {`                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                        Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.`}
            </div>

            <p className="text-zinc-500 text-xs">
              Esta página contiene un resumen informativo y extractos de la GPL-3.0.
              El texto legal completo prevalece sobre cualquier resumen aquí presentado.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
