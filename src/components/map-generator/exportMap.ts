// Dibuja el mapa del generador en un <canvas> a alta resolución, sin depender
// de capturar el DOM de Leaflet: se vuelven a pedir los mosaicos al zoom que
// corresponda al tamaño final y se redibujan las capas con los mismos estilos
// de layers.ts. Por eso los mosaicos tienen que venir de un servidor con CORS.
import type { Feature, FeatureCollection, Position } from "geojson";
import type { Basemap, FeatureStyle, LayerDef, LegendEntry } from "./layers";
import type { AreaData } from "./areas";

export interface ExportOptions {
  bounds: { west: number; south: number; east: number; north: number };
  width: number;
  title: string;
  subtitle: string;
  basemap: Basemap | null;
  layers: { def: LayerDef; data: FeatureCollection }[];
  area?: AreaData & { label: string; subdivisionLabel: string };
}

export const AREA_STYLES = {
  outline: { stroke: "#111827", width: 3 },
  subdivision: { stroke: "#374151", width: 1.2, dash: [6, 4] },
} satisfies Record<string, FeatureStyle>;

// Anillos de todos los polígonos, para recortar o enmascarar con evenodd.
function traceRings(
  ctx: CanvasRenderingContext2D,
  fc: FeatureCollection,
  px: (lon: number) => number,
  py: (lat: number) => number,
) {
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
    for (const ring of polys.flat()) {
      ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(px(lon), py(lat)) : ctx.lineTo(px(lon), py(lat))));
      ctx.closePath();
    }
  }
}

