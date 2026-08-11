/**
 * Event creation helpers — pure, like the pricing engine. No DB, no framework.
 */

export interface EventInput {
  titleEn: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  startsAt: number;
  endsAt?: number;
  timezone: string;
  venueName?: string;
  city?: string;
  capacity: number;
  minHeadcount: number;
  totalCostFils: number;
  priceFloorFils: number;
  priceCeilingFils: number;
  audience: "mixed" | "women_only" | "family";
  category?: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof EventInput, string>> };

const MAX_SLUG_LENGTH = 60;

/**
 * Builds a URL-safe slug, preserving Arabic script.
 *
 * A naive `[^a-z0-9]` filter erases Arabic entirely, so an event titled
 * "حفل عشاء" would produce an empty slug and a meaningless URL. Arabic
 * codepoints are percent-encoded by browsers but remain readable when pasted
 * — which matters when links travel through WhatsApp.
 *
 * Returns "" when nothing survives; callers must fall back to a generated id
 * rather than emit a bare "/events/".
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    // Keep Latin alphanumerics, Arabic block (0600–06FF), and separators.
    .replace(/[^\p{Script=Arabic}a-z0-9\s-]/gu, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= MAX_SLUG_LENGTH) return slug;

  // Truncate at a word boundary so the slug never ends mid-word or on a dash.
  const cut = slug.slice(0, MAX_SLUG_LENGTH);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/** True if the string is a timezone this runtime recognises. */
function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isNonNegativeInteger(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/**
 * Validates event input, collecting ALL problems rather than stopping at the
 * first. A form that reveals one error per submit is hostile — especially on
 * mobile, where the user re-scrolls each time.
 */
export function validateEventInput(input: EventInput): ValidationResult {
  const errors: Partial<Record<keyof EventInput, string>> = {};

  // --- Content ---
  if (!input.titleEn?.trim()) {
    errors.titleEn = "required";
  }
  // titleAr is intentionally optional: never block publishing on translation.

  // --- Time ---
  if (!Number.isFinite(input.startsAt)) {
    errors.startsAt = "invalid";
  } else if (input.startsAt <= Date.now()) {
    errors.startsAt = "must_be_future";
  }

  if (input.endsAt !== undefined) {
    if (!Number.isFinite(input.endsAt)) {
      errors.endsAt = "invalid";
    } else if (input.endsAt <= input.startsAt) {
      errors.endsAt = "must_be_after_start";
    }
  }

  if (!isValidTimezone(input.timezone)) {
    errors.timezone = "invalid";
  }

  // --- Capacity ---
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    errors.capacity = "min_one";
  }

  if (!Number.isInteger(input.minHeadcount) || input.minHeadcount < 0) {
    errors.minHeadcount = "invalid";
  } else if (input.minHeadcount > input.capacity) {
    // Otherwise the event can never confirm — a guaranteed cancellation.
    errors.minHeadcount = "exceeds_capacity";
  }

  // --- Money (integer fils only) ---
  if (!isNonNegativeInteger(input.totalCostFils)) {
    errors.totalCostFils = "invalid_amount";
  }
  if (!isNonNegativeInteger(input.priceFloorFils)) {
    errors.priceFloorFils = "invalid_amount";
  }
  if (!isNonNegativeInteger(input.priceCeilingFils)) {
    errors.priceCeilingFils = "invalid_amount";
  }

  if (
    isNonNegativeInteger(input.priceFloorFils) &&
    isNonNegativeInteger(input.priceCeilingFils) &&
    input.priceFloorFils > input.priceCeilingFils
  ) {
    errors.priceFloorFils = "above_ceiling";
  }

  // --- Enums ---
  if (!["mixed", "women_only", "family"].includes(input.audience)) {
    errors.audience = "invalid";
  }

  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}
