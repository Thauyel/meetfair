import { describe, expect, it } from "vitest";
import { directionLinks } from "./directions";
import { parseLocation } from "./parse-location";
import { DEFAULT_STATE, decodeState, encodeState, type AppState } from "./share-state";
import { localNow } from "./client";

describe("parseLocation", () => {
  it.each([
    ["41.0369, 28.985", { lat: 41.0369, lon: 28.985 }],
    ["41.0369 28.985", { lat: 41.0369, lon: 28.985 }],
    ["-33.86;151.2", { lat: -33.86, lon: 151.2 }],
    ["geo:41.01,29.02?z=17", { lat: 41.01, lon: 29.02 }],
    ["https://www.google.com/maps/place/X/@41.0,28.9,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d41.0369!4d28.985", { lat: 41.0369, lon: 28.985 }],
    ["https://www.google.com/maps/@41.04,28.99,15z", { lat: 41.04, lon: 28.99 }],
    ["https://www.google.com/maps/search/?api=1&query=41.03%2C28.98", { lat: 41.03, lon: 28.98 }],
    ["https://maps.apple.com/?ll=41.05,29.01&q=Pin", { lat: 41.05, lon: 29.01 }],
    ["https://www.openstreetmap.org/?mlat=41.02&mlon=28.97#map=16/41.02/28.97", { lat: 41.02, lon: 28.97 }],
    ["https://www.openstreetmap.org/#map=16/41.025/28.975", { lat: 41.025, lon: 28.975 }],
  ])("reads %s", (input, expected) => {
    expect(parseLocation(input)).toEqual(expected);
  });

  it.each(["Kadıköy", "https://maps.app.goo.gl/abc123", "95, 10", "41.0", ""])("rejects %s", (input) => {
    expect(parseLocation(input)).toBeNull();
  });
});

describe("share state", () => {
  it("round-trips a full search", () => {
    const s: AppState = {
      people: [
        { label: "Ayşe, home|x", mode: "walk", point: { lat: 41.03691, lon: 28.985 } },
        { label: "", mode: "car", point: null },
        { label: "Bob", mode: "transit", point: { lat: -33.8, lon: 151.2 } },
      ],
      categories: ["cafe", "bar"],
      text: "sushi",
      filters: ["open", "wheelchair"],
      time: "2026-10-20T19:30",
      sort: "equal",
    };
    expect(decodeState(encodeState(s))).toEqual(s);
  });

  it("falls back to defaults on garbage", () => {
    const s = decodeState("p=999,999,boat,%E0%A4%A|x&c=cafe,nope,cafe&t=tomorrow&s=weird");
    expect(s.people).toHaveLength(2);
    expect(s.people[0]).toEqual({ label: "", mode: "transit", point: null });
    expect(s.categories).toEqual(["cafe"]);
    expect(s.time).toBe("");
    expect(s.sort).toBe("fair");
    expect(decodeState("")).toEqual(DEFAULT_STATE);
  });

  it("caps people at 6 and keeps an explicit empty category list", () => {
    const p = Array.from({ length: 9 }, () => "1,2,walk,").join("|");
    const s = decodeState(`p=${encodeURIComponent(p)}&c=`);
    expect(s.people).toHaveLength(6);
    expect(s.categories).toEqual([]);
  });
});

describe("directions", () => {
  it("builds per-mode links", () => {
    const l = directionLinks({ lat: 41, lon: 29 }, { lat: 41.1, lon: 29.1 }, "transit");
    expect(l.google).toContain("travelmode=transit");
    expect(l.apple).toContain("dirflg=r");
    expect(l.osm).toBeNull();
    const b = directionLinks({ lat: 41, lon: 29 }, { lat: 41.1, lon: 29.1 }, "bike");
    expect(b.apple).not.toContain("dirflg");
    expect(b.osm).toContain("fossgis_osrm_bike");
  });
});

it("formats local wall-clock time", () => {
  expect(localNow(new Date(2026, 0, 5, 7, 3))).toBe("2026-01-05T07:03");
});
