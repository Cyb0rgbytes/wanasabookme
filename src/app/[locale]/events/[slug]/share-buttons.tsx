"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Sharing controls.
 *
 * WhatsApp first, deliberately — it is how events actually spread in the GCC,
 * far ahead of email. This is the wa.me deep link only; the Business API for
 * ticket delivery and reminders belongs to a later slice.
 */
export function ShareButtons({ title }: { title: string }) {
  const t = useTranslations("EventDetail");
  const [copied, setCopied] = useState(false);

  function shareUrl() {
    return typeof window === "undefined" ? "" : window.location.href;
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => {
          const text = encodeURIComponent(`${title}\n${shareUrl()}`);
          window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
        }}
        className="border-border hover:bg-surface rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
      >
        {t("shareWhatsApp")}
      </button>

      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(shareUrl());
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="border-border hover:bg-surface rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
      >
        {copied ? t("linkCopied") : t("copyLink")}
      </button>
    </div>
  );
}
