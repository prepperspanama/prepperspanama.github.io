"use client";

import dynamic from "next/dynamic";

const MapGenerator = dynamic(() => import("@/components/map-generator/MapGenerator"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[300px] bg-zinc-950 border-t border-zinc-800">
      <p className="text-zinc-400 text-sm font-mono">Cargando generador de mapas...</p>
    </div>
  ),
});

export default function MapGeneratorContainer() {
  return <MapGenerator />;
}
