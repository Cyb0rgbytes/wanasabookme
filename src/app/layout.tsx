import type { ReactNode } from "react";

/**
 * Root layout is a pass-through.
 *
 * `<html>` and `<body>` are rendered by src/app/[locale]/layout.tsx, which is
 * the only place that knows the active locale and therefore the correct `lang`
 * and `dir` attributes.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
