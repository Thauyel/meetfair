"use client";

import { Loader2, LocateFixed, MapPin, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseLocation } from "@/lib/parse-location";
import type { Place } from "@/lib/providers/geocoding";
import type { LatLon } from "@/lib/types";

export async function reverseLabel(point: LatLon, lang: string): Promise<string> {
  try {
    const r = await fetch(`/api/reverse?lat=${point.lat}&lon=${point.lon}&lang=${lang}`);
    if (r.ok) return ((await r.json()) as Place).label;
  } catch {}
  return `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;
}

type Props = {
  label: string;
  hasPoint: boolean;
  personName: string;
  bias?: LatLon;
  pinActive: boolean;
  onPick: (label: string, point: LatLon) => void;
  onClear: () => void;
  onPinToggle: () => void;
};

export function LocationInput({ label, hasPoint, personName, bias, pinActive, onPick, onClear, onPinToggle }: Props) {
  const t = useTranslations("location");
  const lang = useLocale();
  const listId = useId();
  const [query, setQuery] = useState(label);
  const [prevLabel, setPrevLabel] = useState(label);
  const [items, setItems] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The parent changes the label on GPS, pin drop or a restored search.
  if (label !== prevLabel) {
    setPrevLabel(label);
    setQuery(label);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  async function pickPoint(point: LatLon) {
    setOpen(false);
    setBusy(true);
    const name = await reverseLabel(point, lang);
    setBusy(false);
    onPick(name, point);
  }

  function choose(p: Place) {
    setOpen(false);
    setItems([]);
    setQuery(p.label);
    onPick(p.label, p.point);
  }

  function onChange(value: string) {
    setQuery(value);
    setHint("");
    clearTimeout(timer.current);
    ctl.current?.abort();
    const coords = parseLocation(value);
    if (coords) return void pickPoint(coords);
    if (/^https?:\/\//i.test(value.trim())) return setHint(t("linkUnreadable"));
    if (value.trim().length < 2) return setItems([]);
    timer.current = setTimeout(async () => {
      const c = new AbortController();
      ctl.current = c;
      const sp = new URLSearchParams({ q: value.trim(), lang });
      if (bias) {
        sp.set("lat", String(bias.lat));
        sp.set("lon", String(bias.lon));
      }
      try {
        const r = await fetch(`/api/geocode?${sp}`, { signal: c.signal });
        const places = r.ok ? ((await r.json()) as Place[]) : [];
        setItems(places);
        setActive(places.length ? 0 : -1);
        setOpen(true);
      } catch {}
    }, 250);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") setActive((a) => (a + 1) % items.length);
    else if (e.key === "ArrowUp") setActive((a) => (a - 1 + items.length) % items.length);
    else if (e.key === "Enter" && active >= 0) choose(items[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  }

  function locate() {
    if (!navigator.geolocation) return void toast.error(t("gpsFailed"));
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void pickPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        setBusy(false);
        toast.error(err.code === err.PERMISSION_DENIED ? t("gpsDenied") : t("gpsFailed"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Input
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-label={t("inputLabel", { name: personName })}
            placeholder={t("placeholder")}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => items.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="pe-8"
            autoComplete="off"
            spellCheck={false}
          />
          {busy ? (
            <Loader2 className="absolute end-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label={t("locating")} />
          ) : (
            (query || hasPoint) && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setItems([]);
                  onClear();
                }}
                className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={t("clear")}
              >
                <X className="size-4" />
              </button>
            )
          )}
        </div>
        <Button type="button" variant="outline" size="icon" onClick={locate} aria-label={t("gps")} title={t("gps")}>
          <LocateFixed />
        </Button>
        <Button
          type="button"
          variant={pinActive ? "default" : "outline"}
          size="icon"
          onClick={onPinToggle}
          aria-pressed={pinActive}
          aria-label={t("pin")}
          title={t("pin")}
        >
          <MapPin />
        </Button>
      </div>
      {hint && <p className="mt-1 text-xs text-destructive">{hint}</p>}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-lg"
        >
          {items.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">{t("noResults")}</li>
          ) : (
            items.map((p, i) => (
              <li
                key={`${p.point.lat},${p.point.lon},${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded-md px-2 py-1.5 ${i === active ? "bg-accent text-accent-foreground" : ""}`}
              >
                <div className="font-medium">{p.label}</div>
                {p.detail && <div className="text-xs text-muted-foreground">{p.detail}</div>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
