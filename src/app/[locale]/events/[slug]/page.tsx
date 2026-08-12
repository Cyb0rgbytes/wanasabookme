import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import {
  getEventBySlug,
  getUserByClerkId,
  hasJoined,
} from "@/lib/event-queries";
import { getPricingSnapshot } from "@/lib/pricing";
import {
  formatDate,
  formatTime,
  formatHijriDate,
  localized,
  localizedDescription,
} from "@/lib/format";
import { PriceDisplay } from "@/components/price-display";
import { AudienceBadge } from "@/components/audience-badge";
import { currentTime } from "@/lib/now";
import type { Locale } from "@/i18n/routing";
import { JoinButton } from "./join-button";
import { ShareButtons } from "./share-buttons";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  // Clock read is isolated in a server-only module — calling Date.now() in a
  // component body is impure and would bake "started" into cached output.
  const now = currentTime();

  const db = await getDb();
  const event = await getEventBySlug(db, slug);
  if (!event) notFound();

  const t = await getTranslations("EventDetail");

  const snapshot = getPricingSnapshot(
    {
      totalCostFils: event.totalCostFils,
      minHeadcount: event.minHeadcount,
      capacity: event.capacity,
      priceFloorFils: event.priceFloorFils,
      priceCeilingFils: event.priceCeilingFils,
    },
    event.joinedCount,
  );

  const { userId: clerkUserId } = await auth();
  let joined = false;
  if (clerkUserId) {
    const user = await getUserByClerkId(db, clerkUserId);
    if (user) joined = await hasJoined(db, event.id, user.id);
  }

  const title = localized(event, locale as Locale);
  const description = localizedDescription(event, locale as Locale);
  const started = event.startsAt <= now;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <header>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <AudienceBadge audience={event.audience} />
        </div>
        {event.organizerName && (
          <p className="text-muted mt-3 text-sm">
            {t("hostedBy", { name: event.organizerName })}
          </p>
        )}
      </header>

      {description && (
        <p className="mt-6 leading-relaxed text-pretty">{description}</p>
      )}

      <dl className="border-border mt-8 grid gap-6 border-y py-6 sm:grid-cols-2">
        <div>
          <dt className="text-muted text-sm font-medium">{t("when")}</dt>
          <dd className="mt-1 font-medium">
            {formatDate(event.startsAt, locale as Locale, event.timezone)}
          </dd>
          <dd className="text-muted text-sm">
            {formatTime(event.startsAt, locale as Locale, event.timezone)}
          </dd>
          {/* Both calendars, always — Hijri alone excludes many UAE residents. */}
          <dd className="text-muted mt-1 text-sm">
            {formatHijriDate(event.startsAt, locale as Locale, event.timezone)}
          </dd>
        </div>

        {(event.venueName || event.city) && (
          <div>
            <dt className="text-muted text-sm font-medium">{t("where")}</dt>
            <dd className="mt-1 font-medium">{event.venueName}</dd>
            {event.city && (
              <dd className="text-muted text-sm">{event.city}</dd>
            )}
          </div>
        )}
      </dl>

      <div className="mt-8 grid gap-6">
        <PriceDisplay
          snapshot={snapshot}
          joinedCount={event.joinedCount}
          capacity={event.capacity}
          locale={locale as Locale}
        />

        {/* No money moves in Slice 1; say so plainly rather than implying a charge. */}
        <p className="border-accent/30 bg-accent/10 text-accent rounded-lg border px-4 py-3 text-sm font-medium">
          {t("betaBanner")}
        </p>

        <JoinButton
          eventId={event.id}
          slug={event.slug}
          joined={joined}
          soldOut={snapshot.soldOut}
          started={started}
          signedIn={Boolean(clerkUserId)}
        />

        <ShareButtons title={title} />
      </div>
    </article>
  );
}
