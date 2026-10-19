import { z } from "zod";
import { fetchJson } from "./http";
import { buildOverpassQuery, photonTags, type OverpassElement, type VenueQuery } from "../engine/candidates";
import type { TransitStop } from "../engine/zones";
import type { RoutedMode } from "../search";
import type { Area, LatLon } from "../types";

// Each provider is one URL: point it at a self-hosted instance to scale.
const VALHALLA = "https://valhalla1.openstreetmap.de";
const TRANSITOUS = "https://api.transitous.org/api/v6/one-to-all";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const PHOTON = "https://photon.komoot.io";
// The public Overpass server is sometimes minutes behind; past this we answer from Photon instead.
const OVERPASS_BUDGET_S = 6;

const COSTING: Record<RoutedMode, string> = { car: "auto", walk: "pedestrian", bike: "bicycle" };
// Public Valhalla allows ~1 request/second per client.
const VALHALLA_GAP_MS = 1100;

const isoSchema = z.object({
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      properties: z.object({ contour: z.number() }).loose(),
      geometry: z.object({ type: z.enum(["Polygon", "MultiPolygon"]), coordinates: z.array(z.any()) }),
    }),
  ),
});

export async function valhallaIsochrones(origin: LatLon, mode: RoutedMode, budgetsMin: readonly number[]): Promise<(Area | null)[]> {
  const body = {
    locations: [{ lat: origin.lat, lon: origin.lon }],
    costing: COSTING[mode],
    contours: budgetsMin.map((time) => ({ time })),
    polygons: true,
    denoise: 0.5,
    generalize: 40,
  };
  const d = await fetchJson(`${VALHALLA}/isochrone`, isoSchema, {
    provider: "valhalla",
    gapMs: VALHALLA_GAP_MS,
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return budgetsMin.map((b) => {
    const f = d.features.find((x) => x.properties.contour === b);
    return f ? ({ type: "Feature", properties: {}, geometry: f.geometry } as Area) : null;
  });
}

const matrixSchema = z.object({
  sources_to_targets: z.array(z.array(z.object({ time: z.number().nullable() }))),
});

export async function valhallaMatrix(sources: LatLon[], targets: LatLon[], mode: RoutedMode): Promise<(number | null)[][]> {
  const body = {
    sources: sources.map((p) => ({ lat: p.lat, lon: p.lon })),
    targets: targets.map((p) => ({ lat: p.lat, lon: p.lon })),
    costing: COSTING[mode],
  };
  const d = await fetchJson(`${VALHALLA}/sources_to_targets`, matrixSchema, {
    provider: "valhalla",
    gapMs: VALHALLA_GAP_MS,
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    timeoutMs: 20_000,
  });
  return d.sources_to_targets.map((row) => row.map((c) => c.time));
}

const oneToAllSchema = z.object({
  all: z.array(z.object({ place: z.object({ lat: z.number(), lon: z.number() }).loose(), duration: z.number() })),
});

export async function transitousStops(origin: LatLon, departAt: string, maxMin: number): Promise<TransitStop[]> {
  const u = new URL(TRANSITOUS);
  u.searchParams.set("one", `${origin.lat},${origin.lon}`);
  u.searchParams.set("time", departAt);
  u.searchParams.set("maxTravelTime", String(maxMin));
  const d = await fetchJson(u.toString(), oneToAllSchema, { provider: "transitous", gapMs: 500, timeoutMs: 15_000 });
  return d.all.map((s) => ({ lat: s.place.lat, lon: s.place.lon, durationMin: s.duration }));
}

const overpassSchema = z.object({
  elements: z.array(
    z.object({
      type: z.string(),
      id: z.number(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      tags: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

async function overpassVenues(q: VenueQuery): Promise<OverpassElement[]> {
  const d = await fetchJson(OVERPASS, overpassSchema, {
    provider: "overpass",
    gapMs: 500,
    method: "POST",
    body: new URLSearchParams({ data: buildOverpassQuery(q, OVERPASS_BUDGET_S) }),
    timeoutMs: OVERPASS_BUDGET_S * 1000,
  });
  return d.elements;
}

const photonSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({ osm_type: z.string(), osm_id: z.number(), osm_key: z.string(), osm_value: z.string(), name: z.string().optional() }).loose(),
    }),
  ),
});

const OSM_TYPE: Record<string, string> = { N: "node", W: "way", R: "relation" };

/** Fast but shallow: names and category only, no detail tags (hours, wheelchair...). Max 50 results. */
async function photonVenues(q: VenueQuery): Promise<OverpassElement[]> {
  const [w, s, e, n] = q.bbox;
  const u = new URL(q.text ? `${PHOTON}/api` : `${PHOTON}/reverse`);
  if (q.text) {
    u.searchParams.set("q", q.text);
    u.searchParams.set("bbox", `${w},${s},${e},${n}`);
  } else {
    const lat = (s + n) / 2, lon = (w + e) / 2;
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lon));
    // half the bbox diagonal, in km
    u.searchParams.set("radius", String(Math.max(0.3, Math.hypot((n - s) * 111, (e - w) * 111 * Math.cos((lat * Math.PI) / 180)) / 2)));
  }
  u.searchParams.set("limit", "50");
  for (const t of photonTags(q.categories)) u.searchParams.append("osm_tag", t);
  const d = await fetchJson(u.toString(), photonSchema, { provider: "photon", gapMs: 150, timeoutMs: 8000 });
  return d.features.map((f) => ({
    type: OSM_TYPE[f.properties.osm_type] ?? "node",
    id: f.properties.osm_id,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    tags: { ...(f.properties.name ? { name: f.properties.name } : {}), [f.properties.osm_key]: f.properties.osm_value },
  }));
}

/** Overpass (rich tags) first; Photon if Overpass is slow or down. `limited` = no detail tags. */
export async function fetchVenues(q: VenueQuery): Promise<{ elements: OverpassElement[]; limited: boolean }> {
  try {
    return { elements: await overpassVenues(q), limited: false };
  } catch {
    return { elements: await photonVenues(q), limited: true };
  }
}