const INK = "#1f2933";
const MUTED = "#616e7c";
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const mercX = (lon: number) => (lon + 180) / 360;
const mercY = (lat: number) => (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    // Un mosaico que falla deja un hueco, no tumba toda la exportación.
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function exportMap(opts: ExportOptions): Promise<Blob> {
  const { bounds, width, basemap } = opts;
  const s = width / 1600; // escala de tipografía y trazos respecto a 1600 px

  const x0 = mercX(bounds.west);
  const x1 = mercX(bounds.east);
  const y0 = mercY(bounds.north);
  const y1 = mercY(bounds.south);
  const mapW = width;
  const mapH = Math.round(mapW * ((y1 - y0) / (x1 - x0)));
  const headerH = Math.round(118 * s);
  const footerH = Math.round(46 * s);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = headerH + mapH + footerH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no permite dibujar en canvas");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Proyección: Web Mercator escalado al rectángulo del mapa.
  const px = (lon: number) => ((mercX(lon) - x0) / (x1 - x0)) * mapW;
  const py = (lat: number) => headerH + ((mercY(lat) - y0) / (y1 - y0)) * mapH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, headerH, mapW, mapH);
  ctx.clip();
  ctx.fillStyle = "#d7e9f5";
  ctx.fillRect(0, headerH, mapW, mapH);

  // ── Mosaicos ──
  if (basemap) {
    const worldPx = mapW / (x1 - x0);
    const z = Math.max(0, Math.min(basemap.maxZoom, Math.ceil(Math.log2(worldPx / 256))));
    const n = 2 ** z;
    const tileSize = worldPx / n;
    const tx0 = Math.floor(x0 * n);
    const tx1 = Math.floor(x1 * n);
    const ty0 = Math.floor(y0 * n);
    const ty1 = Math.floor(y1 * n);
    const jobs: Promise<void>[] = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        const url = basemap.url.replace("{z}", String(z)).replace("{x}", String(tx)).replace("{y}", String(ty));
        jobs.push(
          loadImage(url).then((img) => {
            if (!img) return;
            const dx = (tx / n - x0) * worldPx;
            const dy = headerH + (ty / n - y0) * worldPx;
            // +1 px para que no queden costuras entre mosaicos
            ctx.drawImage(img, dx, dy, tileSize + 1, tileSize + 1);
          }),
        );
      }
    }
    await Promise.all(jobs);
  }

  // ── Capas vectoriales ──
  const labels: { x: number; y: number; text: string; bold: boolean }[] = [];
  for (const { def, data } of opts.layers) {
    for (const f of data.features) {
      drawFeature(ctx, f, def.style(f), px, py, s);
      const text = def.mapLabel?.(f);
      if (text) {
        const at = labelPoint(f);
        if (at) labels.push({ x: px(at[0]), y: py(at[1]), text, bold: def.id === "provincias" });
      }
    }
  }

  // ── Zona elegida: aclara lo de afuera, subdivisiones y contorno ──
  const legend = opts.layers.flatMap(({ def }) => def.legend);
  if (opts.area) {
    const { outline, subdivisions, nameField } = opts.area;
    ctx.beginPath();
    ctx.rect(0, headerH, mapW, mapH);
    traceRings(ctx, outline, px, py);
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.fill("evenodd");
    for (const f of subdivisions?.features ?? []) {
      drawFeature(ctx, f, AREA_STYLES.subdivision, px, py, s);
      const at = labelPoint(f);
      const text = f.properties?.[nameField];
      if (at && typeof text === "string") labels.push({ x: px(at[0]), y: py(at[1]), text, bold: true });
    }
    for (const f of outline.features) drawFeature(ctx, f, AREA_STYLES.outline, px, py, s);
    legend.unshift(
      { label: opts.area.label, kind: "line", color: AREA_STYLES.outline.stroke as string },
      ...(subdivisions
        ? [{ label: opts.area.subdivisionLabel, kind: "line" as const, color: AREA_STYLES.subdivision.stroke as string, dash: AREA_STYLES.subdivision.dash }]
        : []),
    );
  }

  for (const l of labels) {
    ctx.font = `${l.bold ? "700" : "500"} ${Math.round((l.bold ? 15 : 14) * s)}px ${FONT}`;
    ctx.textAlign = l.bold ? "center" : "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    const x = l.bold ? l.x : l.x + 7 * s;
    ctx.strokeText(l.text, x, l.y);
    ctx.fillStyle = l.bold ? "#3e4c59" : INK;
    ctx.fillText(l.text, x, l.y);
  }

  drawScaleBar(ctx, bounds, mapW, headerH + mapH, s);
  drawLegend(ctx, legend, headerH + mapH, s);
  ctx.restore();

  ctx.strokeStyle = "#9aa5b1";
  ctx.lineWidth = 1 * s;
  ctx.strokeRect(0.5, headerH + 0.5, mapW - 1, mapH - 1);

  // ── Encabezado y pie ──
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(38 * s)}px ${FONT}`;
  ctx.fillText(opts.title || "Mapa de Panamá", 24 * s, 54 * s);
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${Math.round(18 * s)}px ${FONT}`;
  ctx.fillText(opts.subtitle, 24 * s, 88 * s);

  const sources = [...new Set(opts.layers.map(({ def }) => def.source))];
  if (basemap) sources.push(basemap.attribution);
  ctx.font = `400 ${Math.round(12.5 * s)}px ${FONT}`;
  ctx.fillText(`Fuentes: ${sources.join(" · ")}`, 24 * s, headerH + mapH + 28 * s, mapW - 300 * s);
  ctx.textAlign = "right";
  ctx.fillText("prepperspanama.github.io", mapW - 24 * s, headerH + mapH + 28 * s);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png"),
  );
}

function drawFeature(
  ctx: CanvasRenderingContext2D,
  f: Feature,
  st: FeatureStyle,
  px: (lon: number) => number,
  py: (lat: number) => number,
  s: number,
) {
  const g = f.geometry;
  if (!g) return;
  const path = (rings: Position[][], close: boolean) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(px(lon), py(lat)) : ctx.lineTo(px(lon), py(lat))));
      if (close) ctx.closePath();
    }
  };
  const paint = (fill: boolean) => {
    if (fill && st.fill) {
      ctx.globalAlpha = st.fillOpacity ?? 1;
      ctx.fillStyle = st.fill;
      ctx.fill("evenodd");
      ctx.globalAlpha = 1;
    }
    if (st.stroke && (st.width ?? 1) > 0) {
      ctx.strokeStyle = st.stroke;
      ctx.lineWidth = (st.width ?? 1) * s;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash((st.dash ?? []).map((d) => d * s));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };
  const point = ([lon, lat]: Position) => {
    ctx.beginPath();
    ctx.arc(px(lon), py(lat), (st.radius ?? 4) * s, 0, Math.PI * 2);
    paint(true);
  };

  switch (g.type) {
    case "Point":
      point(g.coordinates);
      break;
    case "MultiPoint":
      g.coordinates.forEach(point);
      break;
    case "LineString":
      path([g.coordinates], false);
      paint(false);
      break;
    case "MultiLineString":
      path(g.coordinates, false);
      paint(false);
      break;
    case "Polygon":
      path(g.coordinates, true);
      paint(true);
      break;
    case "MultiPolygon":
      path(g.coordinates.flat(), true);
      paint(true);
      break;
  }
}

