import { describe, it, expect } from "vitest";
import { expiryDay, daysBetween, toDay, isValidDay } from "./expiry";

describe("expiryDay", () => {
  it("adds shelf life days", () => {
    expect(expiryDay("2026-09-10", 5)).toBe("2026-09-15");
  });

  it("crosses month boundaries", () => {
    expect(expiryDay("2026-09-28", 5)).toBe("2026-10-03");
    expect(expiryDay("2028-02-27", 3)).toBe("2028-03-01");
  });

  it("crosses year boundaries", () => {
    expect(expiryDay("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("returns the same day for a shelf life of 0", () => {
    expect(expiryDay("2026-09-10", 0)).toBe("2026-09-10");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e12, -1e12, 36_501])(
    "returns null instead of throwing for shelf life %s",
    (shelfLifeDays) => {
      expect(expiryDay("2026-09-10", shelfLifeDays)).toBeNull();
    }
  );

  it("accepts the maximum shelf life", () => {
    expect(expiryDay("2026-09-10", 36_500)).toBe("2126-08-17");
  });

  it("returns null for an invalid purchase day", () => {
    expect(expiryDay("", 5)).toBeNull();
    expect(expiryDay("nope", 5)).toBeNull();
    expect(expiryDay("2026-13-40", 5)).toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-09-19", "2026-09-22")).toBe(3);
    expect(daysBetween("2026-09-19", "2026-09-19")).toBe(0);
  });

  it("is negative when toDay is earlier", () => {
    expect(daysBetween("2026-09-19", "2026-09-17")).toBe(-2);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-09-28", "2026-10-03")).toBe(5);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
});

describe("toDay / isValidDay", () => {
  it("accepts real calendar dates and trims a time part", () => {
    expect(toDay("2026-09-10")).toBe("2026-09-10");
    expect(toDay("2026-09-10T08:30:00.000+02:00")).toBe("2026-09-10");
  });

  it("rejects empty, malformed and impossible dates", () => {
    expect(toDay("")).toBeNull();
    expect(toDay("hier")).toBeNull();
    expect(toDay("2026-02-30")).toBeNull();
    expect(isValidDay("2026-02-28")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
  });
});
