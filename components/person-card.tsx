"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocationInput } from "./location-input";
import { ModePicker } from "./mode-picker";
import type { PersonDraft } from "@/lib/share-state";
import type { LatLon } from "@/lib/types";

type Props = {
  person: PersonDraft;
  name: string;
  color: string;
  bias?: LatLon;
  canRemove: boolean;
  pinActive: boolean;
  onChange: (p: PersonDraft) => void;
  onRemove: () => void;
  onPinToggle: () => void;
};

export function PersonCard({ person, name, color, bias, canRemove, pinActive, onChange, onRemove, onPinToggle }: Props) {
  const t = useTranslations("people");
  return (
    <li className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="flex-1 text-sm font-medium">{name}</span>
        {canRemove && (
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t("remove", { name })}>
            <Trash2 />
          </Button>
        )}
      </div>
      <LocationInput
        label={person.label}
        hasPoint={!!person.point}
        personName={name}
        bias={bias}
        pinActive={pinActive}
        onPick={(label, point) => onChange({ ...person, label, point })}
        onClear={() => onChange({ ...person, label: "", point: null })}
        onPinToggle={onPinToggle}
      />
      <ModePicker value={person.mode} onChange={(mode) => onChange({ ...person, mode })} />
    </li>
  );
}
