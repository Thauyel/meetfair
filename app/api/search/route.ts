import { providers } from "@/lib/providers";
import { maxSpreadKm, searchRequestSchema } from "@/lib/schema";
import { MAX_SPREAD_KM } from "@/lib/types";
import { runSearch } from "@/lib/search";
import type { SearchEvent } from "@/lib/types";

// Several public routers in sequence (rate-limited) can take a while.
export const maxDuration = 60;

const line = (e: SearchEvent) => new TextEncoder().encode(JSON.stringify(e) + "\n");

/** Streams the search as NDJSON SearchEvents so the UI can show real progress. */
export async function POST(request: Request) {
  const parsed = searchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ type: "error", code: "bad_request" }, { status: 400 });
  if (maxSpreadKm(parsed.data.people.map((p) => p.point)) > MAX_SPREAD_KM) {
    return Response.json({ type: "error", code: "too_far" }, { status: 422 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const e of runSearch(parsed.data, providers)) controller.enqueue(line(e));
      } catch (e) {
        console.error("search failed", e);
        controller.enqueue(line({ type: "error", code: "internal" }));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
