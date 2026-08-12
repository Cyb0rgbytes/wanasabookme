"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { EventFilters } from "@/lib/event-queries";

/**
 * Search and filter controls.
 *
 * State lives in the URL rather than component state, so a filtered view is
 * shareable, bookmarkable, and survives a refresh — and the server can render
 * it directly.
 */
export function EventFiltersBar({ initial }: { initial: EventFilters }) {
  const t = useTranslations("EventList");
  const tAudience = useTranslations("Audience");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function apply(next: Partial<EventFilters>) {
    const merged = { ...initial, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set("q", merged.search);
    if (merged.city) params.set("city", merged.city);
    if (merged.audience) params.set("audience", merged.audience);
    if (merged.category) params.set("category", merged.category);

    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <form
      className="flex flex-wrap gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get("q")?.toString() ?? "";
        apply({ search: value || undefined });
      }}
    >
      <input
        type="search"
        name="q"
        defaultValue={initial.search ?? ""}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="border-border bg-background min-w-0 flex-1 rounded-lg border px-4 py-2 text-sm"
      />

      <select
        name="audience"
        defaultValue={initial.audience ?? ""}
        aria-label={t("filterAudience")}
        disabled={isPending}
        onChange={(e) =>
          apply({ audience: (e.target.value || undefined) as EventFilters["audience"] })
        }
        className="border-border bg-background rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">{t("filterAll")}</option>
        <option value="mixed">{tAudience("mixed")}</option>
        <option value="women_only">{tAudience("women_only")}</option>
        <option value="family">{tAudience("family")}</option>
      </select>
    </form>
  );
}