// Punto para rotular: el propio punto, o el centroide del anillo más grande.
function labelPoint(f: Feature): Position | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Point") return g.coordinates;
  const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.type === "MultiPolygon" ? g.coordinates.map((p) => p[0]) : [];
  let best: Position | null = null;
  let bestArea = 0;
  for (const ring of rings) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [xa, ya] = ring[i];
      const [xb, yb] = ring[i + 1];
      const k = xa * yb - xb * ya;
      a += k; cx += (xa + xb) * k; cy += (ya + yb) * k;
    }
    if (Math.abs(a) > bestArea) {
      bestArea = Math.abs(a);
      best = [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

function drawLegend(ctx: CanvasRenderingContext2D, entries: LegendEntry[], bottom: number, s: number) {
  if (entries.length === 0) return;
  const unique = entries.filter((e, i) => entries.findIndex((o) => o.label === e.label) === i);
  const rowH = 22 * s;
  const cols = unique.length > 9 ? 2 : 1;
  const rows = Math.ceil(unique.length / cols);
  ctx.font = `400 ${Math.round(13 * s)}px ${FONT}`;
  const colW = Math.max(...unique.map((e) => ctx.measureText(e.label).width)) + 44 * s;
  const w = colW * cols + 20 * s;
  const h = rows * rowH + 20 * s;
  const x = 16 * s;
  const y = bottom - h - 16 * s;
  ctx.fillStyle = "rgba(255,255,255,0.93)";
  ctx.strokeStyle = "#9aa5b1";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8 * s);
  ctx.fill();
  ctx.stroke();
  unique.forEach((e, i) => {
    const cx = x + 12 * s + Math.floor(i / rows) * colW;
    const cy = y + 10 * s + (i % rows) * rowH + rowH / 2;
    ctx.strokeStyle = e.color;
    ctx.fillStyle = e.color;
    if (e.kind === "line") {
      ctx.lineWidth = 3 * s;
      ctx.setLineDash((e.dash ?? []).map((d) => d * s));
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 24 * s, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (e.kind === "fill") {
      ctx.globalAlpha = 0.6;
      ctx.fillRect(cx, cy - 7 * s, 24 * s, 14 * s);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.2 * s;
      ctx.strokeRect(cx, cy - 7 * s, 24 * s, 14 * s);
    } else {
      ctx.beginPath();
      ctx.arc(cx + 12 * s, cy, 6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(e.label, cx + 32 * s, cy);
  });
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  b: ExportOptions["bounds"],
  mapW: number,
  bottom: number,
  s: number,
) {
  const lat = (b.north + b.south) / 2;
  const kmPerPx = (((b.east - b.west) * 111.32 * Math.cos((lat * Math.PI) / 180)) / mapW);
  const target = kmPerPx * 220 * s;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((v) => v >= target / 2) ?? 1000;
  const km = step * 2;
  const len = km / kmPerPx;
  const x = mapW - len - 30 * s;
  const y = bottom - 34 * s;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(x - 12 * s, y - 24 * s, len + 24 * s, 44 * s);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? INK : "#ffffff";
    ctx.fillRect(x + (i * len) / 4, y, len / 4, 8 * s);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1 * s;
  ctx.strokeRect(x, y, len, 8 * s);
  ctx.fillStyle = INK;
  ctx.font = `500 ${Math.round(12 * s)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("0", x, y - 5 * s);
  ctx.fillText(String(step), x + len / 2, y - 5 * s);
  ctx.fillText(`${km} km`, x + len, y - 5 * s);
}
