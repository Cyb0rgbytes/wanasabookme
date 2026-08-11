import { describe, it, expect } from "vitest";
import { slugify, validateEventInput, type EventInput } from "./events";

/**
 * Spec for event creation helpers.
 *
 * The capacity race — two people claiming the last seat — cannot be tested
 * here, because it is a property of the SQL, not of any pure function. It is
 * covered by an integration test against a real D1 instance in
 * scripts/test-join-race.mjs.
 */

describe("slugify", () => {
  it("lowercases and hyphenates Latin text", () => {
    expect(slugify("Desert BBQ in Abu Dhabi")).toBe("desert-bbq-in-abu-dhabi");
  });

  it("strips punctuation that would break a URL", () => {
    expect(slugify("Ramadan Iftar @ Al Qasr (2026)!")).toBe(
      "ramadan-iftar-al-qasr-2026",
    );
  });

  it("collapses runs of separators", () => {
    expect(slugify("a   ---   b")).toBe("a-b");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  -- hello --  ")).toBe("hello");
  });

  it("preserves Arabic script rather than stripping it to nothing", () => {
    // A naive [a-z0-9] filter erases Arabic entirely, leaving an empty slug —
    // so an Arabic-titled event would get a meaningless URL.
    expect(slugify("حفل عشاء")).toBe("حفل-عشاء");
  });

  it("handles mixed Arabic and Latin", () => {
    expect(slugify("Iftar إفطار 2026")).toBe("iftar-إفطار-2026");
  });

  it("returns an empty string when nothing survives", () => {
    // Caller must fall back to a generated slug rather than emit "/events/".
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("truncates very long titles at a word boundary", () => {
    const long = "a".repeat(40) + " " + "b".repeat(40);
    const slug = slugify(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    // Must not end mid-separator.
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("validateEventInput", () => {
  const valid: EventInput = {
    titleEn: "Desert BBQ",
    titleAr: "شواء في الصحراء",
    descriptionEn: "An evening in the dunes.",
    descriptionAr: "أمسية في الكثبان.",
    startsAt: Date.now() + 86_400_000, // tomorrow
    endsAt: Date.now() + 90_000_000,
    timezone: "Asia/Dubai",
    venueName: "Al Marmoom",
    city: "Dubai",
    capacity: 20,
    minHeadcount: 4,
    totalCostFils: 100_000,
    priceFloorFils: 5_000,
    priceCeilingFils: 20_000,
    audience: "mixed",
    category: "outdoors",
  };

  it("accepts a well-formed event", () => {
    expect(validateEventInput(valid).ok).toBe(true);
  });

  it("requires an English title as the fallback language", () => {
    const r = validateEventInput({ ...valid, titleEn: "  " });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.titleEn).toBeDefined();
  });

  it("allows a missing Arabic title so publishing is never blocked", () => {
    expect(validateEventInput({ ...valid, titleAr: undefined }).ok).toBe(true);
  });

  it("rejects an event that starts in the past", () => {
    const r = validateEventInput({ ...valid, startsAt: Date.now() - 1000 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.startsAt).toBeDefined();
  });

  it("rejects an end before the start", () => {
    const r = validateEventInput({
      ...valid,
      startsAt: Date.now() + 86_400_000,
      endsAt: Date.now() + 3_600_000,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.endsAt).toBeDefined();
  });

  it("requires capacity of at least one", () => {
    expect(validateEventInput({ ...valid, capacity: 0 }).ok).toBe(false);
  });

  it("rejects a minimum headcount above capacity", () => {
    // Otherwise the event can never confirm — guaranteed cancellation.
    const r = validateEventInput({ ...valid, minHeadcount: 25, capacity: 20 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.minHeadcount).toBeDefined();
  });

  it("rejects a floor above the ceiling", () => {
    const r = validateEventInput({
      ...valid,
      priceFloorFils: 30_000,
      priceCeilingFils: 20_000,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.priceFloorFils).toBeDefined();
  });

  it("rejects negative money", () => {
    expect(validateEventInput({ ...valid, totalCostFils: -1 }).ok).toBe(false);
    expect(validateEventInput({ ...valid, priceFloorFils: -1 }).ok).toBe(false);
  });

  it("rejects non-integer money — fils are indivisible", () => {
    const r = validateEventInput({ ...valid, totalCostFils: 100.5 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.totalCostFils).toBeDefined();
  });

  it("allows a free event with zero cost and zero floor", () => {
    const r = validateEventInput({
      ...valid,
      totalCostFils: 0,
      priceFloorFils: 0,
      priceCeilingFils: 0,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown audience value", () => {
    const r = validateEventInput({
      ...valid,
      audience: "adults_only" as EventInput["audience"],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid IANA timezone", () => {
    const r = validateEventInput({ ...valid, timezone: "Mars/Olympus" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.errors.timezone).toBeDefined();
  });

  it("reports every problem at once, not just the first", () => {
    const r = validateEventInput({
      ...valid,
      titleEn: "",
      capacity: 0,
      totalCostFils: -5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(3);
    }
  });
});
