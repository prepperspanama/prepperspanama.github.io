// Genera public/panama-faults.json: fallas activas de Panamá y alrededores,
// recortadas de la GEM Global Active Faults Database (Styron & Pagani, 2020;
// CC BY-SA 4.0). No corre en cada build: es un dataset de referencia que casi
// no cambia, así que se regenera a mano con `bun scripts/fetch-panama-faults.mjs`.
import fs from "node:fs";

const SOURCE_URL =
  "https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson";
const OUT = new URL("../public/panama-faults.json", import.meta.url);

// Panamá más la franja marina (Cinturón Deformado del Norte, Zona de Fractura
// de Panamá) y el Darién colombiano.
const [W, S, E, N] = [-83.8, 5.0, -76.8, 10.5];
const inBox = ([x, y]) => x >= W && x <= E && y >= S && y <= N;
const round = (n) => Math.round(n * 1e4) / 1e4;

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`GEM GAF-DB respondió ${res.status}`);
const source = await res.json();

const features = [];
for (const f of source.features) {
  const lines =
    f.geometry?.type === "LineString" ? [f.geometry.coordinates]
      : f.geometry?.type === "MultiLineString" ? f.geometry.coordinates
        : [];
  if (!lines.some((line) => line.some(inBox))) continue;
  // Las fosas de subducción ya se dibujan en la capa de placas tectónicas.
  if (f.properties.slip_type === "Subduction_Thrust") continue;
  features.push({
    type: "Feature",
    properties: { name: f.properties.name ?? null, slip_type: f.properties.slip_type ?? null },
    geometry: {
      type: "MultiLineString",
      coordinates: lines.map((line) => line.map(([x, y]) => [round(x), round(y)])),
    },
  });
}

fs.writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`panama-faults.json: ${features.length} fallas`);
