import type { LatLon, Mode } from "./types";

const ll = (p: LatLon) => `${p.lat},${p.lon}`;

const GOOGLE: Record<Mode, string> = { car: "driving", walk: "walking", bike: "bicycling", transit: "transit" };
// Apple Maps has no cycling flag; leaving it out lets Maps pick.
const APPLE: Partial<Record<Mode, string>> = { car: "d", walk: "w", transit: "r" };
// openstreetmap.org has no transit router.
const OSM: Partial<Record<Mode, string>> = { car: "fossgis_osrm_car", walk: "fossgis_osrm_foot", bike: "fossgis_osrm_bike" };

export type DirectionLinks = { google: string; apple: string; osm: string | null };

export function directionLinks(from: LatLon, to: LatLon, mode: Mode): DirectionLinks {
  const g = new URL("https://www.google.com/maps/dir/");
  g.searchParams.set("api", "1");
  g.searchParams.set("origin", ll(from));
  g.searchParams.set("destination", ll(to));
  g.searchParams.set("travelmode", GOOGLE[mode]);

  const a = new URL("https://maps.apple.com/");
  a.searchParams.set("saddr", ll(from));
  a.searchParams.set("daddr", ll(to));
  if (APPLE[mode]) a.searchParams.set("dirflg", APPLE[mode]);

  const engine = OSM[mode];
  const osm = engine
    ? `https://www.openstreetmap.org/directions?engine=${engine}&route=${encodeURIComponent(`${ll(from)};${ll(to)}`)}`
    : null;
  return { google: g.toString(), apple: a.toString(), osm };
}
