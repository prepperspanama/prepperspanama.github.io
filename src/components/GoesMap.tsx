"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getWebMcpContext } from "@/lib/webmcp";

interface City {
  lat: number;
  lng: number;
  name: string;
}

interface GoesLayer {
  id: string;
  label: string;
  desc: string;
  tip: string;
  url: string;
  icon: string;
  opacity: number;
  attribution: string;
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  weather_code: number;
  precipitation: number;
  surface_pressure: number;
}

interface OpenMeteoDaily {
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  weather_code: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  uv_index_max: number[];
  sunrise: string[];
  sunset: string[];
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
  daily: OpenMeteoDaily;
}

interface CacheEntry {
  data: OpenMeteoResponse;
  ts: number;
}

interface UsgsQuakeProperties {
  mag: number | null;
  place: string | null;
  time: number;
  status: string;
  url: string;
}

interface UsgsQuakeFeature {
  id: string;
  properties: UsgsQuakeProperties;
  geometry: {
    coordinates: [number, number, number];
  };
}

interface UsgsQuakeResponse {
  features: UsgsQuakeFeature[];
}

interface QuakeCacheEntry {
  data: UsgsQuakeFeature[];
  ts: number;
}

interface NormalizedQuake {
  id: string;
  source: "usgs" | "igc-up";
  mag: number | null;
  place: string | null;
  time: number;
  status: string;
  lat: number;
  lon: number;
  depthKm: number | null;
  url: string;
}

interface IgcQuakesResponse {
  fetchedAt: string | null;
  quakes: NormalizedQuake[];
}

const GOES_LAYERS: GoesLayer[] = [
  {
    id: "geocolor",
    label: "GeoColor",
    desc: "Color verdadero · 1 km · NOAA",
    tip: "Imagen en color verdadero similar a lo que vería el ojo humano desde el espacio. Combina canales rojo, verde y azul (visibles) para mostrar nubes, tierra y océanos con colores naturales. Útil para identificación general de nubosidad y tormentas.",
    url: "https://satellitemaps.nesdis.noaa.gov/arcgis/rest/services/MERGED_GeoColor/ImageServer",
    icon: "🖼️",
    opacity: 0.85,
    attribution: "NOAA/NESDIS",
  },
  {
    id: "infrared",
    label: "Infrarrojo",
    desc: "Banda 13 Clean LWIR · 1 km · NOAA",
    tip: "Banda infrarroja térmica de onda larga (10.3 μm). Mide la temperatura de las nubes y la superficie terrestre. Las nubes más altas y frías aparecen más brillantes. Fundamental para identificar tormentas severas, frentes fríos y convección profunda incluso de noche.",
    url: "https://satellitemaps.nesdis.noaa.gov/arcgis/rest/services/ABI13_current/ImageServer",
    icon: "🌡️",
    opacity: 0.80,
    attribution: "NOAA/NESDIS",
  },
  {
    id: "vapor",
    label: "Vapor de Agua",
    desc: "Banda 10 WV · 1 km · NOAA",
    tip: "Banda de vapor de agua (7.3 μm). Detecta la concentración de humedad en la atmósfera media. Las regiones húmedas aparecen más claras; las secas, más oscuras. Esencial para rastrear ondas tropicales, zonas de confluencia y predecir la formación de tormentas.",
    url: "https://satellitemaps.nesdis.noaa.gov/arcgis/rest/services/ABI10_current/ImageServer",
    icon: "💧",
    opacity: 0.75,
    attribution: "NOAA/NESDIS",
  },
];

const PANAMA_CITIES: City[] = [
  { lat: 8.9943, lng: -79.5188, name: "Ciudad de Panamá" },
  { lat: 8.8776, lng: -79.7801, name: "La Chorrera" },
  { lat: 8.4269, lng: -82.4311, name: "David, Chiriquí" },
  { lat: 8.7729, lng: -82.6382, name: "Volcán, Chiriquí" },
  { lat: 8.7802, lng: -82.4414, name: "Boquete, Chiriquí" },
  { lat: 8.2763, lng: -82.8687, name: "Puerto Armuelles" },
  { lat: 9.3403, lng: -82.2420, name: "Bocas del Toro" },
  { lat: 9.4300, lng: -82.5200, name: "Changuinola" },
  { lat: 9.3589, lng: -79.8978, name: "Colón" },
  { lat: 8.1057, lng: -80.9711, name: "Santiago, Veraguas" },
  { lat: 8.5189, lng: -80.3573, name: "Penonomé, Coclé" },
  { lat: 8.6042, lng: -80.1414, name: "El Valle de Antón" },
  { lat: 8.2394, lng: -80.5484, name: "Aguadulce, Coclé" },
  { lat: 7.9601, lng: -80.4288, name: "Chitré, Herrera" },
  { lat: 7.7667, lng: -80.2833, name: "Las Tablas, Los Santos" },
  { lat: 8.4100, lng: -78.1500, name: "La Palma, Darién" },
];

function wmoToLabel(code: number): { emoji: string; desc: string } {
  if (code === 0) return { emoji: "☀️", desc: "Despejado" };
  if (code <= 3) return { emoji: "⛅", desc: "Parcialmente nublado" };
  if (code <= 49) return { emoji: "🌫️", desc: "Neblina / Niebla" };
  if (code <= 59) return { emoji: "🌦️", desc: "Llovizna" };
  if (code <= 69) return { emoji: "🌧️", desc: "Lluvia" };
  if (code <= 79) return { emoji: "🌨️", desc: "Nieve / Aguanieve" };
  if (code <= 84) return { emoji: "🌦️", desc: "Chubascos" };
  if (code <= 94) return { emoji: "⛈️", desc: "Tormenta" };
  return { emoji: "⛈️", desc: "Tormenta severa" };
}

