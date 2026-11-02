"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import type {
  GeoJSON as LeafletGeoJSON,
  LayerGroup as LeafletLayerGroup,
  Map as LeafletMap,
  TileLayer as LeafletTileLayer,
} from "leaflet";
import { BASEMAPS, LAYERS, PRESETS, loadLayer, type LayerId } from "./layers";
import { AREA_STYLES, exportMap } from "./exportMap";
import { describeArea, loadArea, loadCatalog, type AreaCatalog, type AreaData, type AreaLevel } from "./areas";

type LeafletInstance = typeof import("leaflet");

type LayerStatus = { state: "loading" } | { state: "ready"; count: number } | { state: "error"; message: string };

const SELECT_CLASS = "bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono disabled:opacity-50";

const SIZES = [
  { width: 2400, label: "Alta · 2400 px" },
  { width: 4000, label: "Muy alta · 4000 px" },
  { width: 6000, label: "Impresión · 6000 px" },
];

// Encuadre inicial: todo el territorio de Panamá.
const PANAMA_BOUNDS: [[number, number], [number, number]] = [[7.0, -83.1], [9.75, -77.1]];

const GROUPS = ["Territorio", "Agua", "Energía", "Servicios", "Riesgo"] as const;

const SUBDIVISION_LABEL: Record<AreaLevel, string> = {
  provincia: "Límite de distrito",
  distrito: "Límite de corregimiento",
  corregimiento: "",
};

// Quita "de Panamá" del título del tipo de mapa para añadir la zona elegida.
const titleFor = (base: string, area: string | null) => (area ? `${base.replace(/ de Panamá$/, "")} · ${area}` : base);

