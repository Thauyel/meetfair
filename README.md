# meetfair

A fair place to meet, for everyone.

**Live:** https://meetfair-mu.vercel.app

Add 2–6 people, each with their own way of travelling (car, walk, bike or public transport). Pick what you want (café, restaurant, park… or search "sushi"). meetfair finds places where **nobody travels too long**. It is built on free, open data.

## How it works

1. **Reachable areas.** For each person it computes where they can get to in 15, 30, 45 and 60 minutes:
   - car, walk and bike use Valhalla isochrones;
   - transit uses Transitous one-to-all, which returns reachable stops plus walking from them.
2. **Fair zone.** It takes the smallest time budget at which everyone's areas overlap. That overlap (green on the map) is where it searches. If people are too far apart to overlap, it searches near the middle of the group instead and says so.
3. **Venues.** It looks for venues in the zone with Overpass (OSM tags: opening hours, wheelchair access, outdoor seating, vegetarian). If Overpass is slow, it falls back to Photon, which is faster but has fewer details. If there are too few venues, it steps up to the next budget.
4. **Exact times.** It gets exact travel times for the best ~40 candidates with one Valhalla matrix call per mode. Transit times are derived from the reachable stops.
5. **Ranking.**
   - Default, "nobody travels too long": lowest longest trip first, then smallest gap between trips, then lowest total.
   - Tabs switch to "most equal" or "least total time", and re-sort in the browser.

The search streams its progress as NDJSON (`areas → zone → venues → times → result`), so the UI shows real progress.

There are no accounts, no analytics and no database. The whole search lives in the URL, so a link reproduces it. Recent searches are kept only in your browser.

## Stack

- Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4, shadcn/ui (Base UI)
- MapLibre GL + OpenFreeMap tiles, Turf for geometry
- next-intl, in 12 languages: en, tr, es, zh, hi, ar (RTL), fr, pt, ru, de, ja, id. Every language except English was machine-translated and needs a native speaker's review.
- zod (validates API input and provider responses), `opening_hours` (OSM hours at the meeting time)
- PWA: web manifest, icons, a tiny service worker with an offline page

## Code map

| Path | What |
|---|---|
| `lib/engine/` | Pure search logic: zones, candidates, transit times, ranking. No I/O, unit-tested. |
| `lib/search.ts` | Runs a search over injected `Providers` and yields stage events. |
| `lib/providers/` | Thin clients for Photon, Nominatim, Valhalla, Transitous and Overpass; timeouts, throttling, `'use cache'`, mocks. |
| `app/api/search` | `POST`: validates the request and streams the search as NDJSON. |
| `app/api/geocode`, `app/api/reverse` | Autocomplete and reverse geocoding (CDN-cached). |
| `components/` | UI: people, location input (autocomplete, GPS, pin drop, paste a link), map, results. |
| `messages/` | Translations. A test checks that every language has the same keys and placeholders. |

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
MOCK_PROVIDERS=1 npm run dev   # fake routing/geocoding, no public servers
```

## Test

```bash
npm test               # unit + integration (engine, search flow, parsers, share links, translations)
npm run e2e            # Playwright, desktop + mobile, against a mock-provider build
LIVE=1 npx vitest run  # manual smoke test against the real public servers; run rarely
```

## Deploy

The project deploys to Vercel as is: every push to `main` deploys production through the Git integration.

- Vercel Firewall rate-limits `/api/search` to 10 requests per minute per IP. The Hobby plan allows only one rate-limit rule; geocoding is CDN-cached instead.
- Before promoting the app widely, tell the Transitous team about it (Matrix channel), as their API policy asks.

## Data and fair use

The app relies on volunteer-run public services: OpenStreetMap, Photon (komoot), Nominatim, FOSSGIS Valhalla, Transitous and OpenFreeMap. Calls are cached and throttled, and every provider sits behind a single URL constant in `lib/providers/`. If traffic grows, point those constants at self-hosted instances.

Known limits:
- Transit coverage depends on each city's open GTFS data.
- The public Overpass server is sometimes very slow. The app then shows results without detail tags and says so.

Map data © OpenStreetMap contributors. Transit data: [transitous.org/sources](https://transitous.org/sources).

## License

MIT
