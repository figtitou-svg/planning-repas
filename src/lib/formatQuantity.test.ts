import { describe, it, expect } from "vitest";
import { formatAmount, formatQuantity } from "./formatQuantity";

describe("formatQuantity", () => {
  it("keeps integers as integers", () => {
    expect(formatQuantity(250)).toBe("250");
    expect(formatQuantity(0)).toBe("0");
  });

  it("rounds to at most 2 decimals", () => {
    expect(formatQuantity(833.3333333333334)).toBe("833,33");
    expect(formatQuantity(0.005)).toBe("0,01");
  });

  it("drops trailing zeros", () => {
    expect(formatQuantity(1.5)).toBe("1,5");
    expect(formatQuantity(2.001)).toBe("2");
  });

  it("falls back to 0 for non-finite values", () => {
    expect(formatQuantity(NaN)).toBe("0");
    expect(formatQuantity(Infinity)).toBe("0");
  });
});

describe("formatAmount", () => {
  it("pluralises only the piece unit", () => {
    expect(formatAmount(1, "pièce")).toBe("1 pièce");
    expect(formatAmount(6, "pièce")).toBe("6 pièces");
    expect(formatAmount(250, "g")).toBe("250 g");
    expect(formatAmount(1500, "mL")).toBe("1500 mL");
  });
});
