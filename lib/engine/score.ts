import OpeningHours from "opening_hours";
import type { OpenState, Venue } from "../types";

/** "YYYY-MM-DDTHH:mm" -> Date whose local fields equal that wall-clock time, whatever the server's time zone. */
export function wallClockDate(localTime: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localTime);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi);
}

export function openState(venue: Venue, localTime: string): OpenState {
  const value = venue.tags.opening_hours;
  const at = wallClockDate(localTime);
  if (!value || !at) return "unknown";
  try {
    // No address: rules with public holidays or sunrise throw and land in "unknown".
    const oh = new OpeningHours(value, { lat: venue.point.lat, lon: venue.point.lon, address: { country_code: "", state: "" } });
    if (oh.getUnknown(at)) return "unknown";
    return oh.getState(at) ? "open" : "closed";
  } catch {
    return "unknown";
  }
}
