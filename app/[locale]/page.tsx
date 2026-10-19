import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppLoader } from "@/components/app-loader";
import { SiteHeader } from "@/components/site-header";

const SOURCE_URL = "https://github.com/Thauyel/meetfair";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("footer");

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <SiteHeader />
      <main className="flex flex-1 flex-col lg:min-h-0">
        <h1 className="sr-only">{t("h1")}</h1>
        <AppLoader />
      </main>
      <footer className="border-t px-4 py-2 text-xs text-muted-foreground">
        <p>
          {t("privacy")} · {t("data")}:{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>,{" "}
          <a className="underline" href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>,{" "}
          <a className="underline" href="https://valhalla.openstreetmap.de" target="_blank" rel="noopener noreferrer">FOSSGIS Valhalla</a>,{" "}
          <a className="underline" href="https://transitous.org/sources" target="_blank" rel="noopener noreferrer">Transitous</a>,{" "}
          <a className="underline" href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon</a> ·{" "}
          <a className="underline" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{t("source")}</a>
        </p>
      </footer>
    </div>
  );
}
