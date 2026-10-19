"use client";

import { Bike, Car, Footprints, TramFront } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MODES, type Mode } from "@/lib/types";

export const MODE_ICONS = { car: Car, walk: Footprints, bike: Bike, transit: TramFront } as const;

export function ModePicker({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const t = useTranslations("mode");
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0] as Mode)}
      variant="outline"
      size="sm"
      aria-label={t("label")}
    >
      {MODES.map((m) => {
        const Icon = MODE_ICONS[m];
        return (
          <ToggleGroupItem key={m} value={m} aria-label={t(m)} title={t(m)} className="px-2.5 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/90 hover:aria-pressed:text-primary-foreground">
            <Icon aria-hidden />
            <span className="sr-only sm:not-sr-only sm:text-xs">{t(m)}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
