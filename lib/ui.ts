import type { Venue } from "./types";

/** One colour per person, readable on both light and dark map styles. */
export const PERSON_COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2"] as const;

/** A venue counts as "fair" when everyone's trips are within this many seconds of each other. */
export const FAIR_SPREAD_S = 5 * 60;

export const RESULTS_SHOWN = 10;

export function formatMinutes(seconds: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "unit", unit: "minute", unitDisplay: "short" }).format(
    Math.max(1, Math.round(seconds / 60)),
  );
}

/** Localised name when OSM has one (name:tr, name:ar...). */
export function venueName(v: Venue, locale: string): string {
  return v.tags[`name:${locale}`] ?? v.name;
}

export function shortLabel(label: string): string {
  return label.split(",")[0].trim();
}
