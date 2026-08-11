import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("Home");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="text-muted mt-6 text-lg text-pretty">{t("heroSubtitle")}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/events"
            className="bg-accent text-accent-foreground rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {t("browseEvents")}
          </Link>
          <Link
            href="/events/new"
            className="border-border hover:bg-surface rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            {t("hostEvent")}
          </Link>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("howItWorksTitle")}
        </h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="border-border bg-surface rounded-xl border p-5"
            >
              <span className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums">
                {/*
                 * DELIBERATE: renders Latin digits (1 2 3) in BOTH locales.
                 * CLDR resolves `ar`/`ar-AE` to the `latn` numbering system,
                 * matching how numbers actually appear in UAE commerce —
                 * prices, dates, phone numbers. This is not a bug; do not
                 * "fix" it by forcing `ar-u-nu-arab` without a product call.
                 */}
                {new Intl.NumberFormat(locale).format(i + 1)}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="text-muted mt-2 text-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
