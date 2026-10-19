import { simplify } from "@turf/turf";
import { parseOverpass, shortlist, venueQuery, venuesInZone, type OverpassElement, type VenueQuery } from "./engine/candidates";
import { rankVenues, scoreTimes } from "./engine/rank";
import { openState } from "./engine/score";
import { transitSeconds } from "./engine/transit";
import {
  BUDGETS_MIN,
  centroidZone,
  estimatedArea,
  findFairZone,
  intersectAll,
  transitArea,
  type TransitStop,
} from "./engine/zones";
import { estimateSeconds } from "./geo";
import type { Area, LatLon, Mode, ScoredVenue, SearchEvent, SearchRequest } from "./types";

export type RoutedMode = Exclude<Mode, "transit">;

/** Everything that talks to the network. Injected so the engine is testable and swappable. */
export interface Providers {
  /** One polygon per budget, same order as `budgetsMin`. */
  isochrones(origin: LatLon, mode: RoutedMode, budgetsMin: readonly number[]): Promise<(Area | null)[]>;
  transitStops(origin: LatLon, departAt: string, maxMin: number): Promise<TransitStop[]>;
  /** limited = answered by a fallback without detail tags. */
  venues(q: VenueQuery): Promise<{ elements: OverpassElement[]; limited: boolean }>;
  /** Seconds, rows = sources, cols = targets, null = no route. */
  matrix(sources: LatLon[], targets: LatLon[], mode: RoutedMode): Promise<(number | null)[][]>;
}

/** Below this many venues we widen the search to the next budget. */
export const MIN_VENUES = 8;
/** How many venues get exact times (matrix size). */
export const SHORTLIST = 40;

const slim = (a: Area | null) => (a ? (simplify(a, { tolerance: 0.0004, highQuality: false }) as Area) : null);

export async function* runSearch(req: SearchRequest, providers: Providers): AsyncGenerator<SearchEvent> {
  const people = req.people;
  const budgets = BUDGETS_MIN;
  const estimatedPeople = new Set<number>();
  const stopsByPerson: (TransitStop[] | null)[] = people.map(() => null);

  // 1. Reachable areas per person, per budget.
  yield { type: "stage", stage: "areas" };
  const areasByPerson = await Promise.all(
    people.map(async (p, i): Promise<(Area | null)[]> => {
      try {
        if (p.mode === "transit") {
          const stops = await providers.transitStops(p.point, req.departAt, budgets[budgets.length - 1]);
          stopsByPerson[i] = stops;
          return budgets.map((b) => transitArea(p.point, stops, b));
        }
        return await providers.isochrones(p.point, p.mode, budgets);
      } catch {
        estimatedPeople.add(i);
        return budgets.map((b) => estimatedArea(p.point, p.mode, b));
      }
    }),
  );
  const areasByBudget = budgets.map((_, b) => areasByPerson.map((a) => a[b] ?? null));

  // 2. Smallest budget where everyone overlaps.
  yield { type: "stage", stage: "zone" };
  const found = findFairZone(areasByBudget);
  const farApart = !found;
  let budgetIndex = found?.budgetIndex ?? budgets.length - 1;
  let zone: Area = found?.zone ?? centroidZone(people.map((p) => p.point));

  // 3. Venues inside the zone, widening while there are too few.
  yield { type: "stage", stage: "venues" };
  let venues;
  let limited = false;
  try {
    for (;;) {
      const res = await providers.venues(venueQuery(zone, req.categories, req.text, req.filters));
      limited = res.limited;
      venues = venuesInZone(parseOverpass(res.elements), zone);
      if (venues.length >= MIN_VENUES || farApart || budgetIndex === budgets.length - 1) break;
      budgetIndex++;
      zone = intersectAll(areasByBudget[budgetIndex]) ?? zone;
    }
  } catch {
    yield { type: "error", code: "providers_down" };
    return;
  }

  yield {
    type: "zone",
    budgetMin: budgets[budgetIndex],
    zone: slim(zone) as Area,
    areas: areasByBudget[budgetIndex].map(slim),
    farApart,
    estimatedPeople: [...estimatedPeople],
  };

  const withOpen = venues.map((v) => ({ v, open: openState(v, req.localTime) }));
  const allowed = req.filters.includes("open") ? withOpen.filter((x) => x.open !== "closed") : withOpen;
  const openById = new Map(allowed.map((x) => [x.v.id, x.open]));
  const picked = shortlist(
    allowed.map((x) => x.v),
    areasByBudget,
    SHORTLIST,
  );
  if (picked.length === 0) {
    yield { type: "result", venues: [], limited };
    return;
  }

  // 4. Exact times: one matrix call per routed mode, transit from the stops we already have.
  yield { type: "stage", stage: "times" };
  const targets = picked.map((v) => v.point);
  const times: (number | null)[][] = people.map(() => targets.map(() => null));
  const estimated: boolean[][] = people.map(() => targets.map(() => false));
  const fillEstimate = (i: number) => {
    targets.forEach((t, k) => {
      times[i][k] = estimateSeconds(people[i].point, t, people[i].mode);
      estimated[i][k] = true;
    });
  };

  const byMode = new Map<RoutedMode, number[]>();
  people.forEach((p, i) => {
    if (p.mode !== "transit") byMode.set(p.mode, [...(byMode.get(p.mode) ?? []), i]);
  });
  await Promise.all(
    [...byMode].map(async ([mode, idx]) => {
      try {
        const rows = await providers.matrix(idx.map((i) => people[i].point), targets, mode);
        idx.forEach((i, r) =>
          targets.forEach((t, k) => {
            const s = rows[r]?.[k];
            // No route (e.g. car into a pedestrian zone): estimate rather than drop the venue.
            if (s == null) {
              times[i][k] = estimateSeconds(people[i].point, t, mode);
              estimated[i][k] = true;
            } else times[i][k] = s;
          }),
        );
      } catch {
        idx.forEach(fillEstimate);
      }
    }),
  );
  people.forEach((p, i) => {
    if (p.mode !== "transit") return;
    const stops = stopsByPerson[i];
    if (stops) transitSeconds(p.point, stops, targets).forEach((s, k) => (times[i][k] = s));
    else fillEstimate(i);
  });

  // 5. Score and rank.
  const scored: ScoredVenue[] = picked.map((v, k) => {
    const ts = people.map((_, i) => times[i][k]);
    return { ...v, times: ts, estimated: people.map((_, i) => estimated[i][k]), ...scoreTimes(ts), open: openById.get(v.id) ?? "unknown" };
  });
  yield { type: "result", venues: rankVenues(scored, "fair"), limited };
}
