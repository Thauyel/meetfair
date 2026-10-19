import type { LatLon } from "./types";

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function valid(lat: number, lon: number): LatLon | null {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

function pair(s: string | null): LatLon | null {
  const m = s && new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}`).exec(s);
  return m ? valid(Number(m[1]), Number(m[2])) : null;
}

/**
 * Coordinates from what people paste: "41.03, 28.98", geo: URIs, and Google / Apple / OSM map links.
 * Short links (maps.app.goo.gl) cannot be resolved in the browser and return null.
 */
export function parseLocation(input: string): LatLon | null {
  const text = input.trim();
  if (!text) return null;

  const plain = new RegExp(`^${NUM}\\s*[,;\\s]\\s*${NUM}$`).exec(text);
  if (plain) return valid(Number(plain[1]), Number(plain[2]));

  const geo = /^geo:([^?]+)/i.exec(text);
  if (geo) return pair(geo[1]);

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const full = decodeURIComponent(url.href);

  // Google place data (!3d lat !4d lon) is the pin itself; "@lat,lon" is only the viewport centre.
  const place = new RegExp(`!3d${NUM}!4d${NUM}`).exec(full);
  if (place) return valid(Number(place[1]), Number(place[2]));

  const sp = url.searchParams;
  for (const key of ["q", "query", "ll", "destination", "daddr", "coordinate", "sll", "center"]) {
    const p = pair(sp.get(key));
    if (p) return p;
  }
  if (sp.has("mlat") && sp.has("mlon")) return valid(Number(sp.get("mlat")), Number(sp.get("mlon")));

  const at = new RegExp(`@${NUM},${NUM}`).exec(full);
  if (at) return valid(Number(at[1]), Number(at[2]));

  const osm = new RegExp(`#map=\\d+(?:\\.\\d+)?/${NUM}/${NUM}`).exec(full);
  if (osm) return valid(Number(osm[1]), Number(osm[2]));
  return null;
}
