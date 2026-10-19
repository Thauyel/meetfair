import { circle } from "@turf/turf";
import { estimateSeconds, SPEED } from "../geo";
import type { OverpassElement } from "../engine/candidates";
import type { Providers } from "../search";
import type { Area } from "../types";
import type { Place } from "./geocoding";

const KINDS: Record<string, string>[] = [
  { amenity: "cafe" },
  { amenity: "restaurant", cuisine: "sushi" },
  { amenity: "bar" },
  { leisure: "park" },
];

/** Deterministic stand-ins for the public services, shaped like the real responses. */
export const mockProviders: Providers = {
  async isochrones(origin, mode, budgets) {
    return budgets.map(
      (b) => circle([origin.lon, origin.lat], (b * 60 * SPEED[mode]) / 1300, { steps: 32 }) as Area,
    );
  },
  async transitStops(origin) {
    // A line of stops heading east, 3 minutes apart.
    return Array.from({ length: 10 }, (_, i) => ({ lat: origin.lat, lon: origin.lon + 0.01 * (i + 1), durationMin: 3 * (i + 1) }));
  },
  async venues(q) {
    const [w, s, e, n] = q.bbox;
    const out: OverpassElement[] = [];
    let id = 1;
    for (let i = 1; i < 6; i++) {
      for (let j = 1; j < 6; j++) {
        const kind = KINDS[(i + j) % KINDS.length];
        out.push({
          type: "node",
          id: id++,
          lat: s + ((n - s) * i) / 6,
          lon: w + ((e - w) * j) / 6,
          tags: { ...kind, name: `Mock ${kind.amenity ?? kind.leisure} ${id - 1}`, opening_hours: id % 3 ? "Mo-Su 08:00-23:00" : "Mo-Fr 09:00-12:00" },
        });
      }
    }
    return { elements: out, limited: false };
  },
  async matrix(sources, targets, mode) {
    return sources.map((s) => targets.map((t) => estimateSeconds(s, t, mode)));
  },
};

export function mockPlaces(q: string): Place[] {
  const base = { lat: 41.0369, lon: 28.985 };
  return [0, 1, 2].map((i) => ({
    label: `${q} ${i + 1}`,
    detail: "Mock City",
    point: { lat: base.lat + i * 0.02, lon: base.lon + i * 0.03 },
  }));
}

