import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation APIs.
 *
 * Always import Link/redirect/useRouter from here rather than from `next/link`
 * or `next/navigation` — these variants keep the active locale prefix on URLs.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
