import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";
import { AuthControls } from "./auth-controls";

/**
 * Site header.
 *
 * Note the logical spacing utilities (ms-, gap-) rather than physical ones.
 * In RTL the whole bar mirrors automatically because flex direction follows
 * the document's `dir`.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("Nav");

  return (
    <header className="border-border border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {locale === "ar" ? "ونسة" : "Wanasa"}
        </Link>

        <Link href="/events" className="hover:text-accent text-sm font-medium">
          {t("events")}
        </Link>

        {/* ms-auto pushes to the inline-end: right in LTR, left in RTL. */}
        <div className="ms-auto flex items-center gap-3">
          <LanguageSwitcher locale={locale} />
          <AuthControls />
        </div>
      </nav>
    </header>
  );
}
