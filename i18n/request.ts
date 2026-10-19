import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  // Validate explicit locales too: generateMetadata passes the raw [locale] param, which can be "favicon.ico".
  const requested = locale ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, requested)) notFound();
  return { locale: requested, messages: (await import(`../messages/${requested}.json`)).default };
});
