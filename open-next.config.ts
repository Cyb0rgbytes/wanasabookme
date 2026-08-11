import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Caching config lives here. See https://opennext.js.org/cloudflare/caching
// Left at defaults for Slice 1; revisit when ISR/PPR is tuned for event pages.
export default defineCloudflareConfig();
