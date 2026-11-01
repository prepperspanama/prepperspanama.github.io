// Genera public/panama-faults.json combinando dos fuentes:
//   - Fallas activas de la GEM Global Active Faults Database (Styron & Pagani,
//     2020; CC BY-SA 4.0), recortadas a Panamá y alrededores.
//   - Fallas del Mapa Geológico de Panamá 1:250.000 (Dirección General de
//     Recursos Minerales, 1990), digitalizado por el STRI (CC BY-SA 4.0). Son
//     mucho más detalladas, pero no implican actividad reciente.
// No corre en cada build: son datasets de referencia que casi no cambian, así
// que se regenera a mano con `bun scripts/fetch-panama-faults.mjs`.
import fs from "node:fs";

const GEM_URL =
  "https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson";
const STRI_URL =
  "https://services2.arcgis.com/HRY6x8qt5qjGnAA9/arcgis/rest/services/Geologia_Panama/FeatureServer";
const OUT = new URL("../public/panama-faults.json", import.meta.url);

// Panamá más la franja marina (Cinturón Deformado del Norte, Zona de Fractura
// de Panamá) y el Darién colombiano.
const [W, S, E, N] = [-83.8, 5.0, -76.8, 10.5];
const inBox = ([x, y]) => x >= W && x <= E && y >= S && y <= N;
const round = (n) => Math.round(n * 1e4) / 1e4;
const roundLines = (lines) => lines.map((line) => line.map(([x, y]) => [round(x), round(y)]));
const asLines = (geometry) =>
  geometry?.type === "LineString" ? [geometry.coordinates]
    : geometry?.type === "MultiLineString" ? geometry.coordinates
      : [];

// ── GEM ──────────────────────────────────────────────────────────────────

// Nombres en español. Las fallas fuera de Panamá llevan el país para que no
// se confundan con estructuras panameñas.
const GEM_NAMES = {
  "SANSON FAULT": "Falla de Sansón",
  "PIERRE HILLS FAULT SYSTEM": "Sistema de fallas de la Serranía del Pirre",
  "JAQUE RIVER FAULT": "Falla del río Jaqué",
  "Rio Gatun Fault": "Falla del río Gatún",
  "Atirro Fault": "Falla de Atirro (Costa Rica)",
  "Siquirres-Matina Fault": "Falla Siquirres-Matina (Costa Rica)",
  "Azul Fault": "Falla Azul (Costa Rica)",
  "Kababeta Fault": "Falla Kababeta (Costa Rica)",
  "Longitudinal Fault": "Falla Longitudinal",
  "Falla Canoas": "Falla de Canoas",
  "Zona Falla Media": "Zona de Falla Media",
  "Falla Longitudinal-Boca Chica": "Falla Longitudinal-Boca Chica",
  "Azuero Fault": "Falla de Azuero",
  "Rincon Hondo Fault": "Falla de Rincón Hondo",
  "Limon Fault": "Falla de Limón",
  "Pedro Miguel Fault": "Falla de Pedro Miguel",
  "North Panama Deformed Belt": "Cinturón Deformado del Norte de Panamá",
  "Murindo": "Falla de Murindó (Colombia)",
  "Falla de Los Saltos": "Falla de Los Saltos (Colombia)",
  "Bahia solano": "Falla de Bahía Solano (Colombia)",
  "Falla Utria": "Falla de Utría (Colombia)",
};

// Trazas sin nombre en GEM que sí se identifican por su posición.
const GEM_NAMES_BY_ID = {
  ATA_6: "Cinturón Deformado del Norte de Panamá (sector oriental)",
  ATA_444: "Zona de Fractura de Panamá",
  ATA_445: "Zona de Fractura de Panamá",
};

// Tramos repetidos entre catálogos: se conserva el centroamericano (CCAF-DB),
// que es el más detallado para Panamá.
const GEM_DUPLICATES = new Set([
  "ATA_393", // Río Gatún del catálogo andino, encima de CA_242
]);

