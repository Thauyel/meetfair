// No heavy imports: this runs in the browser too (sort tabs re-rank without a network call).
import type { ScoredVenue, Sort } from "../types";

export function scoreTimes(times: (number | null)[]): { max: number; spread: number; total: number } {
  if (times.some((t) => t == null)) return { max: Infinity, spread: Infinity, total: Infinity };
  const ts = times as number[];
  const max = Math.max(...ts);
  return { max, spread: max - Math.min(...ts), total: ts.reduce((a, b) => a + b, 0) };
}

const COMPARE: Record<Sort, (a: ScoredVenue, b: ScoredVenue) => number> = {
  fair: (a, b) => a.max - b.max || a.spread - b.spread || a.total - b.total,
  equal: (a, b) => a.spread - b.spread || a.max - b.max || a.total - b.total,
  total: (a, b) => a.total - b.total || a.max - b.max || a.spread - b.spread,
};

/** Stable sort; unreachable venues (Infinity) sink to the end. */
export function rankVenues(venues: ScoredVenue[], sort: Sort): ScoredVenue[] {
  const cmp = COMPARE[sort];
  return venues
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const d = cmp(a.v, b.v);
      return Number.isNaN(d) || d === 0 ? a.i - b.i : d;
    })
    .map((x) => x.v);
}
