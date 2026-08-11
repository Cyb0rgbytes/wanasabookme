import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Resolves the active locale and loads its messages for each request.
 *
 * Falls back to the default locale when the segment is missing or unknown,
 * so a bad URL renders in English rather than crashing.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Events are UAE-centric; default formatting to Gulf Standard Time so
    // relative dates don't drift for the primary audience.
    timeZone: "Asia/Dubai",
  };
});
