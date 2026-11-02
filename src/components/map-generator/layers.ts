// Capas del generador de mapas. Cada capa se consulta en vivo a su fuente
// (servicios del STRI, Overpass/OpenStreetMap) o lee un dataset de referencia
// horneado en public/, y define su estilo una sola vez para que la vista
// previa en Leaflet y la imagen exportada se vean iguales.
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type LayerId =
  | "provincias"
  | "cuencas"
  | "rios"
  | "areas"
  | "hidro"
  | "plantas"
  | "lineas"
  | "subestaciones"
  | "vias"
  | "salud"
  | "capitales"
  | "fallas"
  | "placas";

export interface FeatureStyle {
  stroke?: string;
  width?: number;
  fill?: string;
  fillOpacity?: number;
  dash?: number[];
  radius?: number;
}

export interface LegendEntry {
  label: string;
  kind: "line" | "fill" | "point";
  color: string;
  dash?: number[];
}

export interface LayerDef {
  id: LayerId;
  label: string;
  group: "Territorio" | "Agua" | "Energía" | "Servicios" | "Riesgo";
  source: string;
  load: () => Promise<FeatureCollection>;
  style: (f: Feature) => FeatureStyle;
  legend: LegendEntry[];
  // Texto del tooltip en la vista previa
  tooltip?: (f: Feature) => string | null;
  // Rótulo fijo en el mapa (vista previa y exportación)
  mapLabel?: (f: Feature) => string | null;
}

const STRI = "https://services2.arcgis.com/HRY6x8qt5qjGnAA9/arcgis/rest/services";
const OVERPASS = "https://overpass-api.de/api/interpreter";

