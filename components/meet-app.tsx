"use client";

import { History, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clearRecent, loadRecent, localNow, readNdjson, saveRecent, type Recent } from "@/lib/client";
import { rankVenues } from "@/lib/engine/rank";
import { decodeState, emptyPerson, encodeState, type AppState, type PersonDraft } from "@/lib/share-state";
import { MAX_PEOPLE, MIN_PEOPLE, type Area, type LatLon, type SearchRequest } from "@/lib/types";
import { PERSON_COLORS, RESULTS_SHOWN, shortLabel } from "@/lib/ui";
import { reverseLabel } from "./location-input";
import { PersonCard } from "./person-card";
import { Results, SearchError, SearchProgress, type SearchView } from "./results";
import { VenuePicker } from "./venue-picker";

const MapView = dynamic(() => import("./map-view"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

let nextId = 0;
const newId = () => `p${nextId++}`;

export default function MeetApp() {
  const t = useTranslations();
  const locale = useLocale();
  const [state, setState] = useState<AppState>(() => decodeState(window.location.search));
  const [ids, setIds] = useState(() => state.people.map(newId));
  // Opened from a shared link with everything filled in: search right away.
  const [autoRun] = useState(
    () => new URLSearchParams(window.location.search).has("p") && state.people.every((p) => p.point) && (state.categories.length > 0 || !!state.text.trim()),
  );
  const [view, setView] = useState<SearchView>(() => (autoRun ? { status: "running" } : { status: "idle" }));
  const [zone, setZone] = useState<{ zone: Area; areas: (Area | null)[] } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<number | null>(null);
  const [recent, setRecent] = useState<Recent[]>(loadRecent);
  const ctl = useRef<AbortController | null>(null);

  // The URL is the source of truth for sharing: keep it in step with the state.
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${encodeState(state)}`);
  }, [state]);

  const patch = (p: Partial<AppState>) => setState((s) => ({ ...s, ...p }));
  const setPerson = (i: number, p: PersonDraft) => setState((s) => ({ ...s, people: s.people.map((x, j) => (j === i ? p : x)) }));

  const names = state.people.map((p, i) => (p.label ? `${i + 1}. ${shortLabel(p.label)}` : t("people.person", { n: i + 1 })));
  const missingPlace = state.people.some((p) => !p.point);
  const missingWhat = state.categories.length === 0 && !state.text.trim();

  /** Network part of a search. Every state update happens after an await, so it can start from an effect. */
  const fetchSearch = useCallback(async (s: AppState) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const req: SearchRequest = {
      people: s.people.map((p) => ({ label: p.label.slice(0, 80), mode: p.mode, point: p.point as LatLon })),
      departAt: (s.time ? new Date(s.time) : new Date()).toISOString(),
      localTime: s.time || localNow(),
      categories: s.categories,
      text: s.text.trim(),
      filters: s.filters,
    };
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: c.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return setView({ status: "error", code: body?.code ?? "internal" });
      }
      let meta = { budgetMin: 0, farApart: false, estimatedPeople: [] as number[] };
      await readNdjson(res, (e) => {
        if (e.type === "stage") setView({ status: "running", stage: e.stage });
        else if (e.type === "zone") {
          meta = { budgetMin: e.budgetMin, farApart: e.farApart, estimatedPeople: e.estimatedPeople };
          setZone({ zone: e.zone, areas: e.areas });
        } else if (e.type === "result") {
          setView({ status: "done", venues: e.venues, limited: e.limited, ...meta });
          setRecent(saveRecent({ query: encodeState(s), summary: s.people.map((p) => shortLabel(p.label)).join(" · "), at: Date.now() }));
        } else if (e.type === "error") setView({ status: "error", code: e.code });
      });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setView({ status: "error", code: "network" });
    }
  }, []);

  function runSearch(s: AppState) {
    setView({ status: "running" });
    setZone(null);
    setSelectedId(null);
    setPinFor(null);
    void fetchSearch(s);
  }

  // A shared link opens straight into its results (view starts as "running" for it, see autoRun).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !autoRun) return;
    autoRan.current = true;
    void fetchSearch(state);
  }, [autoRun, fetchSearch, state]);

  const ranked = useMemo(
    () => (view.status === "done" ? rankVenues(view.venues, state.sort).slice(0, RESULTS_SHOWN) : []),
    [view, state.sort],
  );

  function selectVenue(id: string) {
    setSelectedId(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`venue-${id}`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  async function pickOnMap(point: LatLon) {
    const i = pinFor;
    if (i == null) return;
    setPinFor(null);
    setPerson(i, { ...state.people[i], label: t("location.pinned"), point });
    const label = await reverseLabel(point, locale);
    setState((s) => ({ ...s, people: s.people.map((p, j) => (j === i && p.point === point ? { ...p, label } : p)) }));
  }

  function addPerson() {
    setState((s) => ({ ...s, people: [...s.people, emptyPerson()] }));
    setIds((x) => [...x, newId()]);
  }

  function removePerson(i: number) {
    setState((s) => ({ ...s, people: s.people.filter((_, j) => j !== i) }));
    setIds((x) => x.filter((_, j) => j !== i));
    setPinFor(null);
  }

  function restore(r: Recent) {
    const s = decodeState(r.query);
    setState(s);
    setIds(s.people.map(newId));
    void runSearch(s);
  }

  const mapPeople = state.people.map((p, i) => ({ point: p.point, color: PERSON_COLORS[i], name: names[i] }));
  const resultPeople = state.people.map((p, i) => ({ name: names[i], color: PERSON_COLORS[i], mode: p.mode, point: p.point as LatLon }));
  // Bias autocomplete towards someone already placed: friends usually live in the same city.
  const bias = state.people.find((p) => p.point)?.point ?? undefined;

  return (
    <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(380px,440px)_1fr]">
      <div className="sticky top-0 z-10 h-[38svh] border-b lg:order-2 lg:h-auto lg:border-b-0 lg:border-s">
        <MapView
          people={mapPeople}
          zone={zone?.zone ?? null}
          areas={zone?.areas ?? []}
          venues={ranked}
          selectedId={selectedId}
          onSelect={selectVenue}
          pinFor={pinFor}
          onPick={pickOnMap}
        />
        {pinFor != null && (
          <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2 rounded-lg bg-foreground px-3 py-2 text-sm text-background shadow-lg lg:inset-x-auto lg:start-2" role="status">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {t("location.pinActive", { name: names[pinFor] })}
            </span>
            <button type="button" onClick={() => setPinFor(null)} aria-label={t("location.cancelPin")} className="rounded p-0.5 hover:bg-background/20">
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div className="relative space-y-6 p-4 lg:order-1 lg:overflow-y-auto">
        <section aria-labelledby="people-title" className="space-y-2">
          <h2 id="people-title" className="text-sm font-semibold">{t("people.title")}</h2>
          <ol className="space-y-2">
            {state.people.map((p, i) => (
              <PersonCard
                key={ids[i]}
                person={p}
                name={t("people.person", { n: i + 1 })}
                color={PERSON_COLORS[i]}
                bias={bias}
                canRemove={state.people.length > MIN_PEOPLE}
                pinActive={pinFor === i}
                onChange={(np) => setPerson(i, np)}
                onRemove={() => removePerson(i)}
                onPinToggle={() => {
                  setPinFor(pinFor === i ? null : i);
                  if (pinFor !== i && window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </ol>
          {state.people.length < MAX_PEOPLE ? (
            <Button variant="outline" size="sm" onClick={addPerson}>
              <Plus /> {t("people.add")}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t("people.max", { max: MAX_PEOPLE })}</p>
          )}
        </section>

        <VenuePicker categories={state.categories} text={state.text} filters={state.filters} time={state.time} onChange={patch} />

        <div className="space-y-1.5">
          <Button
            size="lg"
            className="h-11 w-full text-base"
            disabled={missingPlace || missingWhat || view.status === "running"}
            onClick={() => runSearch(state)}
          >
            {view.status === "running" ? <Loader2 className="animate-spin" /> : <Search />}
            {view.status === "running" ? t("search.searching") : t("search.button")}
          </Button>
          {(missingPlace || missingWhat) && (
            <p className="text-center text-xs text-muted-foreground">{missingPlace ? t("search.needPeople") : t("search.needWhat")}</p>
          )}
        </div>

        {view.status === "running" && <SearchProgress stage={view.stage} />}
        {view.status === "error" && <SearchError code={view.code} onRetry={() => runSearch(state)} />}
        {view.status === "done" && (
          <Results
            view={view}
            ranked={ranked}
            people={resultPeople}
            sort={state.sort}
            onSort={(sort) => patch({ sort })}
            selectedId={selectedId}
            onSelect={selectVenue}
            usedTagFilters={state.filters.some((f) => f !== "open")}
          />
        )}

        {recent.length > 0 && view.status !== "running" && (
          <section aria-labelledby="recent-title" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 id="recent-title" className="flex items-center gap-1.5 text-sm font-semibold">
                <History className="size-4" aria-hidden /> {t("recent.title")}
              </h2>
              <Button variant="ghost" size="xs" onClick={() => (clearRecent(), setRecent([]))}>
                {t("recent.clear")}
              </Button>
            </div>
            <ul className="space-y-1">
              {recent.map((r) => (
                <li key={r.query}>
                  <button type="button" onClick={() => restore(r)} className="w-full truncate rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted">
                    {r.summary || "…"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
