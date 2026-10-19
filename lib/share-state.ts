import {
  CATEGORIES,
  FILTERS,
  MAX_PEOPLE,
  MIN_PEOPLE,
  MODES,
  SORTS,
  type Category,
  type Filter,
  type LatLon,
  type Mode,
  type Sort,
} from "./types";

export type PersonDraft = { label: string; mode: Mode; point: LatLon | null };

export type AppState = {
  people: PersonDraft[];
  categories: Category[];
  text: string;
  filters: Filter[];
  /** "" = now, else wall-clock "YYYY-MM-DDTHH:mm" */
  time: string;
  sort: Sort;
};

export const emptyPerson = (mode: Mode = "transit"): PersonDraft => ({ label: "", mode, point: null });

export const DEFAULT_STATE: AppState = {
  people: [emptyPerson(), emptyPerson()],
  categories: ["cafe"],
  text: "",
  filters: [],
  time: "",
  sort: "fair",
};

const pick = <T extends string>(allowed: readonly T[], v: string | null): T[] =>
  (v ?? "").split(",").filter((x, i, a): x is T => (allowed as readonly string[]).includes(x) && a.indexOf(x) === i);

// p = "lat,lon,mode,label|lat,lon,mode,label". Only "%", "," and "|" in labels are escaped (URLSearchParams does the rest),
// so links stay readable instead of double-encoded.
const escapeLabel = (s: string) => s.replace(/[%,|]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
function encodePeople(people: PersonDraft[]): string {
  return people
    .map((p) => [p.point?.lat.toFixed(5) ?? "", p.point?.lon.toFixed(5) ?? "", p.mode, escapeLabel(p.label)].join(","))
    .join("|");
}

function decodePeople(v: string | null): PersonDraft[] {
  if (!v) return DEFAULT_STATE.people.map((p) => ({ ...p }));
  const people = v
    .split("|")
    .slice(0, MAX_PEOPLE)
    .map((entry): PersonDraft => {
      const [la, lo, mode, label = ""] = entry.split(",");
      const lat = Number(la), lon = Number(lo);
      const ok = la !== "" && lo !== "" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
      let name = "";
      try {
        name = decodeURIComponent(label).slice(0, 80);
      } catch {}
      return {
        label: name,
        mode: (MODES as readonly string[]).includes(mode) ? (mode as Mode) : "transit",
        point: ok ? { lat, lon } : null,
      };
    });
  while (people.length < MIN_PEOPLE) people.push(emptyPerson());
  return people;
}

export function encodeState(s: AppState): string {
  const sp = new URLSearchParams();
  sp.set("p", encodePeople(s.people));
  if (s.categories.length) sp.set("c", s.categories.join(","));
  if (s.text) sp.set("q", s.text);
  if (s.filters.length) sp.set("f", s.filters.join(","));
  if (s.time) sp.set("t", s.time);
  if (s.sort !== "fair") sp.set("s", s.sort);
  return sp.toString();
}

export function decodeState(search: string): AppState {
  const sp = new URLSearchParams(search);
  const time = sp.get("t") ?? "";
  const sort = sp.get("s") ?? "";
  return {
    people: decodePeople(sp.get("p")),
    categories: sp.has("c") ? pick(CATEGORIES, sp.get("c")) : DEFAULT_STATE.categories,
    text: (sp.get("q") ?? "").slice(0, 60),
    filters: pick(FILTERS, sp.get("f")),
    time: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time) ? time : "",
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : "fair",
  };
}
