import dynamic from "next/dynamic"

const QuoteSection = dynamic(() => import("@/components/HomeSections").then(mod => mod.QuoteSection), { ssr: true })
const PillarsSection = dynamic(() => import("@/components/HomeSections").then(mod => mod.PillarsSection), { ssr: true })
const BlogSection = dynamic(() => import("@/components/HomeSections").then(mod => mod.BlogSection), { ssr: true })
const CtaSection = dynamic(() => import("@/components/HomeSections").then(mod => mod.CtaSection), { ssr: true })


export default function Home() {
  return (
    <div className="bg-zinc-950">

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden border-b border-zinc-800/60">
        <div className="absolute inset-0 z-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(8,145,178,0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(8,145,178,0.15) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-900/20 rounded-full blur-[120px] z-0" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-cyan-950/30 rounded-full blur-[80px] z-0" />

        <div className="max-w-6xl mx-auto px-4 relative z-10 py-20">
          <div className="max-w-3xl">

            <h1 className="text-6xl md:text-8xl font-black text-white leading-none mb-6 tracking-tighter animate-fade-in-up delay-100">
              PREPPERS{" "}
              <span className="text-shimmer">PANAMÁ</span>
            </h1>

            <p className="text-xl md:text-2xl text-zinc-400 mb-10 leading-relaxed font-light animate-fade-in-up delay-200">
              Fomentando la{" "}
              <span className="text-zinc-200 font-medium">resiliencia soberana</span>.{" "}
              Tecnologías de comunicación, supervivencia y preparación táctica en el trópico.
            </p>


          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent z-10" />
      </section>


      {/* ── Lazy loaded sections below the fold ──────────── */}
      <QuoteSection />
      <PillarsSection />
      <BlogSection />
      <CtaSection />
    </div>
  )
}
