import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Common");

  return (
    <div className="mx-auto max-w-5xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{t("notFound")}</h1>
      <p className="text-muted mt-4">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="bg-accent text-accent-foreground mt-8 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
