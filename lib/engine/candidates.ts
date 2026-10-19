import { bbox, booleanPointInPolygon, point } from "@turf/turf";
import { haversine } from "../geo";
import { CATEGORIES, type Area, type Category, type Filter, type Venue } from "../types";

/** OSM tags for each category: [key, values] pairs, any one matches. */
const CATEGORY_TAGS: Record<Category, [string, string[]][]> = {
  cafe: [["amenity", ["cafe"]]],
  restaurant: [["amenity", ["restaurant"]]],
  bar: [["amenity", ["bar", "pub", "biergarten"]]],
  fast_food: [["amenity", ["fast_food", "food_court"]]],
  dessert: [["amenity", ["ice_cream"]], ["shop", ["pastry", "confectionery", "chocolate"]]],
  park: [["leisure", ["park", "garden"]]],
  museum: [["tourism", ["museum", "gallery"]]],
  cinema: [["amenity", ["cinema", "theatre"]]],
};
// Text search with no category: anywhere people meet over food, drinks or a show.
const ANY_PLACE: Category[] = ["cafe", "restaurant", "bar", "fast_food", "dessert", "cinema"];

const TAG_FILTERS: Partial<Record<Filter, string>> = {
  wheelchair: '["wheelchair"~"^(yes|limited)$"]',
  outdoor: '["outdoor_seating"="yes"]',
  vegetarian: '["diet:vegetarian"~"^(yes|only)$"]',
};

/** Letters, digits, spaces, hyphen, apostrophe only: nothing that could break out of the query string. */
export function cleanText(text: string): string {
  return text.normalize("NFC").replace(/[^\p{L}\p{N}\s'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export const MAX_VENUES = 300;

/** What to look for, independent of which provider answers. bbox = [west, south, east, north]. */
export type VenueQuery = {
  bbox: [number, number, number, number];
  categories: Category[];
  text: string;
  filters: Filter[];
};

export function venueQuery(zone: Area, categories: Category[], text: string, filters: Filter[]): VenueQuery {
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  const [w, s, e, n] = bbox(zone);
  return { bbox: [r(w), r(s), r(e), r(n)], categories: [...categories].sort(), text: cleanText(text), filters: [...filters].sort() };
}

const tagsFor = (categories: Category[]) => (categories.length ? categories : ANY_PLACE).flatMap((c) => CATEGORY_TAGS[c]);

export function buildOverpassQuery(q: VenueQuery, timeoutS = 25): string {
  const [w, s, e, n] = q.bbox;
  const box = `(${s},${w},${n},${e})`;
  const tagFilters = q.filters.map((f) => TAG_FILTERS[f] ?? "").join("");
  const textFilters = q.text ? [`["name"~"${q.text}",i]`, `["cuisine"~"${q.text}",i]`] : [""];
  const lines: string[] = [];
  for (const [k, vs] of tagsFor(q.categories)) {
    const sel = vs.length === 1 ? `["${k}"="${vs[0]}"]` : `["${k}"~"^(${vs.join("|")})$"]`;
    for (const tf of textFilters) lines.push(`nwr${sel}${tf}${tagFilters}["name"]${box};`);
  }
  return `[out:json][timeout:${timeoutS}];(${lines.join("")});out center tags ${MAX_VENUES};`;
}

/** Photon `osm_tag` filters (OR-ed) for the same categories. */
export function photonTags(categories: Category[]): string[] {
  return tagsFor(categories).flatMap(([k, vs]) => vs.map((v) => `${k}:${v}`));
}

export type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function categoryOf(tags: Record<string, string>): Category | "other" {
  for (const c of CATEGORIES) {
    if (CATEGORY_TAGS[c].some(([k, vs]) => vs.includes(tags[k]))) return c;
  }
  return "other";
}

/** Overpass elements -> venues, dropping unnamed ones and near-duplicates (same name within 40 m). */
export function parseOverpass(elements: OverpassElement[]): Venue[] {
  const out: Venue[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (lat == null || lon == null || !tags.name) continue;
    const p = { lat, lon };
    if (out.some((v) => v.name === tags.name && haversine(v.point, p) < 40)) continue;
    out.push({ id: `${el.type[0]}${el.id}`, name: tags.name, category: categoryOf(tags), point: p, tags });
  }
  return out;
}

export function venuesInZone(venues: Venue[], zone: Area): Venue[] {
  return venues.filter((v) => booleanPointInPolygon(point([v.point.lon, v.point.lat]), zone));
}

/**
 * Cheap pre-ranking before the expensive time matrix: for each person, which budget
 * ring the venue falls in. Lower worst ring wins, then lower sum of rings.
 */
export function shortlist(venues: Venue[], areasByBudget: (Area | null)[][], k: number): Venue[] {
  const people = areasByBudget[0]?.length ?? 0;
  const scored = venues.map((v) => {
    const pt = point([v.point.lon, v.point.lat]);
    const rings: number[] = [];
    for (let p = 0; p < people; p++) {
      let ring = areasByBudget.length;
      for (let b = 0; b < areasByBudget.length; b++) {
        const area = areasByBudget[b][p];
        if (area && booleanPointInPolygon(pt, area)) {
          ring = b;
          break;
        }
      }
      rings.push(ring);
    }
    return { v, worst: Math.max(...rings), sum: rings.reduce((a, b) => a + b, 0) };
  });
  scored.sort((a, b) => a.worst - b.worst || a.sum - b.sum);
  return scored.slice(0, k).map((s) => s.v);
}
