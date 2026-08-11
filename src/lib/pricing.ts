/**
 * Cost-split pricing engine.
 *
 * PURE BY DESIGN. This module imports nothing — no database, no Clerk, no
 * framework. Numbers in, numbers out. That keeps it testable without mocks or
 * a Workers runtime, and means Phase 5's payment code can wrap it without
 * changing it.
 *
 * MONEY IS INTEGER FILS (1 AED = 100 fils). Never floats: 0.1 + 0.2 !== 0.3,
 * and a one-fil drift per attendee across a large event becomes a real
 * reconciliation problem. Convert at the display boundary, never in here.
 *
 * The model:
 *   settled     = clamp(totalCost / confirmedAttendees, floor, ceiling)
 *   confirmable = confirmedAttendees >= minHeadcount
 *   you pay     = min(priceWhenYouJoined, settled)
 *
 * The join-time price is a personal CAP, not a fixed amount. Nobody is ever
 * charged more than they agreed to, and everyone benefits when later joins
 * push the price down. (The alternative — a strictly fixed per-attendee price
 * — is a one-line change in `resolveAttendeePrice`; see the note there.)
 */

export interface CostSplitConfig {
  /** Total cost the organizer must cover, in fils. */
  totalCostFils: number;
  /** Below this many attendees the event does not go ahead. */
  minHeadcount: number;
  /** Hard upper bound on attendees. */
  capacity: number;
  /** Price never drops below this, so the organizer keeps a margin. */
  priceFloorFils: number;
  /** Price never rises above this, so joining early is not a blank cheque. */
  priceCeilingFils: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Per-person price at a given headcount, in fils.
 *
 * Rounds UP to whole fils so the collected total always covers the cost —
 * rounding down on 1000/3 collects 999 and leaves the organizer a fil short.
 *
 * Zero attendees yields the ceiling rather than dividing by zero: an empty
 * event page should show the worst case a visitor could pay, which is exactly
 * what the ceiling means.
 */
export function computeSettledPrice(
  config: CostSplitConfig,
  confirmedAttendees: number,
): number {
  const { totalCostFils, priceFloorFils, priceCeilingFils } = config;

  // A free event is free regardless of turnout.
  if (totalCostFils <= 0) return Math.max(0, priceFloorFils);

  if (confirmedAttendees <= 0) return priceCeilingFils;

  const rawShare = Math.ceil(totalCostFils / confirmedAttendees);
  return clamp(rawShare, priceFloorFils, priceCeilingFils);
}

/** Whether enough people have joined for the event to go ahead. */
export function isConfirmable(
  config: CostSplitConfig,
  confirmedAttendees: number,
): boolean {
  return confirmedAttendees >= config.minHeadcount;
}

/**
 * What a specific attendee actually pays, in fils.
 *
 * `joinTimePriceFils` is the price they saw and agreed to when joining;
 * `settledPriceFils` is the final price at cutoff. They pay the lower of the
 * two — protected from increases, and passed the benefit of decreases.
 *
 * To switch to a strictly fixed per-attendee price instead, return
 * `joinTimePriceFils` unconditionally. That would mean early joiners pay more
 * than late ones for the same event, which is why it is not the default.
 */
export function resolveAttendeePrice(
  joinTimePriceFils: number,
  settledPriceFils: number,
): number {
  return Math.min(joinTimePriceFils, settledPriceFils);
}

/**
 * Everything a UI needs to describe an event's pricing state.
 *
 * Grouped into one call so a page cannot render an inconsistent mix — for
 * example a current price computed from a stale attendee count.
 */
export interface PricingSnapshot {
  /** Price a new joiner would be quoted right now, in fils. */
  currentPriceFils: number;
  /** Price if the event fills to capacity — the best case, in fils. */
  bestCasePriceFils: number;
  /** Whether the minimum headcount has been reached. */
  confirmable: boolean;
  /** How many more attendees are needed to confirm. Zero once confirmable. */
  attendeesNeeded: number;
  /** Whether capacity is reached and no further joins are possible. */
  soldOut: boolean;
}

export function getPricingSnapshot(
  config: CostSplitConfig,
  confirmedAttendees: number,
): PricingSnapshot {
  // A new joiner changes the split, so quote them the post-join price rather
  // than the current one — otherwise the number moves the instant they join.
  const priceAfterJoining = computeSettledPrice(config, confirmedAttendees + 1);

  return {
    currentPriceFils: priceAfterJoining,
    bestCasePriceFils: computeSettledPrice(config, config.capacity),
    confirmable: isConfirmable(config, confirmedAttendees),
    attendeesNeeded: Math.max(0, config.minHeadcount - confirmedAttendees),
    soldOut: confirmedAttendees >= config.capacity,
  };
}
