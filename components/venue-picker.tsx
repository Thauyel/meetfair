"use client";

import { Accessibility, Clock, IceCreamCone, Landmark, Leaf, Search, Sandwich, Sofa, Trees, Utensils, Wine, Coffee, Clapperboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { localNow } from "@/lib/client";
import { CATEGORIES, FILTERS, type Category, type Filter } from "@/lib/types";

const CATEGORY_ICONS: Record<Category, typeof Coffee> = {
  cafe: Coffee,
  restaurant: Utensils,
  bar: Wine,
  fast_food: Sandwich,
  dessert: IceCreamCone,
  park: Trees,
  museum: Landmark,
  cinema: Clapperboard,
};
const FILTER_ICONS: Record<Filter, typeof Coffee> = { open: Clock, wheelchair: Accessibility, outdoor: Sofa, vegetarian: Leaf };

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

type Props = {
  categories: Category[];
  text: string;
  filters: Filter[];
  time: string;
  onChange: (p: { categories?: Category[]; text?: string; filters?: Filter[]; time?: string }) => void;
};

export function VenuePicker({ categories, text, filters, time, onChange }: Props) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <section aria-labelledby="what-title" className="space-y-2">
        <h2 id="what-title" className="text-sm font-semibold">{t("venue.title")}</h2>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            return (
              <Chip key={c} pressed={categories.includes(c)} onClick={() => onChange({ categories: toggle(categories, c) })}>
                <Icon aria-hidden /> {t(`category.${c}`)}
              </Chip>
            );
          })}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={text}
            maxLength={60}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder={t("venue.search")}
            aria-label={t("venue.searchLabel")}
            className="ps-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("venue.filters")}>
          {FILTERS.map((f) => {
            const Icon = FILTER_ICONS[f];
            return (
              <Chip key={f} pressed={filters.includes(f)} onClick={() => onChange({ filters: toggle(filters, f) })}>
                <Icon aria-hidden /> {t(`venue.${f}`)}
              </Chip>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="when-title" className="space-y-2">
        <h2 id="when-title" className="text-sm font-semibold">{t("time.title")}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip pressed={!time} onClick={() => onChange({ time: "" })}>{t("time.now")}</Chip>
          <Chip pressed={!!time} onClick={() => !time && onChange({ time: localNow(new Date(Date.now() + 3600_000)) })}>
            {t("time.pick")}
          </Chip>
          {time && (
            <Input
              type="datetime-local"
              value={time}
              min={localNow()}
              onChange={(e) => e.target.value && onChange({ time: e.target.value })}
              aria-label={t("time.label")}
              className="w-auto"
            />
          )}
        </div>
      </section>
    </div>
  );
}
