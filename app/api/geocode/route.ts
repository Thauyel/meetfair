import { photonSearch } from "@/lib/providers/geocoding";
import { mockPlaces } from "@/lib/providers/mock";

/** GET /api/geocode?q=...&lang=en[&lat=..&lon=..] -> Place[] */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 120);
  const lang = (sp.get("lang") ?? "en").slice(0, 5);
  const lat = Number(sp.get("lat")), lon = Number(sp.get("lon"));
  if (q.length < 2) return Response.json([]);
  const bias = Number.isFinite(lat) && Number.isFinite(lon) && sp.has("lat") ? { lat, lon } : undefined;
  try {
    const places = process.env.MOCK_PROVIDERS === "1" ? mockPlaces(q) : await photonSearch(q, lang, bias);
    // Same query, same answer for a day: let the CDN absorb repeats.
    return Response.json(places, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "geocoder_unavailable" }, { status: 502 });
  }
}
