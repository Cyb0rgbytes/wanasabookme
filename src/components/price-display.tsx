import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { PricingSnapshot } from "@/lib/pricing";
import type { Locale } from "@/i18n/routing";

/**
 * The cost-split price panel.
 *
 * This is the product's differentiator, so it shows the mechanism rather than
 * just a number: current price, where it lands if the event fills, and how far
 * it is from confirming.
 */
export function PriceDisplay({
  snapshot,
  joinedCount,
  capacity,
  locale,
}: {
  snapshot: PricingSnapshot;
  joinedCount: number;
  capacity: number;
  locale: Locale;
}) {
  const t = useTranslations("EventDetail");
  const isFree = snapshot.currentPriceFils === 0;
  const progress = capacity > 0 ? Math.min(100, (joinedCount / capacity) * 100) : 0;

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">
          {isFree ? "—" : formatMoney(snapshot.currentPriceFils, locale)}
        </span>
        {!isFree && (
          <span className="text-muted text-sm">{t("perPerson")}</span>
        )}
      </div>

      {!isFree && snapshot.bestCasePriceFils < snapshot.currentPriceFils && (
        <p className="text-accent mt-1 text-sm font-medium">
          {t("ifItFills", {
            price: formatMoney(snapshot.bestCasePriceFils, locale),
          })}
        </p>
      )}

      <div className="mt-4">
        <div
          className="bg-border h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={joinedCount}
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-label={t("joinedCount", { joined: joinedCount, capacity })}
        >
          {/* Width is data-driven, so it must be an inline style, not a class. */}
          <div
            className="bg-accent h-full rounded-full transition-[width]"
            style={{ inlineSize: `${progress}%` }}
          />
        </div>
        <p className="text-muted mt-2 text-sm tabular-nums">
          {t("joinedCount", { joined: joinedCount, capacity })}
        </p>
      </div>

      <p className="mt-3 text-sm font-medium">
        {snapshot.confirmable ? (
          <span className="text-accent">{t("confirmed")}</span>
        ) : (
          <span className="text-muted">
            {t("needsMore", { count: snapshot.attendeesNeeded })}
          </span>
        )}
      </p>

      <p className="text-muted mt-4 text-xs leading-relaxed">
        {t("priceExplainer")}
      </p>
    </div>
  );
}