function windDirToArrow(deg: number): string {
  const dirs = ["↑N", "↗NE", "→E", "↘SE", "↓S", "↙SO", "←O", "↖NO"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(index: number): string {
  if (index <= 2) return "Bajo";
  if (index <= 5) return "Moderado";
  if (index <= 7) return "Alto";
  if (index <= 10) return "Muy alto";
  return "Extremo";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const WEATHER_CACHE_KEY = "preppers-weather-cache";
const WEATHER_CACHE_TTL = 10 * 60 * 1000;

function getWeatherCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function setWeatherCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function fetchWeatherData(lat: number, lng: number): Promise<OpenMeteoResponse> {
  const key = `${lat},${lng}`;
  const now = Date.now();
  const cache = getWeatherCache();
  if (cache[key] && now - cache[key].ts < WEATHER_CACHE_TTL) {
    return cache[key].data;
  }
  const current = "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation,surface_pressure";
  const daily = "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=${current}&daily=${daily}&wind_speed_unit=kmh&timezone=America%2FPanama`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al obtener datos climáticos");
  const data: OpenMeteoResponse = await res.json();
  cache[key] = { data, ts: now };
  setWeatherCache(cache);
  return data;
}

function mkEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cssText: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.style.cssText = cssText;
  if (text !== undefined) el.textContent = text;
  return el;
}

function statCard(label: string, valueCss: string, valueText: string, subText: string): HTMLDivElement {
  const card = mkEl("div", "background:#18181b;border-radius:6px;padding:6px 8px");
  card.append(
    mkEl("div", "font-size:9px;color:#71717a;text-transform:uppercase;letter-spacing:0.08em", label),
    mkEl("div", valueCss, valueText),
    mkEl("div", "font-size:9px;color:#52525b", subText)
  );
  return card;
}

function buildPopupContent(cityName: string, d: OpenMeteoResponse): HTMLDivElement {
  const c = d.current;
  const day = d.daily;
  const { emoji, desc } = wmoToLabel(c.weather_code);
  const arrow = windDirToArrow(c.wind_direction_10m);
  const todayEmoji = wmoToLabel(day.weather_code[0]);
  const sunrise = formatTime(day.sunrise[0]);
  const sunset = formatTime(day.sunset[0]);

  const root = mkEl("div", "font-family:'Inter',monospace;min-width:230px;background:#09090b;border-radius:10px;overflow:hidden;border:1px solid #27272a");

  const header = mkEl("div", "background:linear-gradient(135deg,#0e7490,#0369a1);padding:10px 12px 8px");
  const headerRow = mkEl("div", "display:flex;justify-content:space-between;align-items:center;margin-top:2px");
  headerRow.append(
    mkEl("span", "font-size:11px;color:#bae6fd", `${emoji} ${desc}`),
    mkEl("span", "font-size:10px;color:#7dd3fc", "Ahora")
  );
  header.append(
    mkEl("div", "font-size:13px;font-weight:700;color:#fff;letter-spacing:0.02em", cityName),
    headerRow
  );

  const currentGrid = mkEl("div", "padding:8px 10px;display:grid;grid-template-columns:1fr 1fr;gap:4px");
  currentGrid.append(
    statCard("Temperatura", "font-size:18px;font-weight:700;color:#22d3ee", `${c.temperature_2m}°C`, `Sensación ${c.apparent_temperature}°`),
    statCard("Humedad", "font-size:16px;font-weight:700;color:#34d399", `${c.relative_humidity_2m}%`, `Precip. ${c.precipitation} mm`),
    statCard("Viento", "font-size:14px;font-weight:700;color:#fb923c", `${c.wind_speed_10m} km/h`, `${arrow} ${c.wind_direction_10m}°`),
    statCard("Presión", "font-size:14px;font-weight:700;color:#a78bfa", `${c.surface_pressure} hPa`, c.precipitation > 0 ? `🌧️ ${c.precipitation} mm` : "Sin lluvia")
  );

  const forecast = mkEl("div", "padding:6px 10px 4px;border-top:1px solid #27272a");
  const forecastGrid = mkEl("div", "display:grid;grid-template-columns:1fr 1fr;gap:4px");
  forecastGrid.append(
    statCard("Temp. máx/mín", "font-size:13px;font-weight:700;color:#fbbf24", `${day.temperature_2m_max[0]}° / ${day.temperature_2m_min[0]}°`, `${todayEmoji.emoji} ${todayEmoji.desc}`),
    statCard("Lluvia", "font-size:13px;font-weight:700;color:#60a5fa", `${day.precipitation_probability_max[0]}%`, `${day.precipitation_sum[0]} mm estimados`),
    statCard("Viento máx.", "font-size:13px;font-weight:700;color:#fb923c", `${day.wind_speed_10m_max[0]} km/h`, `${windDirToArrow(day.wind_direction_10m_dominant[0])} ${day.wind_direction_10m_dominant[0]}°`),
    statCard("Sol / UV", "font-size:11px;font-weight:700;color:#fcd34d", `${sunrise} — ${sunset}`, `☂️ UV ${day.uv_index_max[0]} (${uvLabel(day.uv_index_max[0])})`)
  );
  forecast.append(
    mkEl("div", "font-size:9px;color:#71717a;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;text-align:center", "Pronóstico del día"),
    forecastGrid
  );

  const footer = mkEl("div", "padding:4px 12px 8px;font-size:9px;color:#3f3f46;text-align:right", "Open-Meteo · Pronóstico del día");

  root.append(header, currentGrid, forecast, footer);
  return root;
}

function buildLoadingContent(cityName: string): HTMLDivElement {
  const el = mkEl("div", "font-family:monospace;font-size:11px;color:#a1a1aa;padding:6px 8px");
  const spinner = mkEl("span", "color:#22d3ee", "⌛");
  const strong = mkEl("b", "color:#fff", cityName);
  el.append(spinner, document.createTextNode(" Cargando datos de "), strong, document.createTextNode("…"));
  return el;
}

function buildErrorContent(): HTMLDivElement {
  return mkEl("div", "font-family:monospace;font-size:11px;color:#f87171;padding:6px 8px", "Error al obtener datos climáticos.");
}

// Caja que engloba Panamá y su plataforma sísmica continental, usada para
// acotar la consulta al catálogo del USGS a la región de interés.
const QUAKE_BBOX = { minLat: 6, maxLat: 10.5, minLon: -84, maxLon: -77 };
const QUAKE_MIN_MAGNITUDE = 2;
const QUAKE_CACHE_KEY_PREFIX = "preppers-quake-cache-";
const QUAKE_CACHE_TTL = 3 * 60 * 1000;

const QUAKE_RANGES = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
] as const;
type QuakeRangeDays = (typeof QUAKE_RANGES)[number]["days"];