type Props = Record<string, unknown>;
const prop = (f: Feature, k: string) => (f.properties as Props | null)?.[k];
const str = (f: Feature, k: string) => {
  const v = prop(f, k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

// ── Fuentes ───────────────────────────────────────────────────────────────

export async function arcgis(
  layer: string,
  {
    where = "1=1",
    fields = "*",
    simplify,
    geometry = true,
  }: { where?: string; fields?: string; simplify?: number; geometry?: boolean } = {},
): Promise<FeatureCollection> {
  const features: Feature[] = [];
  // Los servicios del STRI devuelven como máximo 2000 registros por consulta.
  for (let offset = 0; ; offset += 2000) {
    const params = new URLSearchParams({
      where,
      outFields: fields,
      outSR: "4326",
      f: "geojson",
      resultOffset: String(offset),
      resultRecordCount: "2000",
    });
    if (simplify) params.set("maxAllowableOffset", String(simplify));
    if (!geometry) params.set("returnGeometry", "false");
    const res = await fetch(`${STRI}/${layer}/query?${params}`);
    if (!res.ok) throw new Error(`STRI respondió ${res.status}`);
    const page = (await res.json()) as FeatureCollection & { properties?: { exceededTransferLimit?: boolean } };
    features.push(...page.features);
    if (page.features.length < 2000 && !page.properties?.exceededTransferLimit) break;
  }
  return { type: "FeatureCollection", features };
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

async function overpass(query: string): Promise<FeatureCollection> {
  const body = new URLSearchParams({
    data: `[out:json][timeout:90];area["ISO3166-1"="PA"][admin_level=2]->.pa;${query}`,
  });
  const res = await fetch(OVERPASS, { method: "POST", body });
  if (!res.ok) throw new Error(`Overpass respondió ${res.status}`);
  const { elements } = (await res.json()) as { elements: OverpassElement[] };
  const features: Feature[] = [];
  for (const e of elements) {
    let geometry: Geometry | null = null;
    if (e.geometry && e.geometry.length > 1) {
      geometry = { type: "LineString", coordinates: e.geometry.map((p) => [p.lon, p.lat]) };
    } else if (e.lat != null && e.lon != null) {
      geometry = { type: "Point", coordinates: [e.lon, e.lat] };
    } else if (e.center) {
      geometry = { type: "Point", coordinates: [e.center.lon, e.center.lat] };
    }
    if (geometry) features.push({ type: "Feature", properties: e.tags ?? {}, geometry });
  }
  return { type: "FeatureCollection", features };
}

async function local(path: string): Promise<FeatureCollection> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo leer ${path}`);
  return res.json();
}

// Cada capa se descarga una sola vez por visita, sin importar cuántas veces
// se prenda o se cambie de tipo de mapa.
const cache = new Map<LayerId, Promise<FeatureCollection>>();

export function loadLayer(def: LayerDef): Promise<FeatureCollection> {
  let p = cache.get(def.id);
  if (!p) {
    p = def.load().catch((err) => {
      cache.delete(def.id);
      throw err;
    });
    cache.set(def.id, p);
  }
  return p;
}

// ── Utilidades de estilo ──────────────────────────────────────────────────

function megawatts(text: unknown): number | null {
  const m = typeof text === "string" ? text.match(/[\d.,]+/) : null;
  return m ? parseFloat(m[0].replace(",", ".")) : null;
}

const PROVINCE_COLORS = [
  "#f4c7a1", "#c9e4b4", "#f7e3a3", "#b9d7ea", "#e6c3e0", "#f2b8b5", "#cfe8d8",
  "#fde2b8", "#d6d2f0", "#c2e0dc", "#f5d0c5", "#e2ecb5", "#d9c9b6", "#bcd4c1",
];

const PLANT_SOURCES: Record<string, { label: string; color: string }> = {
  hydro: { label: "Hidroeléctrica", color: "#1565c0" },
  solar: { label: "Solar", color: "#f9a825" },
  wind: { label: "Eólica", color: "#00897b" },
  gas: { label: "Gas natural", color: "#6a1b9a" },
  oil: { label: "Térmica (búnker/diésel)", color: "#5d4037" },
  coal: { label: "Carbón", color: "#212121" },
};

const VOLTAGES: Record<string, { label: string; color: string; width: number }> = {
  "230000": { label: "230 kV", color: "#c62828", width: 2.6 },
  "115000": { label: "115 kV", color: "#ef6c00", width: 1.8 },
};

const ROADS: Record<string, { label: string; color: string; width: number }> = {
  motorway: { label: "Autopista / corredor", color: "#b71c1c", width: 3 },
  trunk: { label: "Vía troncal (Panamericana y otras)", color: "#e65100", width: 2.2 },
  primary: { label: "Vía primaria", color: "#f9a825", width: 1.4 },
};

const HEALTH: Record<string, { label: string; color: string; radius: number }> = {
  HOSPITAL: { label: "Hospital", color: "#d32f2f", radius: 6 },
  "CENTRO DE SALUD": { label: "Centro de salud", color: "#1e88e5", radius: 3.5 },
  CLINICA: { label: "Clínica / policlínica", color: "#26a69a", radius: 2.5 },
  FARMACIA: { label: "Farmacia", color: "#90a4ae", radius: 2 },
};

const PROTECTED: Record<string, { label: string; color: string }> = {
  Land: { label: "Área protegida terrestre", color: "#4c9a2a" },
  "Land and Marine": { label: "Área protegida terrestre y marina", color: "#2a9d8f" },
  "100% Marine": { label: "Área protegida marina", color: "#3a86ff" },
};

const FAULT_FAMILIES: Record<string, { label: string; color: string }> = {
  inversa: { label: "Falla activa · inversa", color: "#e11d48" },
  rumbo: { label: "Falla activa · de rumbo", color: "#0891b2" },
  normal: { label: "Falla activa · normal", color: "#65a30d" },
  otra: { label: "Falla activa · sin clasificar", color: "#52525b" },
  geologica: { label: "Falla del mapa geológico 1990", color: "#8d8676" },
};

// ── Catálogo de capas ─────────────────────────────────────────────────────

export const LAYERS: LayerDef[] = [
  {
    id: "provincias",
    label: "Provincias y comarcas",
    group: "Territorio",
    source: "límites 2024 (STRI)",
    load: () => arcgis("Panama_Province_Boundaries_2024/FeatureServer/0", { fields: "Provincia", simplify: 0.0008 }),
    style: (f) => {
      const name = str(f, "Provincia") ?? "";
      const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PROVINCE_COLORS.length;
      return { stroke: "#6b6457", width: 1.2, fill: PROVINCE_COLORS[i], fillOpacity: 0.55 };
    },
    legend: [{ label: "Provincia / comarca", kind: "fill", color: "#e6c3e0" }],
    tooltip: (f) => str(f, "Provincia"),
    mapLabel: (f) => str(f, "Provincia"),
  },
  {
    id: "cuencas",
    label: "Cuencas hidrográficas",
    group: "Agua",
    source: "cuencas 2022 (STRI / MiAmbiente)",
    load: () =>
      arcgis("Watersheds_Panama_2022/FeatureServer/0", {
        fields: "Nom_Cuen_Hidro,Nom_Rio_Prin,Verti,Area_km2",
        simplify: 0.001,
      }),
    style: (f) => ({
      stroke: "#5b7083",
      width: 0.8,
      fill: prop(f, "Verti") === 1 ? "#8ec5e8" : "#a5d68f",
      fillOpacity: 0.35,
    }),
    legend: [
      { label: "Cuenca · vertiente del Caribe", kind: "fill", color: "#8ec5e8" },
      { label: "Cuenca · vertiente del Pacífico", kind: "fill", color: "#a5d68f" },
    ],
    tooltip: (f) => {
      const area = prop(f, "Area_km2");
      return `${str(f, "Nom_Cuen_Hidro") ?? "Cuenca"}${typeof area === "number" ? ` · ${Math.round(area).toLocaleString("es-PA")} km²` : ""}`;
    },
  },
  {
    id: "rios",
    label: "Ríos",
    group: "Agua",
    source: "red hidrográfica 2022 (STRI / MiAmbiente)",
    // Solo tramos de más de 4 km: la red completa tiene más de 200.000.
    load: () =>
      arcgis("Panama_Detailed_Stream_Network_2022/FeatureServer/6", {
        where: "TYPE='Río' AND Shape__Length>4000",
        fields: "NAME,STR_ORDER",
        simplify: 0.002,
      }),
    style: (f) => ({ stroke: "#2f6fa8", width: prop(f, "STR_ORDER") === 1 ? 2 : 1 }),
    legend: [{ label: "Río", kind: "line", color: "#2f6fa8" }],
    tooltip: (f) => str(f, "NAME"),
  },
  {
    id: "areas",
    label: "Áreas protegidas",
    group: "Territorio",
    source: "áreas protegidas 2025 (STRI / MiAmbiente)",
    load: () =>
      arcgis("Panama_AP_2025/FeatureServer/0", { fields: "LABEL,NOMBRE,CAT_MANEJO,TYPE,HECTARES", simplify: 0.001 }),
    style: (f) => {
      const c = PROTECTED[str(f, "TYPE") ?? "Land"]?.color ?? PROTECTED.Land.color;
      return { stroke: c, width: 1, fill: c, fillOpacity: 0.4 };
    },
    legend: Object.values(PROTECTED).map(({ label, color }) => ({ label, kind: "fill" as const, color })),
    tooltip: (f) => str(f, "LABEL") ?? str(f, "NOMBRE"),
  },
  {
    id: "hidro",
    label: "Hidroeléctricas y proyectos",
    group: "Energía",
    source: "hidroeléctricas (STRI)",
    load: () =>
      arcgis("Hydroelectric_Power_Plants/FeatureServer/0", { where: "Punto='ST'", fields: "Nombre,Estado,Cuenca" }),
    style: (f) =>
      str(f, "Estado") === "Proyecto Hidroeléctrico"
        ? { stroke: "#e65100", width: 2, fill: "#ffffff", fillOpacity: 1, radius: 5 }
        : { stroke: "#ffffff", width: 1.2, fill: "#1565c0", fillOpacity: 0.95, radius: 6 },
    legend: [
      { label: "Central hidroeléctrica", kind: "point", color: "#1565c0" },
      { label: "Proyecto hidroeléctrico", kind: "point", color: "#e65100" },
    ],
    tooltip: (f) => `${str(f, "Nombre") ?? "Hidroeléctrica"} · ${str(f, "Estado") ?? ""}${str(f, "Cuenca") ? ` · ${str(f, "Cuenca")}` : ""}`,
  },
  {
    id: "plantas",
    label: "Plantas de generación",
    group: "Energía",
    source: "plantas (OpenStreetMap)",
    load: () => overpass('nwr["power"="plant"](area.pa);out center tags;'),
    style: (f) => {
      const src = (str(f, "plant:source") ?? "").split(";")[0];
      const mw = megawatts(prop(f, "plant:output:electricity")) ?? 2;
      return {
        stroke: "#ffffff",
        width: 1,
        fill: PLANT_SOURCES[src]?.color ?? "#757575",
        fillOpacity: 0.9,
        radius: Math.min(16, 3 + Math.sqrt(mw) * 0.9),
      };
    },
    legend: Object.values(PLANT_SOURCES).map(({ label, color }) => ({ label, kind: "point" as const, color })),
    tooltip: (f) => {
      const src = (str(f, "plant:source") ?? "").split(";")[0];
      const out = str(f, "plant:output:electricity");
      return `${str(f, "name") ?? "Planta sin nombre"} · ${PLANT_SOURCES[src]?.label ?? "Otra"}${out ? ` · ${out}` : ""}`;
    },
  },
  {
    id: "lineas",
    label: "Líneas de transmisión",
    group: "Energía",
    source: "líneas eléctricas (OpenStreetMap)",
    load: () => overpass('way["power"="line"](area.pa);out geom tags;'),
    style: (f) => {
      const v = VOLTAGES[str(f, "voltage") ?? ""];
      return { stroke: v?.color ?? "#757575", width: v?.width ?? 1.2 };
    },
    legend: [
      ...Object.values(VOLTAGES).map(({ label, color }) => ({ label: `Línea ${label}`, kind: "line" as const, color })),
      { label: "Línea · tensión sin dato", kind: "line", color: "#757575" },
    ],
    tooltip: (f) => {
      const v = str(f, "voltage");
      return `${str(f, "name") ?? "Línea de transmisión"}${v ? ` · ${Number(v) / 1000} kV` : ""}${str(f, "operator") ? ` · ${str(f, "operator")}` : ""}`;
    },
  },
  {
    id: "subestaciones",
    label: "Subestaciones",
    group: "Energía",
    source: "subestaciones (OpenStreetMap)",
    load: () => overpass('nwr["power"="substation"](area.pa);out center tags;'),
    style: () => ({ stroke: "#263238", width: 1.4, fill: "#ffffff", fillOpacity: 1, radius: 3.5 }),
    legend: [{ label: "Subestación", kind: "point", color: "#263238" }],
    tooltip: (f) => str(f, "name") ?? "Subestación",
  },
  {
    id: "vias",
    label: "Red vial principal",
    group: "Territorio",
    source: "red vial (OpenStreetMap)",
    load: () => overpass('way["highway"~"^(motorway|trunk|primary)$"](area.pa);out geom tags;'),
    style: (f) => {
      const r = ROADS[str(f, "highway") ?? ""] ?? ROADS.primary;
      return { stroke: r.color, width: r.width };
    },
    legend: Object.values(ROADS).map(({ label, color }) => ({ label, kind: "line" as const, color })),
    tooltip: (f) => [str(f, "name"), str(f, "ref")].filter(Boolean).join(" · ") || null,
  },
  {
    id: "salud",
    label: "Instalaciones de salud",
    group: "Servicios",
    source: "instalaciones de salud (STRI)",
    load: () => arcgis("Instalaciones_de_Salud/FeatureServer/0", { fields: "NOMBRE,TIPO,PROV" }),
    style: (f) => {
      const h = HEALTH[str(f, "TIPO") ?? ""] ?? HEALTH.FARMACIA;
      return { stroke: "#ffffff", width: 0.8, fill: h.color, fillOpacity: 0.95, radius: h.radius };
    },
    legend: Object.values(HEALTH).map(({ label, color }) => ({ label, kind: "point" as const, color })),
    tooltip: (f) => `${str(f, "NOMBRE") ?? "Instalación"} · ${str(f, "TIPO")?.toLowerCase() ?? ""}`,
  },
  {
    id: "capitales",
    label: "Capitales y ciudades",
    group: "Territorio",
    source: "poblados (STRI)",
    load: () => arcgis("Populated_Places_Panama/FeatureServer/0", { where: "ORDEN<=2", fields: "LABEL,ORDEN,PROVINCIA" }),
    style: (f) =>
      prop(f, "ORDEN") === 1
        ? { stroke: "#ffffff", width: 1.2, fill: "#1f2933", fillOpacity: 1, radius: 4.5 }
        : { stroke: "#ffffff", width: 1, fill: "#52606d", fillOpacity: 1, radius: 2.5 },
    legend: [
      { label: "Capital de provincia", kind: "point", color: "#1f2933" },
      { label: "Cabecera de distrito", kind: "point", color: "#52606d" },
    ],
    tooltip: (f) => str(f, "LABEL"),
    mapLabel: (f) =>
      prop(f, "ORDEN") === 1
        ? (str(f, "LABEL") ?? "").replace("Panamá - Capital", "Ciudad de Panamá").replace("Ciudad de Colón", "Colón")
        : null,
  },
  {
    id: "fallas",
    label: "Fallas geológicas",
    group: "Riesgo",
    source: "GEM Global Active Faults y Mapa Geológico de Panamá 1990 (STRI)",
    load: () => local("/panama-faults.json"),
    style: (f) => {
      const fam = str(f, "familia") ?? "otra";
      return fam === "geologica"
        ? { stroke: FAULT_FAMILIES.geologica.color, width: 0.8, dash: [4, 3] }
        : { stroke: FAULT_FAMILIES[fam]?.color ?? FAULT_FAMILIES.otra.color, width: 2.2 };
    },
    legend: Object.entries(FAULT_FAMILIES).map(([k, { label, color }]) => ({
      label,
      kind: "line" as const,
      color,
      dash: k === "geologica" ? [4, 3] : undefined,
    })),
    tooltip: (f) => `${str(f, "nombre") ?? "Falla sin nombre"} · ${str(f, "tipo") ?? ""}`,
  },
  {
    id: "placas",
    label: "Placas tectónicas",
    group: "Riesgo",
    source: "placas PB2002 (Peter Bird, 2003)",
    load: () => local("/tectonic-plates.json"),
    style: (f) =>
      str(f, "Type") === "subduction"
        ? { stroke: "#f97316", width: 3 }
        : { stroke: "#ca8a04", width: 2, dash: [8, 5] },
    legend: [
      { label: "Límite de placa · subducción", kind: "line", color: "#f97316" },
      { label: "Otro límite de placa", kind: "line", color: "#ca8a04", dash: [8, 5] },
    ],
    tooltip: (f) => `${str(f, "PlateA") ?? ""} – ${str(f, "PlateB") ?? ""}`,
  },
];

// ── Mapas base (mosaicos de Esri con CORS, para poder exportar a imagen) ──

export interface Basemap {
  id: string;
  label: string;
  url: string;
  maxZoom: number;
  attribution: string;
}

export const BASEMAPS: Basemap[] = [
  {
    id: "relieve",
    label: "Relieve",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 13,
    attribution: "relieve © Esri",
  },
  {
    id: "claro",
    label: "Claro",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 16,
    attribution: "base © Esri, HERE, Garmin",
  },
  {
    id: "topo",
    label: "Topográfico",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
    attribution: "topografía © Esri y colaboradores",
  },
  {
    id: "satelite",
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
    attribution: "imágenes © Esri, Maxar, Earthstar Geographics",
  },
];

// ── Tipos de mapa predefinidos ────────────────────────────────────────────

export interface Preset {
  id: string;
  label: string;
  icon: string;
  title: string;
  basemap: string;
  layers: LayerId[];
}

export const PRESETS: Preset[] = [
  { id: "politico", label: "Político", icon: "🗺️", title: "Mapa político de Panamá", basemap: "claro", layers: ["provincias", "capitales"] },
  { id: "fisico", label: "Físico", icon: "⛰️", title: "Mapa físico de Panamá", basemap: "relieve", layers: ["rios", "capitales"] },
  { id: "hidrografico", label: "Hidrográfico", icon: "💧", title: "Mapa hidrográfico de Panamá", basemap: "claro", layers: ["cuencas", "rios", "capitales"] },
  { id: "hidroelectricas", label: "Hidroeléctricas", icon: "🌊", title: "Hidroeléctricas de Panamá", basemap: "relieve", layers: ["rios", "hidro", "capitales"] },
  { id: "electrico", label: "Red eléctrica", icon: "⚡", title: "Red de transmisión eléctrica de Panamá", basemap: "claro", layers: ["lineas", "subestaciones", "plantas", "capitales"] },
  { id: "vial", label: "Red vial", icon: "🛣️", title: "Red vial principal de Panamá", basemap: "claro", layers: ["vias", "capitales"] },
  { id: "areas", label: "Áreas protegidas", icon: "🌳", title: "Áreas protegidas de Panamá", basemap: "relieve", layers: ["areas", "capitales"] },
  { id: "salud", label: "Salud", icon: "🏥", title: "Instalaciones de salud de Panamá", basemap: "claro", layers: ["salud", "capitales"] },
  { id: "sismico", label: "Fallas y placas", icon: "🧭", title: "Fallas geológicas y placas tectónicas", basemap: "relieve", layers: ["fallas", "placas", "capitales"] },
];
