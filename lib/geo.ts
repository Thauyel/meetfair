import type { LatLon, Mode } from "./types";

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLon, b: LatLon): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Typical door-to-door speeds (m/s), used only for estimates when routing fails. */
export const SPEED: Record<Mode, number> = {
  walk: 1.33, // 4.8 km/h
  bike: 4.2, // 15 km/h
  car: 8.3, // 30 km/h urban
  transit: 5, // 18 km/h incl. waiting
};

/** Streets are not straight lines. */
export const DETOUR = 1.3;

export function estimateSeconds(a: LatLon, b: LatLon, mode: Mode): number {
  return (haversine(a, b) * DETOUR) / SPEED[mode];
}

/** ~100 m grid, so nearby inputs share cache entries. */
export const roundCoord = (v: number) => Math.round(v * 1000) / 1000;
