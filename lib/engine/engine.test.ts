import { describe, expect, it } from "vitest";
import { circle } from "@turf/turf";
import { buildOverpassQuery, cleanText, parseOverpass, photonTags, shortlist, venueQuery, venuesInZone } from "./candidates";
import { rankVenues, scoreTimes } from "./rank";
import { openState, wallClockDate } from "./score";
import { transitSeconds } from "./transit";
import { centroidZone, findFairZone, intersectAll, transitArea } from "./zones";
import type { Area, ScoredVenue, Venue } from "../types";

const disc = (lon: number, lat: number, km: number) => circle([lon, lat], km, { steps: 32 }) as Area;
const venue = (id: string, lat: number, lon: number, tags: Record<string, string> = {}): Venue => ({
  id, name: id, category: "cafe", point: { lat, lon }, tags,
});

describe("zones", () => {
  it("intersects overlapping discs and rejects disjoint ones", () => {
    expect(intersectAll([disc(29, 41, 2), disc(29.03, 41, 2)])).not.toBeNull();
    expect(intersectAll([disc(29, 41, 1), disc(29.1, 41, 1)])).toBeNull();
    expect(intersectAll([disc(29, 41, 1), null])).toBeNull();
  });

  it("picks the smallest budget where everyone overlaps", () => {
    const byBudget = [
      [disc(29, 41, 1), disc(29.05, 41, 1)], // apart
      [disc(29, 41, 3), disc(29.05, 41, 3)], // overlap
      [disc(29, 41, 5), disc(29.05, 41, 5)],
    ];
    expect(findFairZone(byBudget)?.budgetIndex).toBe(1);
    expect(findFairZone([[disc(29, 41, 1), disc(30, 41, 1)]])).toBeNull();
  });

  it("transit area grows from reachable stops", () => {
    const origin = { lat: 41, lon: 29 };
    const far = { lat: 41, lon: 29.2, durationMin: 20 };
    const area = transitArea(origin, [far], 30)!;
    expect(venuesInZone([venue("near-stop", 41, 29.2)], area)).toHaveLength(1);
    // stop is only reachable with 10 min left: not at a 15 min budget
    expect(venuesInZone([venue("near-stop", 41, 29.2)], transitArea(origin, [far], 15)!)).toHaveLength(0);
  });

  it("centroid zone sits between people", () => {
    const z = centroidZone([{ lat: 41, lon: 28 }, { lat: 41, lon: 30 }]);
    expect(venuesInZone([venue("mid", 41, 29)], z)).toHaveLength(1);
  });
});

describe("candidates", () => {
  it("strips anything that could break the Overpass string", () => {
    expect(cleanText('su"shi);out;')).toBe("sushiout");
    expect(cleanText("  Kahve  Dünyası ")).toBe("Kahve Dünyası");
    expect(cleanText("寿司")).toBe("寿司");
  });

  it("builds a bbox query with category, text and tag filters", () => {
    const q = buildOverpassQuery(venueQuery(disc(29, 41, 1), ["cafe", "dessert"], "sushi", ["wheelchair", "open"]));
    expect(q).toContain('["amenity"="cafe"]["name"~"sushi",i]["wheelchair"~"^(yes|limited)$"]["name"]');
    expect(q).toContain('["shop"~"^(pastry|confectionery|chocolate)$"]["cuisine"~"sushi",i]');
    expect(q).not.toContain("open");
    expect(q).toMatch(/\(40\.99\d+,28\.98\d+,41\.00\d+,29\.01\d+\)/);
  });

  it("maps categories to Photon tags, defaulting to meeting places", () => {
    expect(photonTags(["bar"])).toEqual(["amenity:bar", "amenity:pub", "amenity:biergarten"]);
    expect(photonTags([])).toContain("amenity:cafe");
    expect(photonTags([])).not.toContain("leisure:park");
  });

  it("parses nodes and ways, drops unnamed and duplicates", () => {
    const v = parseOverpass([
      { type: "node", id: 1, lat: 41, lon: 29, tags: { name: "A", amenity: "pub" } },
      { type: "way", id: 2, center: { lat: 41.0001, lon: 29 }, tags: { name: "A", amenity: "pub" } },
      { type: "node", id: 3, lat: 41, lon: 29, tags: { amenity: "cafe" } },
      { type: "way", id: 4, center: { lat: 41.01, lon: 29 }, tags: { name: "P", leisure: "park" } },
    ]);
    expect(v.map((x) => [x.id, x.category])).toEqual([["n1", "bar"], ["w4", "park"]]);
  });

  it("shortlist prefers venues inside everyone's smaller rings", () => {
    const areas = [
      [disc(29, 41, 1), disc(29.02, 41, 1)],
      [disc(29, 41, 4), disc(29.02, 41, 4)],
    ];
    const both = venue("both", 41, 29.01);
    const edge = venue("edge", 41, 28.98);
    expect(shortlist([edge, both], areas, 1).map((v) => v.id)).toEqual(["both"]);
  });
});

describe("transit times", () => {
  it("rides to a stop then walks when that beats walking", () => {
    const origin = { lat: 41, lon: 29 };
    const stop = { lat: 41, lon: 29.1, durationMin: 10 };
    const [t] = transitSeconds(origin, [stop], [{ lat: 41, lon: 29.1 }]);
    expect(t).toBeCloseTo(600, 0);
    const [near] = transitSeconds(origin, [stop], [{ lat: 41, lon: 29.001 }]);
    expect(near).toBeLessThan(120);
  });
});

describe("score", () => {
  const sv = (id: string, times: number[]): ScoredVenue => ({
    ...venue(id, 41, 29), times, estimated: times.map(() => false), ...scoreTimes(times), open: "unknown",
  });

  it("computes max, spread, total; unreachable is Infinity", () => {
    expect(scoreTimes([600, 900, 300])).toEqual({ max: 900, spread: 600, total: 1800 });
    expect(scoreTimes([600, null]).max).toBe(Infinity);
  });

  it("ranks by worst trip, by equality, by total", () => {
    const a = sv("a", [1200, 1200]); // max 1200, spread 0, total 2400
    const b = sv("b", [600, 1100]); // max 1100, spread 500, total 1700
    const c = sv("c", [300, 1500]); // max 1500, spread 1200, total 1800
    expect(rankVenues([a, b, c], "fair").map((v) => v.id)).toEqual(["b", "a", "c"]);
    expect(rankVenues([a, b, c], "equal").map((v) => v.id)).toEqual(["a", "b", "c"]);
    expect(rankVenues([a, b, c], "total").map((v) => v.id)).toEqual(["b", "c", "a"]);
  });

  it("evaluates opening hours at the wall-clock meeting time", () => {
    const v = venue("x", 41, 29, { opening_hours: "Mo-Fr 09:00-17:00" });
    expect(openState(v, "2026-10-19T10:00")).toBe("open"); // Monday
    expect(openState(v, "2026-10-19T20:00")).toBe("closed");
    expect(openState(v, "2026-10-18T10:00")).toBe("closed"); // Sunday
    expect(openState(venue("y", 41, 29), "2026-10-19T10:00")).toBe("unknown");
    expect(openState(venue("z", 41, 29, { opening_hours: "garbage!!" }), "2026-10-19T10:00")).toBe("unknown");
    expect(wallClockDate("2026-10-19T10:00")?.getHours()).toBe(10);
    expect(wallClockDate("nope")).toBeNull();
  });
});
