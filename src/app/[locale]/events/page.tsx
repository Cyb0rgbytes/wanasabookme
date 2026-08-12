import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/db";
import { listEvents, type EventFilters } from "@/lib/event-queries";
import { EventCard } from "@/components/event-card";
import { Link } from "@/i18n/navigation";
import { currentTime } from "@/lib/now";
import type { Locale } from "@/i18n/routing";
import { EventFiltersBar } from "./filters-bar";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const sp = await searchParams;
  const t = await getTranslations("EventList");

  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

  const filters: EventFilters = {
    search: one(sp.q),
    city: one(sp.city),
    audience: one(sp.audience) as EventFilters["audience"],
    category: one(sp.category),
  };

  // Clock read is isolated in a server-only module — calling Date.now() in a
  // component body is impure and would bake a timestamp into cached output.
  const now = currentTime();

  const db = await getDb();
  const events = await listEvents(db, filters, { now });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("subtitle")}</p>
      </header>

      <EventFiltersBar initial={filters} />

      {events.length === 0 ? (
        <div className="border-border mt-8 rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted">
            {hasFilters ? t("noResults") : t("empty")}
          </p>
          {hasFilters ? (
            <Link
              href="/events"
              className="text-accent mt-3 inline-block text-sm font-medium"
            >
              {t("clearFilters")}
            </Link>
          ) : (
            <Link
              href="/events/new"
              className="bg-accent text-accent-foreground mt-4 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              {t("emptyCta")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} locale={locale as Locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
