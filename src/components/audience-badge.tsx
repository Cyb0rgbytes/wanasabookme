import { useTranslations } from "next-intl";

type Audience = "mixed" | "women_only" | "family";

/**
 * Marks who an event is for.
 *
 * Not decoration — women-only and family-friendly are standard, expected
 * categories in this market, and attendees filter on them before anything else.
 */
export function AudienceBadge({ audience }: { audience: Audience }) {
  const t = useTranslations("Audience");

  const styles: Record<Audience, string> = {
    mixed: "bg-surface text-muted border-border",
    women_only: "bg-accent/10 text-accent border-accent/30",
    family: "bg-accent/10 text-accent border-accent/30",
  };

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[audience]}`}
    >
      {t(audience)}
    </span>
  );
}
