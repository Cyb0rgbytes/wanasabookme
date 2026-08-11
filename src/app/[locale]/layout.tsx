import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing, getDirection, type Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";

const inter = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

// IBM Plex Sans Arabic has proper Naskh proportions and a real weight range,
// unlike most system Arabic fallbacks which render thin and cramped.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Metadata",
  });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Required for static rendering; without it every child becomes dynamic.
  setRequestLocale(locale);

  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteHeader locale={locale} />
          <main className="flex-1">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
