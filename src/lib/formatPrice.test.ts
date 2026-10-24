import { describe, it, expect } from "vitest";
import { formatPrice } from "./formatPrice";

// Intl insère des espaces insécables : on les ramène à des espaces simples pour comparer.
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("formatPrice", () => {
  it("uses a decimal comma and the euro sign", () => {
    expect(plain(formatPrice(3.2))).toBe("3,20 €");
  });

  it("groups thousands", () => {
    expect(plain(formatPrice(1234.5))).toBe("1 234,50 €");
  });

  it("falls back to zero for non-finite values", () => {
    expect(plain(formatPrice(NaN))).toBe("0,00 €");
  });
});
