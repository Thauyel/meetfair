import { DETOUR, haversine, SPEED } from "../geo";
import type { LatLon } from "../types";
import type { TransitStop } from "./zones";

/**
 * Transit seconds from origin to each target without another router call:
 * best of (walk straight there) and (ride to a reachable stop, then walk).
 */
export function transitSeconds(origin: LatLon, stops: TransitStop[], targets: LatLon[]): number[] {
  const walk = (a: LatLon, b: LatLon) => (haversine(a, b) * DETOUR) / SPEED.walk;
  return targets.map((t) => {
    let best = walk(origin, t);
    for (const s of stops) {
      const v = s.durationMin * 60 + walk(s, t);
      if (v < best) best = v;
    }
    return best;
  });
}
