import type { z } from "zod";

// Public OSM services require an identifying User-Agent with a contact.
export const USER_AGENT = "meetfair/0.1 (+https://github.com/Thauyel/meetfair)";

export class ProviderError extends Error {
  constructor(public provider: string, message: string) {
    super(`${provider}: ${message}`);
  }
}

// shortcut: per-instance spacing only; serverless instances do not share it. Upgrade to a shared limiter (KV) if traffic grows.
const nextSlot = new Map<string, number>();

/** Space calls to one provider at least `gapMs` apart (start times). */
export async function waitTurn(key: string, gapMs: number): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(key) ?? 0);
  nextSlot.set(key, slot + gapMs);
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

type Options = {
  provider: string;
  gapMs: number;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: BodyInit;
  headers?: Record<string, string>;
};

export async function fetchJson<S extends z.ZodType>(url: string, schema: S, o: Options): Promise<z.infer<S>> {
  await waitTurn(o.provider, o.gapMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: o.method ?? "GET",
      body: o.body,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...o.headers },
      signal: AbortSignal.timeout(o.timeoutMs ?? 12_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new ProviderError(o.provider, e instanceof Error ? e.message : "network error");
  }
  if (!res.ok) throw new ProviderError(o.provider, `HTTP ${res.status}`);
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ProviderError(o.provider, "unexpected response");
  return parsed.data;
}
