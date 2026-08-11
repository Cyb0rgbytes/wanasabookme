import { defineRouting } from "next-intl/routing";

/**
 * Locale routing for WanasaBookMe.
 *
 * `localePrefix: "always"` means every URL carries its locale (/en/..., /ar/...).
 * This keeps hreflang pairs unambiguous for SEO and makes shared links
 * self-describing — important when events spread via WhatsApp.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Text direction per locale. Arabic is RTL; English is LTR. */
export const localeDirections = {
  en: "ltr",
  ar: "rtl",
} as const satisfies Record<Locale, "ltr" | "rtl">;

/** Native language names, used in the language switcher. */
export const localeNames = {
  en: "English",
  ar: "العربية",
} as const satisfies Record<Locale, string>;

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return localeDirections[locale];
}
