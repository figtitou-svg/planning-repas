import { describe, it, expect } from "vitest";
import { addDays, formatWeekRange, relativeWeekLabel } from "./weekLabel";

describe("addDays", () => {
  it("moves forward and backward across month and year boundaries", () => {
    expect(addDays("2026-09-28", 7)).toBe("2026-10-05");
    expect(addDays("2026-01-05", -7)).toBe("2025-12-29");
  });
});

describe("formatWeekRange", () => {
  it("names both months when the week spans two", () => {
    expect(formatWeekRange("2026-09-28")).toBe("28 sept. – 4 oct.");
  });

  it("names the month once when the week stays inside one", () => {
    expect(formatWeekRange("2026-09-21")).toBe("21 – 27 sept.");
  });
});

describe("relativeWeekLabel", () => {
  const current = "2026-09-21";

  it("labels the current, next and previous weeks", () => {
    expect(relativeWeekLabel("2026-09-21", current)).toBe("Cette semaine");
    expect(relativeWeekLabel("2026-09-28", current)).toBe("Semaine prochaine");
    expect(relativeWeekLabel("2026-09-14", current)).toBe("Semaine dernière");
  });

  it("counts weeks further away", () => {
    expect(relativeWeekLabel("2026-10-12", current)).toBe("Dans 3 semaines");
    expect(relativeWeekLabel("2026-08-31", current)).toBe("Il y a 3 semaines");
  });
});
