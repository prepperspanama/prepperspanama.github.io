import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mapa Satelital GOES-19",
  description:
    "Mapa interactivo de Panamá con imágenes satelitales en tiempo real del satélite GOES-19 de la NOAA",
  alternates: {
    canonical: "/mapa/",
  },
};

import MapContainer from "./MapContainer";

export default function MapaPage() {
  return (
    <div className="bg-zinc-950 min-h-screen flex flex-col">
      <div className="border-b border-zinc-800/60 bg-zinc-900/30 px-4 py-5 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-cyan-600 font-mono text-xs uppercase tracking-widest">
                NOAA / NESDIS
              </span>
              <span className="flex items-center gap-1.5 bg-green-900/30 border border-green-800/50 text-green-400 text-xs font-mono px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                EN VIVO
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Mapa Satelital{" "}
              <span className="text-cyan-400">GOES-19</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Imágenes satelitales GOES-19 · Actualización cada 5 min
            </p>
          </div>
        </div>
      </div>

      <MapContainer />


    </div>
  );
}