export default function MapGenerator() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletInstance | null>(null);
  const baseLayerRef = useRef<LeafletTileLayer | null>(null);
  const overlayRefs = useRef<Partial<Record<LayerId, LeafletGeoJSON>>>({});
  const dataRef = useRef<Partial<Record<LayerId, FeatureCollection>>>({});
  const areaLayerRef = useRef<LeafletLayerGroup | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(PRESETS[0].id);
  const [active, setActive] = useState<LayerId[]>(PRESETS[0].layers);
  const [basemapId, setBasemapId] = useState(PRESETS[0].basemap);
  const [baseTitle, setBaseTitle] = useState(PRESETS[0].title);
  // Título escrito a mano; se descarta al cambiar de tipo de mapa o de zona.
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<AreaCatalog | null>(null);
  const [provCode, setProvCode] = useState("");
  const [distCode, setDistCode] = useState("");
  const [corrCode, setCorrCode] = useState("");
  const [loadedArea, setLoadedArea] = useState<{ key: string; data: AreaData } | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [size, setSize] = useState(SIZES[1].width);
  const [status, setStatus] = useState<Partial<Record<LayerId, LayerStatus>>>({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current, { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
      map.fitBounds(PANAMA_BOUNDS);
      mapInstanceRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      baseLayerRef.current = null;
      overlayRefs.current = {};
    };
  }, []);

  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch(() => setAreaError("No se pudo cargar la lista de provincias, distritos y corregimientos."));
  }, []);

  const level: AreaLevel | null = corrCode ? "corregimiento" : distCode ? "distrito" : provCode ? "provincia" : null;
  const areaCode = corrCode || distCode || provCode;
  const area = level && catalog ? describeArea(level, areaCode, catalog) : null;

  const areaKey = level ? `${level}:${areaCode}` : null;
  const areaData = loadedArea && loadedArea.key === areaKey ? loadedArea.data : null;
  const title = customTitle ?? titleFor(baseTitle, area?.label ?? null);

  const selectArea = (prov: string, dist: string, corr: string) => {
    setProvCode(prov);
    setDistCode(dist);
    setCorrCode(corr);
    setCustomTitle(null);
    setAreaError(null);
  };

  // Encuadra la zona elegida, oscurece lo de afuera y dibuja sus
  // subdivisiones con nombre.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    areaLayerRef.current?.remove();
    areaLayerRef.current = null;
    if (!level) {
      map.fitBounds(PANAMA_BOUNDS);
      return;
    }
    let cancelled = false;
    loadArea(level, areaCode)
      .then((data) => {
        if (cancelled) return;
        setLoadedArea({ key: `${level}:${areaCode}`, data });
        const group = L.layerGroup();
        const holes = data.outline.features.flatMap((f) => {
          const g = f.geometry;
          const polys = g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
          return polys.map((p) => p[0].map(([lon, lat]) => [lat, lon] as [number, number]));
        });
        const world: [number, number][] = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
        L.polygon([world, ...holes], { stroke: false, fillColor: "#09090b", fillOpacity: 0.55, interactive: false }).addTo(group);
        if (data.subdivisions) {
          L.geoJSON(data.subdivisions, {
            style: () => ({
              color: "#e4e4e7",
              weight: AREA_STYLES.subdivision.width,
              dashArray: AREA_STYLES.subdivision.dash.join(" "),
              fill: false,
            }),
            onEachFeature: (f, l) => {
              const name = f.properties?.[data.nameField];
              if (typeof name === "string") {
                l.bindTooltip(name, { permanent: true, direction: "center", className: "mapgen-label" });
              }
            },
          }).addTo(group);
        }
        const outline = L.geoJSON(data.outline, {
          style: () => ({ color: "#f4f4f5", weight: AREA_STYLES.outline.width, fill: false }),
          interactive: false,
        }).addTo(group);
        group.addTo(map);
        areaLayerRef.current = group;
        map.fitBounds(outline.getBounds(), { padding: [24, 24] });
      })
      .catch(() => {
        if (!cancelled) setAreaError("No se pudo cargar el límite de la zona elegida.");
      });
    return () => {
      cancelled = true;
    };
  }, [level, areaCode, mapReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    baseLayerRef.current?.remove();
    baseLayerRef.current = null;
    const bm = BASEMAPS.find((b) => b.id === basemapId);
    if (!bm) return;
    baseLayerRef.current = L.tileLayer(bm.url, { maxNativeZoom: bm.maxZoom, maxZoom: 18, attribution: bm.attribution })
      .addTo(map)
      .bringToBack();
  }, [basemapId, mapReady]);

  // Sincroniza las capas activas: descarga las que faltan (en vivo) y las
  // dibuja en el orden del catálogo para que polígonos queden debajo de
  // líneas y puntos.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    let cancelled = false;

    for (const id of Object.keys(overlayRefs.current) as LayerId[]) {
      if (!active.includes(id)) {
        overlayRefs.current[id]?.remove();
        delete overlayRefs.current[id];
      }
    }

    const ordered = LAYERS.filter((l) => active.includes(l.id));
    for (const def of ordered) {
      if (overlayRefs.current[def.id]) continue;
      setStatus((s) => ({ ...s, [def.id]: { state: "loading" } }));
      loadLayer(def)
        .then((data) => {
          dataRef.current[def.id] = data;
          setStatus((s) => ({ ...s, [def.id]: { state: "ready", count: data.features.length } }));
          setFetchedAt(new Date());
          if (cancelled || overlayRefs.current[def.id]) return;
          const layer = L.geoJSON(data, {
            style: (f) => {
              const st = f ? def.style(f) : {};
              return {
                color: st.stroke,
                weight: st.width,
                fillColor: st.fill,
                fillOpacity: st.fill ? st.fillOpacity : 0,
                dashArray: st.dash?.join(" "),
              };
            },
            pointToLayer: (f, latlng) => {
              const st = def.style(f);
              return L.circleMarker(latlng, {
                radius: st.radius ?? 4,
                color: st.stroke,
                weight: st.width,
                fillColor: st.fill,
                fillOpacity: st.fillOpacity ?? 1,
              });
            },
            onEachFeature: (f, l) => {
              const label = def.mapLabel?.(f);
              if (label) {
                l.bindTooltip(label, {
                  permanent: true,
                  direction: def.id === "provincias" ? "center" : "right",
                  className: "mapgen-label",
                });
              } else {
                const text = def.tooltip?.(f);
                if (text) l.bindTooltip(text, { sticky: true, className: "plate-tooltip" });
              }
            },
          });
          overlayRefs.current[def.id] = layer;
          layer.addTo(map);
          // Mantiene el orden del catálogo aunque las capas lleguen en otro orden.
          for (const l of LAYERS) overlayRefs.current[l.id]?.bringToFront();
        })
        .catch((err: Error) => {
          if (!cancelled) setStatus((s) => ({ ...s, [def.id]: { state: "error", message: err.message } }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [active, mapReady]);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setActive(p.layers);
    setBasemapId(p.basemap);
    setBaseTitle(p.title);
    setCustomTitle(null);
  };

  const toggleLayer = (id: LayerId) => {
    setPresetId(null);
    setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const download = async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setExporting(true);
    setExportError(null);
    try {
      const b = map.getBounds();
      const layers = LAYERS.filter((l) => active.includes(l.id) && dataRef.current[l.id]).map((def) => ({
        def,
        data: dataRef.current[def.id] as FeatureCollection,
      }));
      const now = new Date();
      const blob = await exportMap({
        bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        width: size,
        title,
        subtitle: `${layers.map(({ def }) => def.label).join(" · ") || "Sin capas"} · datos consultados el ${now.toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" })}`,
        basemap: BASEMAPS.find((x) => x.id === basemapId) ?? null,
        layers,
        area:
          area && areaData
            ? { ...areaData, label: area.label, subdivisionLabel: SUBDIVISION_LABEL[area.level] }
            : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug = (title || "mapa").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.href = url;
      a.download = `${slug}-${now.toISOString().slice(0, 10)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "No se pudo generar la imagen");
    } finally {
      setExporting(false);
    }
  };

  const loading = active.some((id) => status[id]?.state === "loading");

  return (
    <section className="border-t border-zinc-800 bg-zinc-950 px-4 py-8" aria-labelledby="mapgen-title">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <span className="text-cyan-600 font-mono text-xs uppercase tracking-widest">Datos abiertos · en vivo</span>
          <h2 id="mapgen-title" className="text-xl font-black text-white tracking-tight mt-1">
            Generador de mapas de Panamá
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-3xl">
            Elige un tipo de mapa o combina capas, escoge una provincia, distrito o corregimiento (o encuadra a mano) y descárgalo como imagen en alta
            resolución. Los datos se consultan al momento en el STRI y OpenStreetMap.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${presetId === p.id
                  ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-900/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
                }`}
            >
              <span>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          <div className="flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider mb-1.5">Zona</legend>
              <select
                value={provCode}
                onChange={(e) => selectArea(e.target.value, "", "")}
                disabled={!catalog}
                aria-label="Provincia o comarca"
                className={SELECT_CLASS}
              >
                <option value="">Todo Panamá</option>
                {catalog?.provincias.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>
              {provCode && (
                <select
                  value={distCode}
                  onChange={(e) => selectArea(provCode, e.target.value, "")}
                  aria-label="Distrito"
                  className={SELECT_CLASS}
                >
                  <option value="">Toda la provincia</option>
                  {catalog?.distritos.filter((o) => o.code.startsWith(provCode)).map((o) => (
                    <option key={o.code} value={o.code}>{o.name}</option>
                  ))}
                </select>
              )}
              {distCode && (
                <select
                  value={corrCode}
                  onChange={(e) => selectArea(provCode, distCode, e.target.value)}
                  aria-label="Corregimiento"
                  className={SELECT_CLASS}
                >
                  <option value="">Todo el distrito</option>
                  {catalog?.corregimientos.filter((o) => o.code.startsWith(distCode)).map((o) => (
                    <option key={o.code} value={o.code}>{o.name}</option>
                  ))}
                </select>
              )}
              {areaError && <p className="text-red-400 text-[11px] font-mono">{areaError}</p>}
            </fieldset>

            {GROUPS.map((group) => (
              <fieldset key={group}>
                <legend className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider mb-1.5">{group}</legend>
                <div className="flex flex-col gap-1">
                  {LAYERS.filter((l) => l.group === group).map((l) => {
                    const st = active.includes(l.id) ? status[l.id] : undefined;
                    return (
                      <label key={l.id} className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={active.includes(l.id)}
                          onChange={() => toggleLayer(l.id)}
                          className="accent-cyan-500"
                        />
                        <span className="flex-grow">{l.label}</span>
                        {st?.state === "loading" && <span className="text-amber-400 text-[10px]">cargando…</span>}
                        {st?.state === "ready" && <span className="text-zinc-500 text-[10px]">{st.count.toLocaleString("es-PA")}</span>}
                        {st?.state === "error" && <span className="text-red-400 text-[10px]" title={st.message}>error</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <fieldset>
              <legend className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider mb-1.5">Mapa base</legend>
              <div className="grid grid-cols-2 gap-1">
                {BASEMAPS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBasemapId(b.id)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${basemapId === b.id
                        ? "bg-cyan-600 text-white border-cyan-500"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Título</span>
              <input
                value={title}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={90}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-600"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Resolución</span>
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className={SELECT_CLASS}
              >
                {SIZES.map((s) => (
                  <option key={s.width} value={s.width}>{s.label}</option>
                ))}
              </select>
            </label>

            <button
              onClick={download}
              disabled={exporting || loading || !mapReady}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-mono font-bold border transition-all bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-wait"
            >
              {exporting ? "Generando imagen…" : loading ? "Cargando datos…" : "⬇ Descargar PNG"}
            </button>
            {exportError && <p className="text-red-400 text-[11px] font-mono">{exportError}</p>}
            <p className="text-zinc-500 text-[10px] font-mono leading-relaxed">
              La imagen usa el encuadre actual del mapa. Trazas y ubicaciones son aproximadas; la red eléctrica y vial
              viene de OpenStreetMap y puede estar incompleta.
              {fetchedAt && <> Última consulta: {fetchedAt.toLocaleTimeString("es-PA", { timeStyle: "short" })}.</>}
            </p>
          </div>

          <div className="relative min-h-[460px] h-[70vh] max-h-[760px] rounded-xl overflow-hidden border border-zinc-800">
            <div ref={mapRef} className="absolute inset-0 bg-zinc-900" />
            <button
              onClick={() => { selectArea("", "", ""); mapInstanceRef.current?.fitBounds(PANAMA_BOUNDS); }}
              className="absolute top-3 right-3 z-[999] px-2.5 py-1 rounded-lg text-[11px] font-mono border bg-zinc-950/90 text-zinc-300 border-zinc-700 hover:text-white"
            >
              Ver todo Panamá
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
