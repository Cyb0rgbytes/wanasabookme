import { describe, it, expect } from "vitest";
import {
  computeSettledPrice,
  resolveAttendeePrice,
  isConfirmable,
  type CostSplitConfig,
} from "./pricing";

/**
 * Cost-split pricing spec.
 *
 * All money is INTEGER FILS (1 AED = 100 fils). Floats are never used for
 * money — 0.1 + 0.2 !== 0.3, and a rounding drift of one fil per attendee
 * across a 200-person event is a real reconciliation problem.
 *
 * The model, as agreed:
 *   settled     = clamp(totalCost / confirmedAttendees, floor, ceiling)
 *   confirmable = confirmedAttendees >= minHeadcount
 *   you pay     = min(priceWhenYouJoined, settled)   ← join price is a CAP
 *
 * That last line is the subtle one. The join-time price is a personal ceiling,
 * not a fixed amount: nobody is ever charged more than they agreed to, and
 * everybody benefits when later joins push the price down.
 */

/** 1000 AED total, 4–20 people, 50–200 AED per person. */
const baseConfig: CostSplitConfig = {
  totalCostFils: 100_000, // 1000 AED
  minHeadcount: 4,
  capacity: 20,
  priceFloorFils: 5_000, // 50 AED
  priceCeilingFils: 20_000, // 200 AED
};

describe("computeSettledPrice", () => {
  it("divides the total evenly among attendees", () => {
    // 1000 AED / 10 = 100 AED, inside [50, 200]
    expect(computeSettledPrice(baseConfig, 10)).toBe(10_000);
  });

  it("clamps to the ceiling when too few have joined", () => {
    // 1000 / 2 = 500 AED, above the 200 ceiling.
    // Attendees pay 200; the organizer absorbs the shortfall.
    expect(computeSettledPrice(baseConfig, 2)).toBe(20_000);
  });

  it("clamps to the floor when many have joined", () => {
    // 1000 / 20 = 50 AED — exactly the floor, so no clamping needed yet.
    expect(computeSettledPrice(baseConfig, 20)).toBe(5_000);

    // A cheaper event where the raw split would fall below the floor.
    const cheap: CostSplitConfig = { ...baseConfig, totalCostFils: 40_000 };
    // 400 / 20 = 20 AED, below the 50 floor → floor wins, organizer keeps surplus.
    expect(computeSettledPrice(cheap, 20)).toBe(5_000);
  });

  it("returns the ceiling for zero attendees rather than dividing by zero", () => {
    // Shown as the worst-case price on an empty event page.
    expect(computeSettledPrice(baseConfig, 0)).toBe(20_000);
  });

  it("charges a single attendee no more than the ceiling", () => {
    expect(computeSettledPrice(baseConfig, 1)).toBe(20_000);
  });

  it("rounds up to whole fils so the organizer is never short", () => {
    // 1000 fils / 3 = 333.33… Rounding down collects 999 and leaves a
    // 1-fil hole; rounding up collects 1002. Favour the organizer.
    const odd: CostSplitConfig = {
      ...baseConfig,
      totalCostFils: 1_000,
      priceFloorFils: 0,
      priceCeilingFils: 100_000,
    };
    expect(computeSettledPrice(odd, 3)).toBe(334);
  });

  it("never returns a fractional value", () => {
    for (let n = 1; n <= 20; n++) {
      const price = computeSettledPrice(baseConfig, n);
      expect(Number.isInteger(price)).toBe(true);
    }
  });

  it("never exceeds capacity in its own maths", () => {
    // Over-capacity input should not produce a price below the floor.
    expect(computeSettledPrice(baseConfig, 999)).toBe(5_000);
  });

  it("is monotonic — price never rises as attendance grows", () => {
    let previous = Infinity;
    for (let n = 1; n <= 20; n++) {
      const price = computeSettledPrice(baseConfig, n);
      expect(price).toBeLessThanOrEqual(previous);
      previous = price;
    }
  });

  it("treats a free event as free at any headcount", () => {
    const free: CostSplitConfig = {
      ...baseConfig,
      totalCostFils: 0,
      priceFloorFils: 0,
    };
    expect(computeSettledPrice(free, 0)).toBe(0);
    expect(computeSettledPrice(free, 1)).toBe(0);
    expect(computeSettledPrice(free, 50)).toBe(0);
  });
});

describe("isConfirmable", () => {
  it("is false below the minimum headcount", () => {
    expect(isConfirmable(baseConfig, 3)).toBe(false);
  });

  it("is true exactly at the minimum", () => {
    expect(isConfirmable(baseConfig, 4)).toBe(true);
  });

  it("is true above the minimum", () => {
    expect(isConfirmable(baseConfig, 12)).toBe(true);
  });

  it("treats a zero minimum as always confirmable", () => {
    expect(isConfirmable({ ...baseConfig, minHeadcount: 0 }, 0)).toBe(true);
  });
});

describe("resolveAttendeePrice", () => {
  it("charges the settled price when it is below the join-time price", () => {
    // Joined when it was 200; it settled at 100. Pay 100.
    expect(resolveAttendeePrice(20_000, 10_000)).toBe(10_000);
  });

  it("never charges more than the join-time price", () => {
    // Joined at 50; it settled at 200 because others dropped out.
    // The early joiner is protected: they pay 50, not 200.
    expect(resolveAttendeePrice(5_000, 20_000)).toBe(5_000);
  });

  it("charges the same amount when the two agree", () => {
    expect(resolveAttendeePrice(10_000, 10_000)).toBe(10_000);
  });

  it("keeps a free join free even if the price later rises", () => {
    expect(resolveAttendeePrice(0, 20_000)).toBe(0);
  });
});

describe("end-to-end scenarios", () => {
  it("a filling event drops the price for everyone", () => {
    const joinPrices: number[] = [];
    for (let n = 1; n <= 10; n++) {
      joinPrices.push(computeSettledPrice(baseConfig, n));
    }

    const settled = computeSettledPrice(baseConfig, 10);
    expect(settled).toBe(10_000); // 100 AED

    // Everyone converges on the settled price, including the first joiner
    // who saw 200 AED.
    for (const joinPrice of joinPrices) {
      expect(resolveAttendeePrice(joinPrice, settled)).toBe(settled);
    }
  });

  it("an under-subscribed event does not confirm, and nobody overpays", () => {
    const attendees = 2;
    expect(isConfirmable(baseConfig, attendees)).toBe(false);

    // Even if it somehow settled, the ceiling still binds.
    const settled = computeSettledPrice(baseConfig, attendees);
    expect(settled).toBe(20_000);
    expect(settled).toBeLessThanOrEqual(baseConfig.priceCeilingFils);
  });

  it("a late joiner never subsidises earlier ones", () => {
    const earlyJoinPrice = computeSettledPrice(baseConfig, 2); // 200 AED
    const lateJoinPrice = computeSettledPrice(baseConfig, 10); // 100 AED
    const settled = lateJoinPrice;

    expect(resolveAttendeePrice(earlyJoinPrice, settled)).toBe(settled);
    expect(resolveAttendeePrice(lateJoinPrice, settled)).toBe(settled);
  });
});
