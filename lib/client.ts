// Browser-only helpers.
import type { SearchEvent } from "./types";

/** Calls onEvent for each NDJSON line of a streamed response. */
export async function readNdjson(res: Response, onEvent: (e: SearchEvent) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as SearchEvent);
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as SearchEvent);
}

export type Recent = { query: string; summary: string; at: number };
const RECENT_KEY = "meetfair:recent";
const MAX_RECENT = 10;

// localStorage can be missing or throw (private mode, blocked storage): recents are a convenience only.
export function loadRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => typeof r?.query === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function saveRecent(r: Recent): Recent[] {
  const next = [r, ...loadRecent().filter((x) => x.query !== r.query)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}

/** Wall-clock "YYYY-MM-DDTHH:mm" in the browser's time zone. */
export function localNow(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
