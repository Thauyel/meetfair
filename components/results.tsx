"use client";

import { Check, ChevronDown, Info, Loader2, Navigation, RotateCw, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { directionLinks } from "@/lib/directions";
import { MAX_SPREAD_KM, SORTS, type LatLon, type Mode, type ScoredVenue, type SearchStage, type Sort } from "@/lib/types";
import { FAIR_SPREAD_S, formatMinutes, venueName } from "@/lib/ui";
import { MODE_ICONS } from "./mode-picker";

export type ResultPerson = { name: string; color: string; mode: Mode; point: LatLon };

export type SearchView =
  | { status: "idle" }
  | { status: "running"; stage?: SearchStage }
  | { status: "error"; code: string }
  | {
      status: "done";
      venues: ScoredVenue[];
      budgetMin: number;
      farApart: boolean;
      estimatedPeople: number[];
      limited: boolean;
    };

const STAGES: SearchStage[] = ["areas", "zone", "venues", "times"];

export function SearchProgress({ stage }: { stage?: SearchStage }) {
  const t = useTranslations("search.stage");
  const at = stage ? STAGES.indexOf(stage) : 0;
  return (
    <ol className="space-y-1.5 text-sm" aria-live="polite">
      {STAGES.map((s, i) => (
        <li key={s} className={`flex items-center gap-2 ${i > at ? "text-muted-foreground/60" : ""}`}>
          {i < at ? <Check className="size-4 text-emerald-600" aria-hidden /> : i === at ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <span className="size-4" />}
          {t(s)}
        </li>
      ))}
    </ol>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function SearchError({ code, onRetry }: { code: string; onRetry: () => void }) {
  const t = useTranslations("results");
  const known = ["bad_request", "too_far", "providers_down", "internal", "network"];
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p>{t(`error.${known.includes(code) ? code : "internal"}`, { km: MAX_SPREAD_KM })}</p>
      {code !== "too_far" && code !== "bad_request" && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw /> {t("retry")}
        </Button>
      )}
    </div>
  );
}

async function share(title: string, copied: string, failed: string) {
  const url = window.location.href;
  try {
    if (navigator.share) return await navigator.share({ title, url });
    await navigator.clipboard.writeText(url);
    toast.success(copied);
  } catch (e) {
    if ((e as Error)?.name !== "AbortError") toast.error(failed);
  }
}

type ResultsProps = {
  view: Extract<SearchView, { status: "done" }>;
  ranked: ScoredVenue[];
  people: ResultPerson[];
  sort: Sort;
  onSort: (s: Sort) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  usedTagFilters: boolean;
};

export function Results({ view, ranked, people, sort, onSort, selectedId, onSelect, usedTagFilters }: ResultsProps) {
  const t = useTranslations();
  const hasTransit = people.some((p) => p.mode === "transit");
  const estimatedNames = view.estimatedPeople.map((i) => people[i]?.name).filter(Boolean);

  return (
    <section aria-labelledby="results-title" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="results-title" className="text-base font-semibold">
          {t("results.title")}
        </h2>
        <Button size="sm" variant="outline" onClick={() => share(t("share.title"), t("share.copied"), t("share.failed"))}>
          <Share2 /> {t("share.button")}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {t("results.count", { count: ranked.length })}
      </p>

      <div className="space-y-1.5">
        {!view.farApart && ranked.length > 0 && <Notice>{t("results.budget", { min: view.budgetMin })}</Notice>}
        {view.farApart && <Notice>{t("results.farApart")}</Notice>}
        {estimatedNames.length > 0 && <Notice>{t("results.estimated", { names: estimatedNames.join(", ") })}</Notice>}
        {view.limited && usedTagFilters && <Notice>{t("results.limited")}</Notice>}
        {hasTransit && <Notice>{t("results.transitNote")}</Notice>}
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">{t("results.none")}</p>
      ) : (
        <>
          <Tabs value={sort} onValueChange={(v) => onSort(v as Sort)}>
            <TabsList className="w-full">
              {SORTS.map((s) => (
                <TabsTrigger key={s} value={s} className="flex-1 text-xs">
                  {t(`results.sort.${s}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <ol className="space-y-2">
            {ranked.map((v, i) => (
              <ResultCard key={v.id} venue={v} rank={i + 1} people={people} selected={v.id === selectedId} onSelect={() => onSelect(v.id)} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function ResultCard({ venue, rank, people, selected, onSelect }: { venue: ScoredVenue; rank: number; people: ResultPerson[]; selected: boolean; onSelect: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const name = venueName(venue, locale);
  const longest = Math.max(...venue.times.map((s) => s ?? 0), 1);

  return (
    <li
      id={`venue-${venue.id}`}
      className={`rounded-xl border bg-card p-3 transition-shadow ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{rank}</span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onSelect} aria-pressed={selected} className="text-start font-medium hover:underline focus-visible:underline outline-none">
            {name}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t(`category.${venue.category}`)}</span>
            {venue.spread <= FAIR_SPREAD_S && <Badge variant="secondary">{t("results.fair")}</Badge>}
            {venue.open === "open" && <Badge className="bg-emerald-600 text-white">{t("results.open")}</Badge>}
            {venue.open === "closed" && <Badge variant="destructive">{t("results.closed")}</Badge>}
            {venue.open === "unknown" && <span>{t("results.hoursUnknown")}</span>}
          </div>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1">
        {people.map((p, i) => {
          const s = venue.times[i];
          const Icon = MODE_ICONS[p.mode];
          return (
            <li key={i} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${((s ?? 0) / longest) * 100}%`, background: p.color }} />
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Icon className="size-3.5 text-muted-foreground" aria-label={t(`mode.${p.mode}`)} />
                {s == null ? t("results.unreachable") : `${venue.estimated[i] ? "~" : ""}${formatMinutes(s, locale)}`}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{t("results.longest", { time: formatMinutes(venue.max, locale) })}</span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
            <Navigation /> {t("results.directions")} <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {people.map((p, i) => {
              const l = directionLinks(p.point, venue.point, p.mode);
              return (
                <DropdownMenuGroup key={i}>
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                    {t("results.directionsFor", { name: p.name })}
                  </DropdownMenuLabel>
                  <DropdownMenuItem render={<a href={l.google} target="_blank" rel="noopener noreferrer" />}>Google Maps</DropdownMenuItem>
                  <DropdownMenuItem render={<a href={l.apple} target="_blank" rel="noopener noreferrer" />}>Apple Maps</DropdownMenuItem>
                  {l.osm && <DropdownMenuItem render={<a href={l.osm} target="_blank" rel="noopener noreferrer" />}>OpenStreetMap</DropdownMenuItem>}
                </DropdownMenuGroup>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
