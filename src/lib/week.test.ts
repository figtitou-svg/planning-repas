import { describe, it, expect } from "vitest";
import { localCalendarDateAsUtc, localTodayString, mondayOf, nextWeekStart } from "./week";

describe("mondayOf", () => {
  it("returns the same date when given a Monday", () => {
    expect(mondayOf(new Date("2026-09-14T10:00:00Z"))).toBe("2026-09-14");
  });

  it("returns the preceding Monday for a mid-week date", () => {
    expect(mondayOf(new Date("2026-09-16T10:00:00Z"))).toBe("2026-09-14");
  });

  it("returns the preceding Monday for a Sunday", () => {
    expect(mondayOf(new Date("2026-09-20T10:00:00Z"))).toBe("2026-09-14");
  });
});

describe("nextWeekStart", () => {
  it("returns next Monday when given a Wednesday", () => {
    expect(nextWeekStart(new Date("2026-09-16T10:00:00Z"))).toBe("2026-09-21");
  });

  it("returns next Monday when given a Sunday", () => {
    expect(nextWeekStart(new Date("2026-09-20T10:00:00Z"))).toBe("2026-09-21");
  });
});

describe("localTodayString", () => {
  it("returns the local calendar day, not the UTC one", () => {
    expect(localTodayString(new Date(2026, 8, 21, 0, 30))).toBe("2026-09-21");
    expect(localTodayString(new Date(2026, 8, 20, 23, 59))).toBe("2026-09-20");
  });

  it("matches localCalendarDateAsUtc and defaults to now", () => {
    expect(localTodayString()).toBe(localCalendarDateAsUtc(new Date()).toISOString().slice(0, 10));
  });
});
