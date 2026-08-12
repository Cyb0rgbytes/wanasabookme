import { auth } from "@clerk/nextjs/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInButton } from "@clerk/nextjs";
import type { Locale } from "@/i18n/routing";
import { CreateEventForm } from "./form";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("CreateEvent");
  const tDetail = await getTranslations("EventDetail");

  // Protected at the page level, not in middleware — a matcher mistake must
  // never be able to expose this.
  const { userId } = await auth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted mt-2">{t("subtitle")}</p>
      </header>

      {userId ? (
        <CreateEventForm locale={locale as Locale} />
      ) : (
        <SignInButton mode="modal">
          <button
            type="button"
            className="bg-accent text-accent-foreground w-full rounded-lg px-5 py-3 font-semibold"
          >
            {tDetail("signInToJoin")}
          </button>
        </SignInButton>
      )}
    </div>
  );
}
