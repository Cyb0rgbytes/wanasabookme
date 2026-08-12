"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { SignInButton } from "@clerk/nextjs";
import { joinEventAction, leaveEventAction, type JoinState } from "../actions";

const initial: JoinState = { status: "idle" };

/**
 * Join / leave control.
 *
 * The server is the authority on capacity — this only reflects state. A user
 * whose page was rendered before the last seat went will still see "Join";
 * clicking it returns `sold_out` from the atomic guard rather than overselling.
 */
export function JoinButton({
  eventId,
  slug,
  joined,
  soldOut,
  started,
  signedIn,
}: {
  eventId: string;
  slug: string;
  joined: boolean;
  soldOut: boolean;
  started: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("EventDetail");
  const tJoin = useTranslations("Join");

  const [joinState, join, joinPending] = useActionState(
    joinEventAction,
    initial,
  );
  const [, leave, leavePending] = useActionState(leaveEventAction, initial);

  if (started) {
    return (
      <p className="border-border text-muted rounded-lg border px-4 py-3 text-center text-sm">
        {t("alreadyStarted")}
      </p>
    );
  }

  if (!signedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className="bg-accent text-accent-foreground w-full rounded-lg px-5 py-3 font-semibold transition-opacity hover:opacity-90"
        >
          {t("signInToJoin")}
        </button>
      </SignInButton>
    );
  }

  if (joined) {
    return (
      <div className="grid gap-2">
        <p className="border-accent/30 bg-accent/10 text-accent rounded-lg border px-4 py-3 text-center font-semibold">
          {t("joined")}
        </p>
        <form action={leave}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            disabled={leavePending}
            className="text-muted hover:text-foreground w-full text-sm underline transition-colors disabled:opacity-50"
          >
            {t("leave")}
          </button>
        </form>
      </div>
    );
  }

  if (soldOut) {
    return (
      <p className="border-border text-muted rounded-lg border px-4 py-3 text-center text-sm font-medium">
        {t("soldOut")}
      </p>
    );
  }

  const errorKey =
    joinState.status === "error"
      ? {
          sold_out: "errorSoldOut",
          already_joined: "errorAlreadyJoined",
          already_started: "errorAlreadyStarted",
        }[joinState.reason] ?? "errorGeneric"
      : null;

  return (
    <form action={join} className="grid gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={joinPending}
        className="bg-accent text-accent-foreground w-full rounded-lg px-5 py-3 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {joinPending ? t("joining") : t("join")}
      </button>

      {errorKey && (
        <p role="alert" className="text-center text-sm text-red-500">
          {tJoin(errorKey)}
        </p>
      )}
    </form>
  );
}
