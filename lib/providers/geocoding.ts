import { z } from "zod";
import { fetchJson } from "./http";
import type { LatLon } from "../types";

export type Place = { label: string; detail: string; point: LatLon };

const PHOTON = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
// Photon only localises these; elsewhere it returns local names.
const PHOTON_LANGS = new Set(["en", "de", "fr"]);

const photonSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.record(z.string(), z.unknown()),
    }),
  ),
});

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

export async function photonSearch(q: string, lang: string, bias?: LatLon): Promise<Place[]> {
  const u = new URL(PHOTON);
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "6");
  if (PHOTON_LANGS.has(lang)) u.searchParams.set("lang", lang);
  if (bias) {
    u.searchParams.set("lat", String(bias.lat));
    u.searchParams.set("lon", String(bias.lon));
  }
  const data = await fetchJson(u.toString(), photonSchema, { provider: "photon", gapMs: 150, timeoutMs: 6000 });
  return data.features.map((f) => {
    const p = f.properties;
    const street = [str(p.street), str(p.housenumber)].filter(Boolean).join(" ");
    const label = str(p.name) ?? (street || str(p.city) || "?");
    const detail = [street && street !== label ? street : null, str(p.district), str(p.city), str(p.state), str(p.country)]
      .filter((x, i, a) => x && x !== label && a.indexOf(x) === i)
      .join(", ");
    const [lon, lat] = f.geometry.coordinates;
    return { label, detail, point: { lat, lon } };
  });
}

const nominatimSchema = z.object({
  name: z.string().nullish(),
  display_name: z.string(),
  address: z.record(z.string(), z.string()).optional(),
});

export async function reverseGeocode(point: LatLon, lang: string): Promise<Place> {
  const u = new URL(NOMINATIM);
  u.searchParams.set("lat", String(point.lat));
  u.searchParams.set("lon", String(point.lon));
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("zoom", "18");
  u.searchParams.set("accept-language", lang);
  const d = await fetchJson(u.toString(), nominatimSchema, { provider: "nominatim", gapMs: 1100, timeoutMs: 6000 });
  const a = d.address ?? {};
  const road = [a.road, a.house_number].filter(Boolean).join(" ");
  const label = d.name || road || a.suburb || a.neighbourhood || d.display_name.split(",")[0];
  const detail = [a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.village, a.country]
    .filter((x) => x && x !== label)
    .join(", ");
  return { label, detail, point };
}
