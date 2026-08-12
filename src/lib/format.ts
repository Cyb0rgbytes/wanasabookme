import type { Locale } from "@/i18n/routing";

/** Fils → AED. Display boundary only; never compute in decimals. */
export function filsToAed(fils: number): number {
  return fils / 100;
}

/** AED → fils, rounded to a whole fil. Used when parsing form input. */
export function aedToFils(aed: number): number {
  return Math.round(aed * 100);
}

/**
 * Formats money for display.
 *
 * Whole amounts drop the decimals — "100 AED" reads better than "100.00 AED"
 * in a price that changes as people join.
 */
export function formatMoney(fils: number, locale: Locale): string {
  const aed = filsToAed(fils);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: Number.isInteger(aed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(aed);
}

/**
 * Gregorian date, in the event's own timezone.
 *
 * Always pass the event's timezone rather than relying on the server's — a
 * Worker may run anywhere, and "7pm" must mean 7pm where the event happens.
 */
export function formatDate(
  epochMillis: number,
  locale: Locale,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(epochMillis));
}

export function formatTime(
  epochMillis: number,
  locale: Locale,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(epochMillis));
}

/**
 * Hijri date via the Umm al-Qura calendar — the civil calendar of Saudi Arabia
 * and the standard reference across the Gulf.
 *
 * Uses `Intl` rather than a library: no dependency, no bundle cost, and the
 * runtime's ICU data is already correct.
 *
 * Rendered alongside the Gregorian date, never instead of it. Displaying only
 * Hijri would be unreadable for a large share of UAE residents.
 */
export function formatHijriDate(
  epochMillis: number,
  locale: Locale,
  timezone: string,
): string {
  const calendarLocale =
    locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura";

  return new Intl.DateTimeFormat(calendarLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(epochMillis));
}

/** Picks the localized field, falling back to English when Arabic is absent. */
export function localized<T extends { titleEn: string; titleAr?: string | null }>(
  row: T,
  locale: Locale,
): string {
  return locale === "ar" ? (row.titleAr?.trim() || row.titleEn) : row.titleEn;
}

/** Same fallback rule for description fields. */
export function localizedDescription(
  row: { descriptionEn?: string | null; descriptionAr?: string | null },
  locale: Locale,
): string | null {
  const value =
    locale === "ar"
      ? row.descriptionAr?.trim() || row.descriptionEn
      : row.descriptionEn;
  return value?.trim() || null;
}
