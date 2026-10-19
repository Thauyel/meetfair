import type { Feature, MultiPolygon, Polygon } from "geojson";

export const MODES = ["car", "walk", "bike", "transit"] as const;
export type Mode = (typeof MODES)[number];

export const CATEGORIES = [
  "cafe",
  "restaurant",
  "bar",
  "fast_food",
  "dessert",
  "park",
  "museum",
  "cinema",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FILTERS = ["open", "wheelchair", "outdoor", "vegetarian"] as const;
export type Filter = (typeof FILTERS)[number];

export const SORTS = ["fair", "equal", "total"] as const;
export type Sort = (typeof SORTS)[number];

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 6;
/** Beyond this, "meet in the middle" is a road trip and the venue search area would be huge. */
export const MAX_SPREAD_KM = 150;

export type LatLon = { lat: number; lon: number };

export type Person = { label: string; mode: Mode; point: LatLon };

export type SearchRequest = {
  people: Person[];
  /** Absolute departure instant (ISO). Used for transit schedules. */
  departAt: string;
  /** Wall-clock meeting time "YYYY-MM-DDTHH:mm" in the venues' local time. Used for opening hours. */
  localTime: string;
  categories: Category[];
  text: string;
  filters: Filter[];
};

export type Area = Feature<Polygon | MultiPolygon>;

export type Venue = {
  id: string;
  name: string;
  category: Category | "other";
  point: LatLon;
  tags: Record<string, string>;
};

export type OpenState = "open" | "closed" | "unknown";

export type ScoredVenue = Venue & {
  /** Seconds per person, same order as request.people. null = unreachable. */
  times: (number | null)[];
  /** true where the time is a straight-line estimate, not a routed time. */
  estimated: boolean[];
  max: number;
  spread: number;
  total: number;
  open: OpenState;
};

export type SearchStage = "areas" | "zone" | "venues" | "times";

export type SearchEvent =
  | { type: "stage"; stage: SearchStage }
  | {
      type: "zone";
      budgetMin: number;
      zone: Area;
      areas: (Area | null)[];
      farApart: boolean;
      /** Indexes of people whose area is an estimate (provider failed). */
      estimatedPeople: number[];
    }
  /** limited = venue details (hours, accessibility) unavailable, so tag filters were not applied. */
  | { type: "result"; venues: ScoredVenue[]; limited: boolean }
  | { type: "error"; code: "bad_request" | "too_far" | "providers_down" | "internal" };