function quakeRangeLabel(days: QuakeRangeDays): string {
  return QUAKE_RANGES.find((r) => r.days === days)?.label ?? `${days}d`;
}

function getQuakeCache(days: number): QuakeCacheEntry | null {
  try {
    const raw = localStorage.getItem(QUAKE_CACHE_KEY_PREFIX + days);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setQuakeCache(days: number, data: UsgsQuakeFeature[]) {
  try {
    localStorage.setItem(QUAKE_CACHE_KEY_PREFIX + days, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

async function fetchUsgsQuakes(days: number): Promise<UsgsQuakeFeature[]> {
  const cache = getQuakeCache(days);
  if (cache && Date.now() - cache.ts < QUAKE_CACHE_TTL) {
    return cache.data;
  }
  const starttime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${starttime}&minlatitude=${QUAKE_BBOX.minLat}&maxlatitude=${QUAKE_BBOX.maxLat}&minlongitude=${QUAKE_BBOX.minLon}&maxlongitude=${QUAKE_BBOX.maxLon}&minmagnitude=${QUAKE_MIN_MAGNITUDE}&orderby=time`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al obtener datos sísmicos");
  const json: UsgsQuakeResponse = await res.json();
  setQuakeCache(days, json.features);
  return json.features;
}

function usgsToNormalized(f: UsgsQuakeFeature): NormalizedQuake {
  const [lon, lat, depthKm] = f.geometry.coordinates;
  return {
    id: `usgs-${f.id}`,
    source: "usgs",
    mag: f.properties.mag,
    place: f.properties.place,
    time: f.properties.time,
    status: f.properties.status,
    lat,
    lon,
    depthKm: depthKm ?? null,
    url: f.properties.url,
  };
}

// Generado en build-time por scripts/fetch-igc-quakes.mjs a partir de la
// tabla pública del Instituto de Geociencias de la Universidad de Panamá
// (IGC-UP, la red sísmica nacional). Es un archivo estático same-origin
// porque esa página no tiene API ni CORS para leerse directo del navegador.
async function fetchIgcQuakes(days: number): Promise<NormalizedQuake[]> {
  try {
    const res = await fetch("/quakes-igc.json");
    if (!res.ok) return [];
    const json: IgcQuakesResponse = await res.json();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return json.quakes.filter((q) => q.time >= cutoff);
  } catch {
    return [];
  }
}

const DEDUPE_TIME_MS = 5 * 60 * 1000;
const DEDUPE_DIST_KM = 50;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// IGC-UP es la red local y detecta sismos menores que USGS no reporta, así
// que se conservan todos sus eventos. De USGS solo se agregan los que no
// coincidan en tiempo y ubicación con uno ya reportado por IGC-UP, para no
// mostrar el mismo sismo duplicado con dos íconos.
function mergeQuakes(igc: NormalizedQuake[], usgs: NormalizedQuake[]): NormalizedQuake[] {
  const usgsUnique = usgs.filter(
    (u) =>
      !igc.some(
        (i) => Math.abs(i.time - u.time) <= DEDUPE_TIME_MS && haversineKm(i.lat, i.lon, u.lat, u.lon) <= DEDUPE_DIST_KM
      )
  );
  return [...igc, ...usgsUnique];
}

function quakeColor(mag: number | null): string {
  const m = mag ?? 0;
  if (m >= 6) return "#ef4444";
  if (m >= 4.5) return "#f97316";
  if (m >= 3) return "#facc15";
  return "#4ade80";
}

function quakeRadius(mag: number | null): number {
  return Math.max(4, (mag ?? 1) * 2.6);
}

function formatQuakeTime(ms: number): string {
  return new Date(ms).toLocaleString("es-PA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function quakeTimeAgo(ms: number): string {
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return "hace instantes";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  return `hace ${Math.floor(diffHours / 24)} d`;
}

function buildQuakePopupContent(q: NormalizedQuake, onCenter: () => void): HTMLDivElement {
  const { mag, place, time, status, depthKm, url, source } = q;
  const color = quakeColor(mag);
  const sourceLabel = source === "igc-up" ? "IGC-UP (Panamá)" : "USGS";

  const root = mkEl("div", "font-family:'Inter',monospace;min-width:210px;background:#09090b;border-radius:10px;overflow:hidden;border:1px solid #27272a");

  const header = mkEl("div", `background:${color};padding:8px 12px`);
  header.appendChild(mkEl("div", "font-size:16px;font-weight:800;color:#09090b", `M ${mag != null ? mag.toFixed(1) : "N/D"}`));

  const body = mkEl("div", "padding:8px 10px");
  body.append(
    mkEl("div", "font-size:12px;color:#e4e4e7;font-weight:600;margin-bottom:4px", place ?? "Ubicación desconocida"),
    mkEl("div", "font-size:10px;color:#a1a1aa", `${formatQuakeTime(time)} · ${quakeTimeAgo(time)}`),
    mkEl(
      "div",
      "font-size:10px;color:#71717a;margin-top:2px",
      `Profundidad: ${depthKm != null ? depthKm.toFixed(1) + " km" : "N/D"} · ${status === "reviewed" ? "Revisado" : "Preliminar"}`
    ),
    mkEl("div", "font-size:9px;color:#52525b;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em", `Fuente: ${sourceLabel}`)
  );

  const actions = mkEl("div", "display:flex;gap:10px;margin-top:8px");

  const centerBtn = document.createElement("button");
  centerBtn.type = "button";
  centerBtn.textContent = "Centrar aquí";
  centerBtn.style.cssText = "font-size:10px;color:#a1a1aa;background:none;border:none;padding:0;cursor:pointer;text-decoration:underline;font-family:inherit";
  centerBtn.addEventListener("click", onCenter);

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Ver detalle →";
  link.style.cssText = "font-size:10px;color:#22d3ee;text-decoration:none";

  actions.append(centerBtn, link);
  body.appendChild(actions);

  root.append(header, body);
  return root;
}

type LeafletInstance = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletLayerGroup = import("leaflet").LayerGroup;
type LeafletTileLayer = import("leaflet").TileLayer;
type LeafletCircleMarker = import("leaflet").CircleMarker;

// Mantiene la URL en sync con el centro/zoom/canal actuales del mapa, para
// que copiar el enlace del navegador siempre comparta la vista exacta que
// se está viendo. Usa replaceState (no pushState) para no ensuciar el
// historial de navegación con una entrada por cada pan/zoom.
function updateShareUrl(map: LeafletMap, layerId: string) {
  try {
    const center = map.getCenter();
    const url = new URL(window.location.href);
    url.searchParams.set("lat", center.lat.toFixed(4));
    url.searchParams.set("lng", center.lng.toFixed(4));
    url.searchParams.set("zoom", String(map.getZoom()));
    url.searchParams.set("layer", layerId);
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

const MAP_PREFS_KEY = "preppers-map-prefs";

interface MapPrefs {
  layerId: string;
  opacity: number;
  showWeather: boolean;
  showQuakes: boolean;
  quakeRangeDays: QuakeRangeDays;
}

function loadMapPrefs(): Partial<MapPrefs> {
  try {
    const raw = localStorage.getItem(MAP_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveMapPrefs(prefs: MapPrefs) {
  try {
    localStorage.setItem(MAP_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

const ORIGIN_X = -20037508.342789244;
const ORIGIN_Y = 20037508.342789244;

function tileXYToBbox(x: number, y: number, z: number, tileSize: number) {
  const resolution = (ORIGIN_Y * 2) / (tileSize * Math.pow(2, z));
  return {
    xmin: ORIGIN_X + x * tileSize * resolution,
    ymin: ORIGIN_Y - (y + 1) * tileSize * resolution,
    xmax: ORIGIN_X + (x + 1) * tileSize * resolution,
    ymax: ORIGIN_Y - y * tileSize * resolution,
  };
}

function createGoesLayer(
  L: LeafletInstance,
  id: string,
  url: string,
  maxZoom: number,
  opacity: number
) {
  if (id === "geocolor") {
    // Export endpoint — no tile cache; substitute bbox coords manually.
    // Use a placeholder template URL and override getTileUrl to avoid touching private internals.
    const tileLayer = L.tileLayer("{z}/{x}/{y}", { maxZoom, opacity });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tileLayer as any).getTileUrl = function (coords: { x: number; y: number; z: number }) {
      const { xmin, ymin, xmax, ymax } = tileXYToBbox(coords.x, coords.y, coords.z, 256);
      return url
        .replace("{xmin}", xmin.toFixed(6))
        .replace("{ymin}", ymin.toFixed(6))
        .replace("{xmax}", xmax.toFixed(6))
        .replace("{ymax}", ymax.toFixed(6));
    };
    return tileLayer;
  }
  // ABI13 and ABI10 have tile caches — Leaflet handles {z}/{y}/{x} natively
  return L.tileLayer(url, { maxZoom, opacity });
}

function tileLayerUrl(id: string): string {
  const service = GOES_LAYERS.find((l) => l.id === id);
  if (!service) {
    throw new Error(`Unknown GOES layer id: ${id}`);
  }
  if (id === "geocolor") {
    return `${service.url}/exportImage?bbox={xmin},{ymin},{xmax},{ymax}&bboxSR=3857&imageSR=3857&size=256,256&format=png&f=image`;
  }
  return `${service.url}/tile/{z}/{y}/{x}`;
}

export default function GoesMap() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const goesLayerRef = useRef<LeafletTileLayer | null>(null);
  const LRef = useRef<LeafletInstance | null>(null);
  const weatherLayerGroupRef = useRef<LeafletLayerGroup | null>(null);
  const quakeLayerGroupRef = useRef<LeafletLayerGroup | null>(null);
  const userLocationMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const [activeLayer, setActiveLayer] = useState<GoesLayer>(GOES_LAYERS[0]);
  const [goesOpacity, setGoesOpacity] = useState(GOES_LAYERS[0].opacity);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showQuakes, setShowQuakes] = useState(false);
  const [quakeRangeDays, setQuakeRangeDays] = useState<QuakeRangeDays>(7);
  const [quakes, setQuakes] = useState<NormalizedQuake[]>([]);
  const [quakeError, setQuakeError] = useState<string | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const goesOpacityRef = useRef(goesOpacity);
  const activeLayerIdRef = useRef(activeLayer.id);
  const prefsHydratedRef = useRef(false);

  useEffect(() => { goesOpacityRef.current = goesOpacity; }, [goesOpacity]);
  useEffect(() => { activeLayerIdRef.current = activeLayer.id; }, [activeLayer]);

  // Expone el clima por ciudad y los sismos recientes como herramientas
  // WebMCP mientras el mapa está montado, reusando las mismas funciones de
  // fetch/caché que ya usan los popups. Se desregistran al desmontar para
  // que no queden herramientas "vivas" apuntando a un componente que ya no
  // existe si el usuario navega a otra página.
  useEffect(() => {
    const modelContext = getWebMcpContext();
    if (!modelContext) return;

    modelContext.registerTool({
      name: "getPanamaWeather",
      description:
        "Obtiene el clima actual y el pronóstico del día para una ciudad panameña cubierta por el mapa de Preppers Panamá (ej. 'David', 'Boquete', 'Ciudad de Panamá', 'Bocas del Toro').",
      inputSchema: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "Nombre (o parte del nombre) de la ciudad panameña a consultar",
          },
        },
        required: ["city"],
      },
      annotations: { readOnlyHint: true },
      async execute(input: { city: string }) {
        const needle = input.city.toLowerCase();
        const city = PANAMA_CITIES.find((c) => c.name.toLowerCase().includes(needle));
        if (!city) {
          return {
            error: `No se encontró "${input.city}" entre las ciudades monitoreadas.`,
            availableCities: PANAMA_CITIES.map((c) => c.name),
          };
        }
        const data = await fetchWeatherData(city.lat, city.lng);
        return {
          city: city.name,
          temperatureC: data.current.temperature_2m,
          feelsLikeC: data.current.apparent_temperature,
          humidityPercent: data.current.relative_humidity_2m,
          windKmh: data.current.wind_speed_10m,
          precipitationMm: data.current.precipitation,
          condition: wmoToLabel(data.current.weather_code).desc,
          todayMaxC: data.daily.temperature_2m_max[0],
          todayMinC: data.daily.temperature_2m_min[0],
          rainProbabilityPercent: data.daily.precipitation_probability_max[0],
        };
      },
    });

    modelContext.registerTool({
      name: "getRecentEarthquakes",
      description:
        "Obtiene los sismos recientes en Panamá y alrededores, combinando el catálogo del USGS y el del Instituto de Geociencias de la Universidad de Panamá (IGC-UP). Útil para responder preguntas sobre actividad sísmica actual o reciente.",
      inputSchema: {
        type: "object",
        properties: {
          days: { type: "number", description: "Días hacia atrás a consultar: 1, 7 o 30 (por defecto 7)" },
          minMagnitude: { type: "number", description: "Magnitud mínima a incluir (por defecto 2)" },
        },
      },
      annotations: { readOnlyHint: true },
      async execute(input: { days?: number; minMagnitude?: number }) {
        const days = ([1, 7, 30] as const).includes(input.days as 1 | 7 | 30)
          ? (input.days as QuakeRangeDays)
          : 7;
        const [igc, usgsFeatures] = await Promise.all([fetchIgcQuakes(days), fetchUsgsQuakes(days)]);
        const merged = mergeQuakes(igc, usgsFeatures.map(usgsToNormalized))
          .filter((q) => (q.mag ?? 0) >= (input.minMagnitude ?? QUAKE_MIN_MAGNITUDE))
          .sort((a, b) => b.time - a.time);
        return {
          count: merged.length,
          rangeDays: days,
          earthquakes: merged.slice(0, 20).map((q) => ({
            magnitude: q.mag,
            place: q.place,
            time: new Date(q.time).toISOString(),
            depthKm: q.depthKm,
            source: q.source,
            url: q.url,
          })),
        };
      },
    });

    return () => {
      modelContext.unregisterTool?.("getPanamaWeather");
      modelContext.unregisterTool?.("getRecentEarthquakes");
    };
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    const now = new Date();
    setLastUpdate(now.toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" }));

    // Restaura preferencias guardadas (canal, opacidad, capas activas, rango
    // de sismos). Un enlace compartido con ?layer= tiene prioridad sobre lo
    // guardado, para que abrir una vista compartida muestre ese canal.
    const prefs = loadMapPrefs();
    const urlLayerId = new URLSearchParams(window.location.search).get("layer");
    const layer = GOES_LAYERS.find((l) => l.id === (urlLayerId ?? prefs.layerId));
    if (layer) {
      setActiveLayer(layer);
      setGoesOpacity(prefs.opacity ?? layer.opacity);
    } else if (prefs.opacity != null) {
      setGoesOpacity(prefs.opacity);
    }
    if (prefs.showWeather) setShowWeather(true);
    if (prefs.showQuakes) setShowQuakes(true);
    if (prefs.quakeRangeDays) setQuakeRangeDays(prefs.quakeRangeDays);
    prefsHydratedRef.current = true;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!mounted || !prefsHydratedRef.current) return;
    saveMapPrefs({
      layerId: activeLayer.id,
      opacity: goesOpacity,
      showWeather,
      showQuakes,
      quakeRangeDays,
    });
  }, [mounted, activeLayer, goesOpacity, showWeather, showQuakes, quakeRangeDays]);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        LRef.current = L;

        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const mapElement = mapRef.current;
        if (!mapElement) return;

        // Un enlace compartido (?lat=&lng=&zoom=) centra el mapa exactamente
        // donde lo dejó quien lo compartió, en vez del centro por defecto.
        const params = new URLSearchParams(window.location.search);
        const urlLat = parseFloat(params.get("lat") ?? "");
        const urlLng = parseFloat(params.get("lng") ?? "");
        const urlZoom = parseInt(params.get("zoom") ?? "", 10);
        const initialCenter: [number, number] =
          Number.isFinite(urlLat) && Number.isFinite(urlLng) ? [urlLat, urlLng] : [8.5, -80.0];
        const initialZoom = Number.isFinite(urlZoom) ? urlZoom : 7;

        const map = L.map(mapElement, {
          center: initialCenter,
          zoom: initialZoom,
          zoomControl: false,
          attributionControl: false,
          // Renderiza los círculos (sismos, clima, ubicación) en <canvas> en
          // vez de un nodo SVG por marcador — con 100-300+ sismos a la vez,
          // esto evita que el DOM y el rendimiento se degraden.
          preferCanvas: true,
        });

        mapInstanceRef.current = map;
        map.on("moveend", () => updateShareUrl(map, activeLayerIdRef.current));

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, opacity: 1 }
        ).addTo(map);

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, opacity: 0.7, pane: "overlayPane" }
        ).addTo(map);

        const tileUrl = tileLayerUrl(activeLayer.id);
        const goesLayer = createGoesLayer(L, activeLayer.id, tileUrl, 18, goesOpacity);
        goesLayer.addTo(map);
        goesLayerRef.current = goesLayer;

        const handleTileLoad = () => {
          setIsLoading(false);
        };
        const handleTileLoading = () => {
          setIsLoading(true);
        };
        goesLayer.on("load", handleTileLoad);
        goesLayer.on("loading", handleTileLoading);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

        const FullscreenControl = L.Control.extend({
          options: { position: "bottomright" },
          onAdd: function () {
            const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
            const btn = L.DomUtil.create("a", "", container);
            btn.innerHTML = "⛶";
            btn.href = "#";
            btn.title = "Pantalla completa";
            btn.style.cssText = "font-size:20px;display:flex;align-items:center;justify-content:center;width:34px;height:34px;cursor:pointer;background:#fff;color:#222;font-weight:700";

            const updateBtn = () => {
              const isFull = document.fullscreenElement === rootRef.current;
              btn.style.background = isFull ? "#09090b" : "#fff";
              btn.style.color = isFull ? "#22d3ee" : "#222";
              btn.innerHTML = isFull ? "✕" : "⛶";
              btn.title = isFull ? "Salir de pantalla completa" : "Pantalla completa";
            };

            L.DomEvent.on(btn, "click", (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              // El fullscreen target es el contenedor completo (rootRef), no
              // solo el lienzo de Leaflet, para que la barra de canales,
              // clima y sismos siga visible y editable en pantalla completa.
              const el = rootRef.current;
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                el?.requestFullscreen();
              }
            });

            document.addEventListener("fullscreenchange", updateBtn);
            return container;
          },
        });

        new FullscreenControl().addTo(map);

        const LocateControl = L.Control.extend({
          options: { position: "bottomright" },
          onAdd: function () {
            const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
            const btn = L.DomUtil.create("a", "", container);
            btn.innerHTML = "📍";
            btn.href = "#";
            btn.title = "Mi ubicación";
            btn.style.cssText = "font-size:16px;display:flex;align-items:center;justify-content:center;width:34px;height:34px;cursor:pointer;background:#fff;color:#222;";

            L.DomEvent.on(btn, "click", (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              if (!navigator.geolocation) {
                setLocateError("Tu navegador no soporta geolocalización.");
                return;
              }
              btn.innerHTML = "⏳";
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  btn.innerHTML = "📍";
                  const { latitude, longitude } = pos.coords;
                  map.setView([latitude, longitude], 12);
                  userLocationMarkerRef.current?.remove();
                  userLocationMarkerRef.current = L.circleMarker([latitude, longitude], {
                    radius: 8,
                    color: "#22d3ee",
                    fillColor: "#22d3ee",
                    fillOpacity: 0.35,
                    weight: 2,
                  }).addTo(map);
                  setLocateError(null);
                },
                () => {
                  btn.innerHTML = "📍";
                  setLocateError("No se pudo obtener tu ubicación. Revisa los permisos del navegador.");
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            });

            return container;
          },
        });

        new LocateControl().addTo(map);
        weatherLayerGroupRef.current = L.layerGroup().addTo(map);
        quakeLayerGroupRef.current = L.layerGroup().addTo(map);
      } catch (error) {
        console.error("Error al inicializar el mapa:", error);
        setMapError("No se pudo cargar el mapa satelital. Verifica tu conexión a internet.");
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        goesLayerRef.current = null;
        weatherLayerGroupRef.current = null;
        quakeLayerGroupRef.current = null;
        userLocationMarkerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L || !goesLayerRef.current) return;

    setIsLoading(true);
    map.removeLayer(goesLayerRef.current);

    const tileUrl = tileLayerUrl(activeLayer.id);
    const newLayer = createGoesLayer(L, activeLayer.id, tileUrl, 18, goesOpacityRef.current);
    newLayer.addTo(map);
    goesLayerRef.current = newLayer;

    const handleTileLoad = () => setIsLoading(false);
    const handleTileLoading = () => setIsLoading(true);
    newLayer.on("load", handleTileLoad);
    newLayer.on("loading", handleTileLoading);

    setLastUpdate(new Date().toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" }));
    updateShareUrl(map, activeLayer.id);
  }, [activeLayer, refreshTick]);

  useEffect(() => {
    if (goesLayerRef.current) {
      goesLayerRef.current.setOpacity(goesOpacity);
    }
  }, [goesOpacity]);

  useEffect(() => {
    const L = LRef.current;
    const group = weatherLayerGroupRef.current;
    if (!L || !group) return;

    group.clearLayers();
    if (!showWeather) return;

    PANAMA_CITIES.forEach((city) => {
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:16px;height:16px">
            <div style="position:absolute;inset:0;border-radius:50%;background:#22d3ee;opacity:0.25;animation:weatherPulse 2s ease-in-out infinite"></div>
            <div style="position:absolute;top:3px;left:3px;width:10px;height:10px;border-radius:50%;background:#22d3ee;border:2px solid #fff;box-shadow:0 0 8px rgba(34,211,238,0.8)"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([city.lat, city.lng], { icon });

      const popup = L.popup({
        className: "weather-popup",
        closeButton: false,
        maxWidth: 300,
        offset: [0, -8],
      }).setContent(buildLoadingContent(city.name));

      marker.bindPopup(popup);

      let pinned = false;

      const handleHover = async (e: { target: { openPopup: () => void } }) => {
        if (pinned) return;
        e.target.openPopup();
        try {
          const data = await fetchWeatherData(city.lat, city.lng);
          popup.setContent(buildPopupContent(city.name, data));
        } catch {
          popup.setContent(buildErrorContent());
        }
      };

      const handleUnhover = (e: { target: { closePopup: () => void } }) => {
        if (pinned) return;
        e.target.closePopup();
      };

      const handleClick = async (e: { target: { openPopup: () => void; closePopup: () => void } }) => {
        pinned = !pinned;
        if (pinned) {
          e.target.openPopup();
          try {
            const data = await fetchWeatherData(city.lat, city.lng);
            popup.setContent(buildPopupContent(city.name, data));
          } catch {
            popup.setContent(buildErrorContent());
          }
        } else {
          e.target.closePopup();
        }
      };

      marker.on("mouseover", handleHover);
      marker.on("mouseout", handleUnhover);
      marker.on("click", handleClick);

      group.addLayer(marker);
    });
  }, [showWeather, mounted]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    const group = quakeLayerGroupRef.current;
    if (!map || !L || !group) return;

    group.clearLayers();
    if (!showQuakes) return;

    let cancelled = false;

    (async () => {
      try {
        const [igcQuakes, usgsFeatures] = await Promise.all([
          fetchIgcQuakes(quakeRangeDays),
          fetchUsgsQuakes(quakeRangeDays),
        ]);
        if (cancelled) return;
        const merged = mergeQuakes(igcQuakes, usgsFeatures.map(usgsToNormalized));
        setQuakeError(null);
        setQuakes(merged);

        merged.forEach((q) => {
          const color = quakeColor(q.mag);
          const marker = L.circleMarker([q.lat, q.lon], {
            radius: quakeRadius(q.mag),
            color,
            fillColor: color,
            fillOpacity: 0.55,
            weight: 1.5,
          });
          const popupContent = buildQuakePopupContent(q, () => {
            map.setView([q.lat, q.lon], 11);
            marker.closePopup();
          });
          marker.bindPopup(popupContent, {
            className: "weather-popup",
            closeButton: false,
            maxWidth: 260,
          });
          group.addLayer(marker);
        });
      } catch {
        if (!cancelled) setQuakeError("No se pudieron cargar los sismos recientes.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showQuakes, mounted, refreshTick, quakeRangeDays]);

  const latestQuake = useMemo(() => {
    if (quakes.length === 0) return null;
    return [...quakes].sort((a, b) => b.time - a.time)[0];
  }, [quakes]);

  if (!mounted) return null;

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-zinc-900">
        <div className="text-center max-w-md px-4">
          <div className="text-4xl mb-4">🛰️</div>
          <p className="text-red-400 font-mono text-sm mb-2">Error de conexión</p>
          <p className="text-zinc-400 text-sm">{mapError}</p>
          <button
            onClick={() => { setMapError(null); setMounted(false); setTimeout(() => setMounted(true), 100); }}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-mono rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const activeCount = [showWeather, showQuakes].filter(Boolean).length;

  return (
    <div ref={rootRef} className="flex flex-col flex-grow min-h-0 bg-zinc-950">
      <div className="bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex flex-wrap items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-zinc-400 text-xs font-mono uppercase tracking-wider mr-1">Canal:</span>
          {GOES_LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => { setActiveLayer(layer); setGoesOpacity(layer.opacity); }}
              title={layer.tip}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${activeLayer.id === layer.id
                  ? "bg-cyan-600 text-white border border-cyan-500 shadow-lg shadow-cyan-900/30"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
                }`}
            >
              <span>{layer.icon}</span>
              {layer.label}
            </button>
          ))}
        </div>

        <span className="w-px h-6 bg-zinc-700 hidden sm:block" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowWeather((v) => !v)}
            title={showWeather ? "Ocultar clima" : "Mostrar clima por ciudad"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${showWeather
                ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/30 ring-1 ring-emerald-400/30"
                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
              }`}
          >
            <span>🌡️</span>
            Clima
          </button>

          <button
            onClick={() => setShowQuakes((v) => !v)}
            title={showQuakes ? "Ocultar sismos" : "Mostrar sismos recientes (USGS + IGC-UP)"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${showQuakes
                ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/30 ring-1 ring-red-400/30"
                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
              }`}
          >
            <span>🌍</span>
            Sismos
          </button>

          {showQuakes && (
            <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
              {QUAKE_RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setQuakeRangeDays(r.days)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${quakeRangeDays === r.days
                      ? "bg-red-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="w-px h-6 bg-zinc-700 hidden sm:block" />

        <button
          onClick={() => {
            navigator.clipboard
              .writeText(window.location.href)
              .then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              })
              .catch(() => {});
          }}
          title="Copiar enlace a esta vista del mapa"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
        >
          <span>{shareCopied ? "✅" : "🔗"}</span>
          {shareCopied ? "¡Copiado!" : "Compartir"}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-zinc-400 text-xs font-mono hidden sm:inline">Opac:</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={goesOpacity}
            onChange={(e) => setGoesOpacity(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-cyan-500"
          />
          <span className="text-zinc-400 text-xs font-mono w-8">{Math.round(goesOpacity * 100)}%</span>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-amber-400 text-xs font-mono">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse inline-block" />
              Cargando...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-mono">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
              GOES LIVE
            </span>
          )}
        </div>
      </div>

      <div className="relative flex-grow min-h-0">
        <div ref={mapRef} className="absolute inset-0" />

        {(activeCount > 0 || locateError) && (
          <div className="absolute top-3 left-3 z-[999] flex flex-col gap-1.5 max-w-[220px]">
            {showWeather && (
              <div className="bg-emerald-950/90 border border-emerald-700 rounded-lg px-3 py-1.5 pointer-events-none">
                <span className="text-emerald-400 text-[11px] font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
                  Clima: cursor o clic en ciudad
                </span>
              </div>
            )}
            {showQuakes && (
              <div className="bg-red-950/90 border border-red-700 rounded-lg px-3 py-1.5 pointer-events-none">
                <span className="text-red-400 text-[11px] font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse inline-block" />
                  {quakes.length} sismos (USGS + IGC-UP) · últimos {quakeRangeLabel(quakeRangeDays)}
                </span>
              </div>
            )}
            {showQuakes && quakeError && (
              <div className="bg-red-950/90 border border-red-800 rounded-lg px-3 py-1.5 pointer-events-none">
                <span className="text-red-400 text-[11px] font-mono">{quakeError}</span>
              </div>
            )}
            {locateError && (
              <div className="bg-amber-950/90 border border-amber-800 rounded-lg px-3 py-1.5">
                <span className="text-amber-400 text-[11px] font-mono flex items-center justify-between gap-2">
                  {locateError}
                  <button onClick={() => setLocateError(null)} className="text-amber-500 hover:text-amber-300 pointer-events-auto">✕</button>
                </span>
              </div>
            )}
          </div>
        )}

        {showQuakes && (
          <div className="absolute top-3 right-3 z-[999] bg-zinc-950/90 border border-zinc-700 rounded-lg px-3 py-2">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Magnitud</div>
            <div className="flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#4ade80" }} /> &lt; 3</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#facc15" }} /> 3 – 4.5</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#f97316" }} /> 4.5 – 6</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#ef4444" }} /> ≥ 6</span>
            </div>
          </div>
        )}

        {showQuakes && latestQuake && (
          <div className="absolute bottom-4 left-3 z-[999] bg-zinc-950/90 border border-red-800/60 rounded-lg px-3 py-2 max-w-[230px]">
            <div className="text-[10px] font-mono text-red-400 uppercase tracking-wider mb-1">
              Último sismo detectado
            </div>
            <div className="text-xs font-mono text-zinc-200">
              M {latestQuake.mag != null ? latestQuake.mag.toFixed(1) : "N/D"} · {latestQuake.place ?? "Ubicación desconocida"}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mb-1.5">
              {quakeTimeAgo(latestQuake.time)} · {latestQuake.source === "igc-up" ? "IGC-UP (Panamá)" : "USGS"}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => mapInstanceRef.current?.setView([latestQuake.lat, latestQuake.lon], 11)}
                className="text-[9px] font-mono text-zinc-500 hover:text-cyan-400 pointer-events-auto underline"
              >
                Centrar aquí
              </button>
              <a
                href={latestQuake.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-zinc-500 hover:text-cyan-400 pointer-events-auto underline"
              >
                Ver detalle →
              </a>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-20 z-[999] bg-zinc-950/90 border border-zinc-700 rounded-lg px-3 py-2 pointer-events-none">
          <div className="text-xs font-mono text-zinc-400">
            <span className="text-cyan-400">{activeLayer.icon} {activeLayer.label}</span>
            <br />
            <span className="text-zinc-400">{activeLayer.desc}</span>
            <br />
            <span className="text-zinc-400">Actualizado: {lastUpdate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