const SLIP_TYPES = {
  Reverse: ["Inversa", "inversa"],
  Normal: ["Normal", "normal"],
  Dextral: ["De rumbo dextral", "rumbo"],
  Sinistral: ["De rumbo sinestral", "rumbo"],
  Dextral_Transform: ["Transformante dextral", "rumbo"],
  Sinistral_Transform: ["Transformante sinestral", "rumbo"],
  "Dextral-Normal": ["De rumbo dextral con componente normal", "rumbo"],
  "Sinistral-Normal": ["De rumbo sinestral con componente normal", "rumbo"],
  "Sinistral-Reverse": ["De rumbo sinestral con componente inversa", "rumbo"],
};

async function gemFaults() {
  const res = await fetch(GEM_URL);
  if (!res.ok) throw new Error(`GEM GAF-DB respondió ${res.status}`);
  const source = await res.json();

  const features = [];
  for (const f of source.features) {
    const lines = asLines(f.geometry);
    if (!lines.some((line) => line.some(inBox))) continue;
    const p = f.properties;
    // Las fosas de subducción ya se dibujan en la capa de placas tectónicas.
    if (p.slip_type === "Subduction_Thrust" || GEM_DUPLICATES.has(p.catalog_id)) continue;
    if (p.slip_type && !SLIP_TYPES[p.slip_type]) throw new Error(`Tipo de falla sin traducir: ${p.slip_type}`);
    if (p.name && !GEM_NAMES[p.name]) throw new Error(`Nombre de falla sin traducir: ${p.name}`);
    const [tipo, familia] = SLIP_TYPES[p.slip_type] ?? ["Cinemática desconocida", "otra"];
    features.push({
      type: "Feature",
      properties: {
        nombre: GEM_NAMES[p.name] ?? GEM_NAMES_BY_ID[p.catalog_id] ?? null,
        tipo,
        familia,
        fuente: "gem",
      },
      geometry: { type: "MultiLineString", coordinates: roundLines(lines) },
    });
  }
  return features;
}

// ── Mapa Geológico de Panamá (STRI) ──────────────────────────────────────

// Capa del servicio → cómo se describe cada traza. Las demás capas (pliegues,
// cornisas, contactos…) no son fallas.
const STRI_LAYERS = [
  { id: 3, tipo: () => "Normal" },
  { id: 4, tipo: () => "Interpretada (imágenes satelitales, radar y fotos aéreas)" },
  { id: 5, tipo: () => "De corrimiento" },
  {
    id: 9,
    where: "TECTONICA IN ('Falla','Falla Probable')",
    tipo: (p) => (p.TECTONICA === "Falla Probable" ? "Probable" : "Línea tectónica"),
  },
];

async function striLayer({ id, where = "1=1", tipo }) {
  const features = [];
  // El servicio devuelve como máximo 1000 registros por consulta.
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      where,
      outFields: "*",
      outSR: "4326",
      f: "geojson",
      resultOffset: String(offset),
      resultRecordCount: "1000",
    });
    const res = await fetch(`${STRI_URL}/${id}/query?${params}`);
    if (!res.ok) throw new Error(`STRI capa ${id} respondió ${res.status}`);
    const page = await res.json();
    for (const f of page.features) {
      const lines = asLines(f.geometry);
      if (lines.length === 0) continue;
      features.push({
        type: "Feature",
        properties: {
          nombre: f.properties.NOMBRE?.trim() || null,
          tipo: tipo(f.properties),
          familia: "geologica",
          fuente: "mgp",
        },
        geometry: { type: "MultiLineString", coordinates: roundLines(lines) },
      });
    }
    if (page.features.length < 1000) break;
  }
  return features;
}

const gem = await gemFaults();
const mgp = (await Promise.all(STRI_LAYERS.map(striLayer))).flat();

// Las trazas geológicas van primero para que las activas se dibujen encima.
fs.writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features: [...mgp, ...gem] }));
console.log(`panama-faults.json: ${gem.length} fallas activas (GEM) + ${mgp.length} trazas del mapa geológico`);
