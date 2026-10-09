import { writeFileSync } from "fs";
import { join } from "path";

// Instituto de Geociencias de la Universidad de Panamá (IGC-UP) — red
// sísmica nacional. No expone una API ni CORS, así que esta tabla HTML
// server-rendered se scrapea en build-time (en CI, donde CORS no aplica)
// y el resultado se publica como un JSON estático que el cliente puede
// leer same-origin desde GitHub Pages.
const IGC_URL = "https://sismosgeociencias.up.ac.pa/";
const OUTPUT_PATH = join(process.cwd(), "public", "quakes-igc.json");
const FETCH_TIMEOUT_MS = 15_000;
const TABLE_MARKER = "Tabla para grande";

// Panamá no observa horario de verano: UTC-5 todo el año.
const PANAMA_UTC_OFFSET_HOURS = 5;

function parsePanamaLocalTime(fecha, horaLocal) {
  const dateMatch = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = horaLocal.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch.map(Number);
  let [, hour, minute, second, meridiem] = timeMatch;
  hour = Number(hour);
  minute = Number(minute);
  second = Number(second);
  meridiem = meridiem.toUpperCase();

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  const ms = Date.UTC(year, month - 1, day, hour + PANAMA_UTC_OFFSET_HOURS, minute, second);
  return Number.isFinite(ms) ? ms : null;
}

function extractLargeTable(html) {
  const markerIdx = html.indexOf(TABLE_MARKER);
  if (markerIdx === -1) throw new Error(`No se encontró el marcador "${TABLE_MARKER}" en la página`);
  const tableStart = html.indexOf("<table", markerIdx);
  if (tableStart === -1) throw new Error("No se encontró <table> tras el marcador de la tabla grande");
  const tableEnd = html.indexOf("</table>", tableStart);
  if (tableEnd === -1) throw new Error("No se encontró el cierre </table>");
  return html.slice(tableStart, tableEnd);
}

function parseIgcQuakes(html) {
  const tableHtml = extractLargeTable(html);
  const rows = tableHtml.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  const quakes = [];

  for (const row of rows) {
    if (row.includes("<th>")) continue;

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      m[1].replace(/<a[^>]*>[\s\S]*?<\/a>|<[^>]+>/g, "").trim()
    );
    if (cells.length < 8) continue;

    const [estado, fecha, horaLocal, latStr, lonStr, profStr, magStr, region] = cells;
    const time = parsePanamaLocalTime(fecha, horaLocal);
    const lat = Number(latStr);
    const lon = Number(lonStr);
    const mag = Number(magStr);
    const depthKm = Number(profStr.replace(/km$/i, ""));

    if (time === null || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag)) continue;

    const hrefMatch = row.match(/href="([^"]+)"/);
    const detailUrl = hrefMatch ? new URL(hrefMatch[1], IGC_URL).toString() : IGC_URL;

    quakes.push({
      id: `igc-${fecha}-${horaLocal}-${latStr}-${lonStr}`,
      source: "igc-up",
      mag,
      place: region || null,
      time,
      status: /revisado/i.test(estado) ? "reviewed" : "preliminary",
      lat,
      lon,
      depthKm: Number.isFinite(depthKm) ? depthKm : null,
      url: detailUrl,
    });
  }

  return quakes;
}

async function fetchIgcHtml() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(IGC_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PreppersPanamaBot/1.0 (+https://prepperspanama.github.io; sitio de preparacionismo, consulta sismos cada 15 min)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  let quakes = [];
  let fetchedAt = null;

  try {
    const html = await fetchIgcHtml();
    quakes = parseIgcQuakes(html);
    if (quakes.length === 0) {
      throw new Error("Se obtuvo la página pero no se pudo extraer ningún sismo (¿cambió la estructura del HTML?)");
    }
    fetchedAt = new Date().toISOString();
    console.log(`✓ IGC-UP: ${quakes.length} sismos obtenidos`);
  } catch (err) {
    // No es fatal: el build no debe romperse por una fuente externa caída o
    // con la estructura cambiada. El mapa sigue funcionando solo con USGS;
    // este archivo simplemente queda sin datos de IGC-UP hasta el próximo
    // build programado que logre scrapear con éxito.
    console.warn(`⚠ IGC-UP: no se pudieron obtener sismos (${err.message}). Se publica una lista vacía.`);
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify({ fetchedAt, quakes }), "utf-8");
  console.log(`✓ Datos de IGC-UP escritos en public/quakes-igc.json (${quakes.length} sismos)`);
}

main();
