// División político-administrativa para encuadrar el generador en una
// provincia, distrito o corregimiento. Los códigos son jerárquicos en las
// tres capas del STRI: provincia = 2 dígitos, distrito = 4, corregimiento = 6.
import type { FeatureCollection } from "geojson";
import { arcgis } from "./layers";

export type AreaLevel = "provincia" | "distrito" | "corregimiento";

export interface AreaOption {
  code: string;
  name: string;
}

export interface AreaCatalog {
  provincias: AreaOption[];
  distritos: AreaOption[];
  corregimientos: AreaOption[];
}

export interface AreaSelection {
  level: AreaLevel;
  code: string;
  name: string;
  // Nombre con contexto para títulos: "Distrito de David (Chiriquí)"
  label: string;
}

export interface AreaData {
  outline: FeatureCollection;
  // Subdivisiones a rotular: distritos de una provincia o corregimientos de
  // un distrito. Un corregimiento no tiene subdivisiones.
  subdivisions: FeatureCollection | null;
  nameField: string;
}

const LAYERS: Record<AreaLevel, { service: string; code: string; name: string }> = {
  provincia: { service: "Panama_Province_Boundaries_2024/FeatureServer/0", code: "ID_PROV", name: "Provincia" },
  distrito: { service: "Panama_Distritos_Boundaries_2024/FeatureServer/0", code: "ID_Distrito", name: "Distrito" },
  corregimiento: { service: "Panama_Corregimientos_Boundaries_2024/FeatureServer/0", code: "ID_CORR", name: "Corregimiento" },
};

const CHILD: Record<AreaLevel, AreaLevel | null> = {
  provincia: "distrito",
  distrito: "corregimiento",
  corregimiento: null,
};

// Más detalle cuanto más chica es la zona.
const SIMPLIFY: Record<AreaLevel, number> = { provincia: 0.0008, distrito: 0.0004, corregimiento: 0.0002 };

const byName = (a: AreaOption, b: AreaOption) => a.name.localeCompare(b.name, "es");

let catalogCache: Promise<AreaCatalog> | null = null;

export function loadCatalog(): Promise<AreaCatalog> {
  if (!catalogCache) {
    const list = async (level: AreaLevel) => {
      const { service, code, name } = LAYERS[level];
      const fc = await arcgis(service, { fields: `${code},${name}`, geometry: false });
      return fc.features
        .map((f) => ({ code: String(f.properties?.[code] ?? ""), name: String(f.properties?.[name] ?? "") }))
        .filter((o) => o.code && o.name)
        .sort(byName);
    };
    catalogCache = Promise.all([list("provincia"), list("distrito"), list("corregimiento")])
      .then(([provincias, distritos, corregimientos]) => ({ provincias, distritos, corregimientos }))
      .catch((err) => {
        catalogCache = null;
        throw err;
      });
  }
  return catalogCache;
}

export function describeArea(level: AreaLevel, code: string, catalog: AreaCatalog): AreaSelection | null {
  const find = (list: AreaOption[], c: string) => list.find((o) => o.code === c);
  const prov = find(catalog.provincias, code.slice(0, 2));
  const item = find(catalog[`${level}s` as const], code);
  if (!item || !prov) return null;
  const provLabel = prov.name.startsWith("Comarca") ? prov.name : `provincia de ${prov.name}`;
  if (level === "provincia") {
    return { level, code, name: item.name, label: prov.name.startsWith("Comarca") ? prov.name : `Provincia de ${prov.name}` };
  }
  if (level === "distrito") {
    return { level, code, name: item.name, label: `Distrito de ${item.name} (${prov.name})` };
  }
  const dist = find(catalog.distritos, code.slice(0, 4));
  return {
    level,
    code,
    name: item.name,
    label: `Corregimiento de ${item.name}${dist ? `, distrito de ${dist.name}` : ""} (${provLabel.replace("provincia de ", "")})`,
  };
}

const areaCache = new Map<string, Promise<AreaData>>();

export function loadArea(level: AreaLevel, code: string): Promise<AreaData> {
  const key = `${level}:${code}`;
  let p = areaCache.get(key);
  if (!p) {
    const { service, code: codeField } = LAYERS[level];
    const child = CHILD[level];
    p = Promise.all([
      arcgis(service, { where: `${codeField}='${code}'`, fields: codeField, simplify: SIMPLIFY[level] }),
      child
        ? arcgis(LAYERS[child].service, {
            where: `${LAYERS[child].code} LIKE '${code}%'`,
            fields: `${LAYERS[child].code},${LAYERS[child].name}`,
            simplify: SIMPLIFY[child],
          })
        : Promise.resolve(null),
    ])
      .then(([outline, subdivisions]) => ({
        outline,
        subdivisions,
        nameField: child ? LAYERS[child].name : LAYERS[level].name,
      }))
      .catch((err) => {
        areaCache.delete(key);
        throw err;
      });
    areaCache.set(key, p);
  }
  return p;
}
