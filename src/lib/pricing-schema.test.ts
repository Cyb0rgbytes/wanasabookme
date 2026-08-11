import { describe, it, expect, expectTypeOf } from "vitest";
import { getPricingSnapshot, type CostSplitConfig } from "./pricing";
import type { Event } from "@/db/schema";

/**
 * Guards the seam between the events table and the pricing engine.
 *
 * The engine is pure and knows nothing about the database, so nothing stops
 * the two drifting apart — a renamed column or a changed unit would compile
 * fine and silently mis-price events. These tests fail loudly instead.
 */

/** Fields an Event row must supply to drive the pricing engine. */
function toCostSplitConfig(event: Event): CostSplitConfig {
  return {
    totalCostFils: event.totalCostFils,
    minHeadcount: event.minHeadcount,
    capacity: event.capacity,
    priceFloorFils: event.priceFloorFils,
    priceCeilingFils: event.priceCeilingFils,
  };
}

describe("events schema ↔ pricing engine", () => {
  it("an Event row supplies every field CostSplitConfig needs", () => {
    // Compile-time proof: if a column is renamed or its type changes, this
    // fails to typecheck rather than mis-pricing at runtime.
    expectTypeOf(toCostSplitConfig).returns.toEqualTypeOf<CostSplitConfig>();
  });

  it("drives a realistic event end-to-end", () => {
    // A 1200 AED desert BBQ for 6–24 people, 60–250 AED per head.
    const event = {
      totalCostFils: 120_000,
      minHeadcount: 6,
      capacity: 24,
      priceFloorFils: 6_000,
      priceCeilingFils: 25_000,
    } as Event;

    const config = toCostSplitConfig(event);

    // Empty event: a joiner would be the only attendee, so they see the
    // ceiling rather than the full 1200 AED.
    const empty = getPricingSnapshot(config, 0);
    expect(empty.currentPriceFils).toBe(25_000);
    expect(empty.confirmable).toBe(false);
    expect(empty.attendeesNeeded).toBe(6);
    expect(empty.soldOut).toBe(false);

    // Five joined: the sixth confirms it. Quote reflects them joining.
    const nearlyThere = getPricingSnapshot(config, 5);
    expect(nearlyThere.attendeesNeeded).toBe(1);
    expect(nearlyThere.currentPriceFils).toBe(20_000); // 1200/6 = 200 AED

    // Confirmed and filling: 1200/12 = 100 AED.
    const healthy = getPricingSnapshot(config, 11);
    expect(healthy.confirmable).toBe(true);
    expect(healthy.attendeesNeeded).toBe(0);
    expect(healthy.currentPriceFils).toBe(10_000);

    // Full: 1200/24 = 50 AED, below the 60 floor → floor wins.
    const full = getPricingSnapshot(config, 24);
    expect(full.soldOut).toBe(true);
    expect(full.bestCasePriceFils).toBe(6_000);
  });

  it("quotes a joiner the post-join price, not the pre-join one", () => {
    const config: CostSplitConfig = {
      totalCostFils: 100_000,
      minHeadcount: 2,
      capacity: 10,
      priceFloorFils: 0,
      priceCeilingFils: 100_000,
    };

    // With 4 already joined, joining makes 5 → 1000/5 = 200 AED.
    // Quoting 1000/4 = 250 would drop the moment they clicked, which reads
    // as a bait-and-switch even though it favours the user.
    expect(getPricingSnapshot(config, 4).currentPriceFils).toBe(20_000);
  });

  it("treats a free event as free in every snapshot field", () => {
    const free: CostSplitConfig = {
      totalCostFils: 0,
      minHeadcount: 1,
      capacity: 100,
      priceFloorFils: 0,
      priceCeilingFils: 0,
    };

    const snapshot = getPricingSnapshot(free, 0);
    expect(snapshot.currentPriceFils).toBe(0);
    expect(snapshot.bestCasePriceFils).toBe(0);
  });
});
