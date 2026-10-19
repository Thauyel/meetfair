import { describe, expect, it } from "vitest";
import { mockProviders } from "./providers/mock";
import { runSearch, type Providers } from "./search";
import type { SearchEvent, SearchRequest } from "./types";

const req = (over: Partial<SearchRequest> = {}): SearchRequest => ({
  people: [
    { label: "A", mode: "walk", point: { lat: 41.03, lon: 28.98 } },
    { label: "B", mode: "car", point: { lat: 41.04, lon: 29.01 } },
    { label: "C", mode: "transit", point: { lat: 41.02, lon: 28.97 } },
  ],
  departAt: "2026-10-19T16:00:00.000Z",
  localTime: "2026-10-19T19:00",
  categories: ["cafe"],
  text: "",
  filters: [],
  ...over,
});

async function collect(r: SearchRequest, p: Providers = mockProviders) {
  const events: SearchEvent[] = [];
  for await (const e of runSearch(r, p)) events.push(e);
  return events;
}

describe("runSearch", () => {
  it("streams stages, then zone, then ranked results", async () => {
    const ev = await collect(req());
    expect(ev.filter((e) => e.type === "stage").map((e) => e.type === "stage" && e.stage)).toEqual([
      "areas", "zone", "venues", "times",
    ]);
    const zone = ev.find((e) => e.type === "zone");
    expect(zone?.type === "zone" && zone.farApart).toBe(false);
    expect(zone?.type === "zone" && zone.areas).toHaveLength(3);
    const result = ev.at(-1);
    expect(result?.type).toBe("result");
    if (result?.type !== "result") return;
    expect(result.venues.length).toBeGreaterThan(0);
    const maxes = result.venues.map((v) => v.max);
    expect(maxes).toEqual([...maxes].sort((a, b) => a - b));
    expect(result.venues[0].times).toHaveLength(3);
  });

  it("falls back to estimates when a router fails, and flags them", async () => {
    const broken: Providers = { ...mockProviders, isochrones: async () => { throw new Error("down"); }, matrix: async () => { throw new Error("down"); } };
    const ev = await collect(req(), broken);
    const zone = ev.find((e) => e.type === "zone");
    expect(zone?.type === "zone" && zone.estimatedPeople).toEqual([0, 1]);
    const result = ev.at(-1);
    expect(result?.type === "result" && result.venues[0].estimated).toEqual([true, true, false]);
  });

  it("uses a centre zone when people are too far apart", async () => {
    const ev = await collect(req({
      people: [
        { label: "A", mode: "walk", point: { lat: 41, lon: 28 } },
        { label: "B", mode: "walk", point: { lat: 41, lon: 30 } },
      ],
    }));
    const zone = ev.find((e) => e.type === "zone");
    expect(zone?.type === "zone" && zone.farApart).toBe(true);
    expect(ev.at(-1)?.type).toBe("result");
  });

  it("drops closed venues when the open filter is on", async () => {
    const all = await collect(req({ localTime: "2026-10-19T19:00" }));
    const open = await collect(req({ localTime: "2026-10-19T19:00", filters: ["open"] }));
    const n = (ev: SearchEvent[]) => { const r = ev.at(-1); return r?.type === "result" ? r.venues : []; };
    expect(n(open).every((v) => v.open !== "closed")).toBe(true);
    expect(n(all).some((v) => v.open === "closed")).toBe(true);
  });

  it("reports providers_down when venues cannot be fetched", async () => {
    const ev = await collect(req(), { ...mockProviders, venues: async () => { throw new Error("down"); } });
    expect(ev.at(-1)).toEqual({ type: "error", code: "providers_down" });
  });

  it("passes the limited flag through when venues come from the fallback", async () => {
    const ev = await collect(req(), { ...mockProviders, venues: async (q) => ({ ...(await mockProviders.venues(q)), limited: true }) });
    const r = ev.at(-1);
    expect(r?.type === "result" && r.limited).toBe(true);
  });
});
