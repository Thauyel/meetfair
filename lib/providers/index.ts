import { cacheLife } from "next/cache";
import { roundCoord } from "../geo";
import type { Providers, RoutedMode } from "../search";
import type { LatLon } from "../types";
import { fetchVenues, transitousStops, valhallaIsochrones, valhallaMatrix } from "./routing";
import type { VenueQuery } from "../engine/candidates";
import { mockProviders } from "./mock";

const round = (p: LatLon): LatLon => ({ lat: roundCoord(p.lat), lon: roundCoord(p.lon) });

/** Transit schedules: 15-minute departure buckets share a cache entry. */
export function bucket15(iso: string): string {
  const t = new Date(iso).getTime();
  const q = 15 * 60_000;
  return new Date(Math.floor((Number.isFinite(t) ? t : Date.now()) / q) * q).toISOString();
}

async function isochrones(origin: LatLon, mode: RoutedMode, budgets: number[]) {
  "use cache";
  cacheLife("hours");
  return valhallaIsochrones(origin, mode, budgets);
}

async function transit(origin: LatLon, departAt: string, maxMin: number) {
  "use cache";
  cacheLife("hours");
  return transitousStops(origin, departAt, maxMin);
}

async function venues(q: VenueQuery) {
  "use cache";
  cacheLife("days");
  return fetchVenues(q);
}

async function matrix(sources: LatLon[], targets: LatLon[], mode: RoutedMode) {
  "use cache";
  cacheLife("hours");
  return valhallaMatrix(sources, targets, mode);
}

const liveProviders: Providers = {
  isochrones: (o, m, b) => isochrones(round(o), m, [...b]),
  transitStops: (o, t, max) => transit(round(o), bucket15(t), max),
  venues: (q) => venues(q),
  matrix: (s, t, m) => matrix(s.map(round), t, m),
};

// MOCK_PROVIDERS=1 (e2e tests, offline dev) answers from synthetic data and never hits public servers.
export const providers: Providers = process.env.MOCK_PROVIDERS === "1" ? mockProviders : liveProviders;
