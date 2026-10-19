"use client";

import { Check, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, routing, type Locale } from "@/i18n/routing";

export function SiteHeader() {
  const t = useTranslations("header");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  // Keep the search (it lives in the query string) when switching language.
  const switchLocale = (l: Locale) =>
    router.replace({ pathname, query: Object.fromEntries(new URLSearchParams(window.location.search)) }, { locale: l });
  const themes = [
    { value: "system", icon: Monitor },
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
  ] as const;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight">
          meet<span className="text-emerald-600">fair</span>
        </span>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">{t("tagline")}</span>
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={t("language")} />}>
            <Languages /> <span className="uppercase">{locale}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-48">
            {routing.locales.map((l) => (
              <DropdownMenuItem key={l} onClick={() => l !== locale && switchLocale(l)} lang={l}>
                <span className="flex-1">{LOCALE_NAMES[l]}</span>
                {l === locale && <Check aria-hidden />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("theme")} />}>
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {themes.map(({ value, icon: Icon }) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                <Icon /> <span className="flex-1">{t(value)}</span>
                {theme === value && <Check aria-hidden />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
