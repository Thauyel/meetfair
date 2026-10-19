"use client";

import { getRTLTextPluginStatus, setRTLTextPlugin, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import type { Area, LatLon, ScoredVenue } from "@/lib/types";

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-worker.mjs");

// Arabic/Hebrew map labels need shaping; loaded only when such text is on screen.
if (typeof window !== "undefined" && getRTLTextPluginStatus() === "unavailable") {
  setRTLTextPlugin("https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js", true).catch(() => {});
}

export type MapPerson = { point: LatLon | null; color: string; name: string };

type Props = {
  people: MapPerson[];
  zone: Area | null;
  areas: (Area | null)[];
  venues: ScoredVenue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pinFor: number | null;
  onPick: (point: LatLon) => void;
};

export default function MapView({ people, zone, areas, venues, selectedId, onSelect, pinFor, onPick }: Props) {
  const t = useTranslations("map");
  const { resolvedTheme } = useTheme();
  const ref = useRef<MapRef>(null);

  const points = useMemo(
    () => [...people.flatMap((p) => (p.point ? [p.point] : [])), ...venues.map((v) => v.point)],
    [people, venues],
  );
  const fitKey = points.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join("|");

  useEffect(() => {
    const map = ref.current;
    if (!map || points.length === 0) return;
    const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(
      [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: 56, maxZoom: 15, duration: reduce ? 0 : 700 },
    );
    // points is derived from fitKey; refitting on every array identity change would fight the user's panning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <Map
      ref={ref}
      initialViewState={{ longitude: 15, latitude: 30, zoom: 1.4 }}
      mapStyle={resolvedTheme === "dark" ? STYLES.dark : STYLES.light}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      cursor={pinFor != null ? "crosshair" : undefined}
      onClick={(e) => pinFor != null && onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng })}
      aria-label={t("label")}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {areas.map((a, i) =>
        a ? (
          <Source key={`area-${i}`} id={`area-${i}`} type="geojson" data={a}>
            <Layer id={`area-fill-${i}`} type="fill" paint={{ "fill-color": people[i]?.color ?? "#888", "fill-opacity": 0.08 }} />
            <Layer id={`area-line-${i}`} type="line" paint={{ "line-color": people[i]?.color ?? "#888", "line-width": 1.5, "line-opacity": 0.6 }} />
          </Source>
        ) : null,
      )}
      {zone && (
        <Source id="zone" type="geojson" data={zone}>
          <Layer id="zone-fill" type="fill" paint={{ "fill-color": "#22c55e", "fill-opacity": 0.18 }} />
          <Layer id="zone-line" type="line" paint={{ "line-color": "#16a34a", "line-width": 2, "line-dasharray": [2, 1.5] }} />
        </Source>
      )}

      {people.map((p, i) =>
        p.point ? (
          <Marker key={`p-${i}`} longitude={p.point.lon} latitude={p.point.lat} anchor="center">
            <div
              className="grid size-8 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md"
              style={{ background: p.color }}
              title={p.name}
              role="img"
              aria-label={p.name}
            >
              {i + 1}
            </div>
          </Marker>
        ) : null,
      )}

      {venues.map((v, i) => {
        const selected = v.id === selectedId;
        return (
          <Marker
            key={v.id}
            longitude={v.point.lon}
            latitude={v.point.lat}
            anchor="bottom"
            style={{ zIndex: selected ? 2 : 1 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(v.id);
            }}
          >
            <button
              type="button"
              aria-label={t("venuePin", { rank: i + 1, name: v.name })}
              aria-pressed={selected}
              className={`grid place-items-center rounded-full border-2 font-semibold shadow-md transition-transform ${
                selected ? "size-9 scale-110 border-white bg-foreground text-background" : "size-7 border-background bg-primary text-xs text-primary-foreground"
              }`}
            >
              {i + 1}
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
