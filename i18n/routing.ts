import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "tr", "es", "zh", "hi", "ar", "fr", "pt", "ru", "de", "ja", "id"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES: readonly string[] = ["ar"];

/** Each language in its own script, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
  es: "Español",
  zh: "中文",
  hi: "हिन्दी",
  ar: "العربية",
  fr: "Français",
  pt: "Português",
  ru: "Русский",
  de: "Deutsch",
  ja: "日本語",
  id: "Bahasa Indonesia",
};
