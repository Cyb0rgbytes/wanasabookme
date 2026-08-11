import { getTranslations } from "next-intl/server";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/**
 * Sign in / sign up when signed out; the account menu when signed in.
 *
 * Clerk 7 replaced the old <SignedIn>/<SignedOut> pair with a single <Show>
 * taking `when="signed-in" | "signed-out"` (it also accepts role/permission
 * conditions, which is how organizer-only UI will gate in a later slice).
 *
 * Clerk renders its modals in a portal, so the surrounding RTL layout does not
 * cascade into them — direction comes from ClerkProvider's `localization`,
 * which the locale layout sets per request.
 */
export async function AuthControls() {
  const t = await getTranslations("Nav");

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="hover:text-accent text-sm font-medium transition-colors"
          >
            {t("signIn")}
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="bg-accent text-accent-foreground rounded-md px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {t("signUp")}
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
      </Show>
    </>
  );
}
