import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { EventListItem } from "@/lib/event-queries";
import { getPricingSnapshot } from "@/lib/pricing";
import { formatDate, formatMoney, formatHijriDate, localized } from "@/lib/format";
import { AudienceBadge } from "./audience-badge";

export function EventCard({
  event,
  locale,
}: {
  event: EventListItem;
  locale: Locale;
}) {
  const t = useTranslations("EventList");

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

  const spotsLeft = Math.max(0, event.capacity - event.joinedCount);
  const isFree = snapshot.currentPriceFils === 0;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="border-border hover:border-accent group block rounded-xl border p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="group-hover:text-accent font-semibold text-balance transition-colors">
          {localized(event, locale)}
        </h3>
        <AudienceBadge audience={event.audience} />
      </div>

      <p className="text-muted mt-2 text-sm">
        {formatDate(event.startsAt, locale, event.timezone)}
      </p>
      {/* Hijri alongside Gregorian, never instead of it. */}
      <p className="text-muted text-xs">
        {formatHijriDate(event.startsAt, locale, event.timezone)}
      </p>

      {(event.venueName || event.city) && (
        <p className="text-muted mt-1 text-sm">
          {[event.venueName, event.city].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="border-border mt-4 flex items-baseline justify-between border-t pt-3">
        <span className="font-semibold tabular-nums">
          {isFree ? "—" : formatMoney(snapshot.currentPriceFils, locale)}
          {!isFree && (
            <span className="text-muted ms-1 text-xs font-normal">
              {t("perPerson")}
            </span>
          )}
        </span>
        <span className="text-muted text-xs tabular-nums">
          {t("spotsLeft", { count: spotsLeft })}
        </span>
      </div>
    </Link>
  );
}
