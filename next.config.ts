import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    // R2 media is served via a custom domain / public bucket URL.
    // Add the real host here once the bucket domain is configured.
    remotePatterns: [],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

// Makes Cloudflare bindings (DB, MEDIA, CACHE) available during `next dev`.
// Without this, getCloudflareContext() is undefined in the Next dev server.
initOpenNextCloudflareForDev();
