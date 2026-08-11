"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";

/**
 * Switches locale while staying on the current page.
 *
 * `usePathname` from @/i18n/navigation returns the path WITHOUT the locale
 * prefix, so replacing the locale preserves the user's position in the app.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={t("switchLanguage")}
      onClick={() => {
        startTransition(() => {
          router.replace(pathname, { locale: other });
        });
      }}
      className="border-border hover:bg-surface rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
    >
      {/* Show the language you'd switch TO, in its own script. */}
      <span lang={other}>{localeNames[other]}</span>
    </button>
  );
}
