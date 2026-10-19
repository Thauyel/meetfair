import { roundCoord } from "@/lib/geo";
import { reverseGeocode } from "@/lib/providers/geocoding";
import { latLonSchema } from "@/lib/schema";

/** GET /api/reverse?lat=..&lon=..&lang=en -> Place */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const parsed = latLonSchema.safeParse({ lat: Number(sp.get("lat")), lon: Number(sp.get("lon")) });
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const point = { lat: roundCoord(parsed.data.lat), lon: roundCoord(parsed.data.lon) };
  const lang = (sp.get("lang") ?? "en").slice(0, 5);
  try {
    const place =
      process.env.MOCK_PROVIDERS === "1"
        ? { label: `${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`, detail: "Mock City", point }
        : await reverseGeocode(point, lang);
    return Response.json(place, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "geocoder_unavailable" }, { status: 502 });
  }
}
