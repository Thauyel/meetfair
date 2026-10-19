import { circle, featureCollection, intersect, union } from "@turf/turf";
import { SPEED } from "../geo";
import type { Area, LatLon, Mode } from "../types";

/** Travel-time budgets (minutes) tried in order. Valhalla allows at most 4 contours. */
export const BUDGETS_MIN = [15, 30, 45, 60] as const;

export type TransitStop = LatLon & { durationMin: number };

const WALK_MPS = SPEED.walk;
// Union of hundreds of circles is the slow part; stops with tiny walk radius add nothing visible.
const MIN_STOP_RADIUS_M = 80;
const MAX_STOPS = 400;

function unionAll(polys: Area[]): Area | null {
  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0];
  return union(featureCollection(polys)) as Area | null;
}

/**
 * Reachable area by transit within `budgetMin`: the walk circle around the origin
 * plus, for every reachable stop, a walk circle sized by the time left over.
 */
export function transitArea(origin: LatLon, stops: TransitStop[], budgetMin: number): Area | null {
  const circles: Area[] = [
    circle([origin.lon, origin.lat], (budgetMin * 60 * WALK_MPS) / 1000, { steps: 24 }),
  ];
  const usable = stops
    .filter((s) => (budgetMin - s.durationMin) * 60 * WALK_MPS >= MIN_STOP_RADIUS_M)
    .sort((a, b) => a.durationMin - b.durationMin)
    .slice(0, MAX_STOPS);
  for (const s of usable) {
    const r = (budgetMin - s.durationMin) * 60 * WALK_MPS;
    circles.push(circle([s.lon, s.lat], r / 1000, { steps: 12 }));
  }
  return unionAll(circles);
}

/** Fallback when a router is down: a circle at typical speed. */
export function estimatedArea(origin: LatLon, mode: Mode, budgetMin: number): Area {
  const radiusM = (budgetMin * 60 * SPEED[mode]) / 1.3;
  return circle([origin.lon, origin.lat], radiusM / 1000, { steps: 32 });
}

/** Overlap of every person's area, or null if some pair does not meet. */
export function intersectAll(areas: (Area | null)[]): Area | null {
  if (areas.length === 0 || areas.some((a) => !a)) return null;
  let acc = areas[0] as Area;
  for (let i = 1; i < areas.length; i++) {
    const next = intersect(featureCollection([acc, areas[i] as Area])) as Area | null;
    if (!next) return null;
    acc = next;
  }
  return acc;
}

/**
 * Smallest budget at which everyone's areas overlap.
 * `areasByBudget[b][p]` is person p's area at BUDGETS_MIN[b].
 */
export function findFairZone(
  areasByBudget: (Area | null)[][],
  startIndex = 0,
): { budgetIndex: number; zone: Area } | null {
  for (let b = startIndex; b < areasByBudget.length; b++) {
    const zone = intersectAll(areasByBudget[b]);
    if (zone) return { budgetIndex: b, zone };
  }
  return null;
}

/** Used when people are too far apart to overlap: a disc around their centre. */
export function centroidZone(points: LatLon[]): Area {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  let spread = 0;
  for (const p of points) {
    spread = Math.max(spread, Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos((lat * Math.PI) / 180)));
  }
  const radiusKm = Math.max(1.5, spread * 111 * 0.25);
  return circle([lon, lat], radiusKm, { steps: 48 });
}
