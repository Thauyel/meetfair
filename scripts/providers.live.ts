// Manual smoke test against the real public servers. Run rarely: LIVE=1 npx vitest run scripts
import { expect, it } from "vitest";
import { photonSearch, reverseGeocode } from "../lib/providers/geocoding";
import { fetchVenues, transitousStops, valhallaIsochrones, valhallaMatrix } from "../lib/providers/routing";
import { runSearch, type Providers } from "../lib/search";
import type { SearchEvent } from "../lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const timed = <F extends (...a: any[]) => Promise<any>>(name: string, f: F) =>
  (async (...a: Parameters<F>) => {
    const t = Date.now();
    try {
      return await f(...a);
    } finally {
      console.log(`  ${name} ${Date.now() - t}ms`, name === "venues" ? JSON.stringify(a[0]) : "");
    }
  }) as F;

const raw: Providers = {
  isochrones: timed("isochrones", valhallaIsochrones),
  transitStops: timed("transit", transitousStops),
  venues: timed("venues", fetchVenues),
  matrix: timed("matrix", valhallaMatrix),
};

it("geocodes and reverse-geocodes", async () => {
  const places = await photonSearch("Kadıköy", "en");
  expect(places.length).toBeGreaterThan(0);
  const rev = await reverseGeocode({ lat: 41.0369, lon: 28.985 }, "tr");
  expect(rev.label).toBeTruthy();
  console.log(places[0], rev);
}, 30_000);

it("runs a full Istanbul search: Kadıköy transit, Taksim walk, Beşiktaş car", async () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const t0 = Date.now();
  const events: SearchEvent[] = [];
  for await (const e of runSearch(
    {
      people: [
        { label: "Kadıköy", mode: "transit", point: { lat: 40.9903, lon: 29.029 } },
        { label: "Taksim", mode: "walk", point: { lat: 41.0369, lon: 28.985 } },
        { label: "Beşiktaş", mode: "car", point: { lat: 41.0422, lon: 29.0083 } },
      ],
      // tomorrow 19:00 Istanbul (UTC+3), when transit runs
      departAt: `${tomorrow}T16:00:00Z`,
      localTime: `${tomorrow}T19:00`,
      categories: ["cafe"],
      text: "",
      filters: [],
    },
    raw,
  )) {
    events.push(e);
    console.log(((Date.now() - t0) / 1000).toFixed(1) + "s", e.type, e.type === "stage" ? e.stage : "");
  }
  const zone = events.find((e) => e.type === "zone");
  const result = events.at(-1);
  if (zone?.type === "zone") console.log("budget", zone.budgetMin, "far", zone.farApart, "estimated", zone.estimatedPeople);
  expect(result?.type).toBe("result");
  if (result?.type === "result") {
    for (const v of result.venues.slice(0, 5)) {
      console.log(v.name, v.times.map((s) => Math.round((s ?? 0) / 60)), v.estimated, v.open);
    }
    expect(result.venues.length).toBeGreaterThan(0);
  }
}, 120_000);
