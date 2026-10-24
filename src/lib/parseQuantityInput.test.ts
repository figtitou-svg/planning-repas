import { describe, it, expect } from "vitest";
import { parseQuantityInput } from "./parseQuantityInput";

describe("parseQuantityInput", () => {
  it("reads a number with a dot or a comma", () => {
    expect(parseQuantityInput("500")).toBe(500);
    expect(parseQuantityInput(" 1,5 ")).toBe(1.5);
    expect(parseQuantityInput("0.25")).toBe(0.25);
  });

  it("returns null for an empty field (back to one package)", () => {
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("   ")).toBeNull();
  });

  it("returns undefined for anything that is not a positive number", () => {
    for (const text of ["abc", "0", "-3", "2 kg", "1,2,3"]) {
      expect(parseQuantityInput(text)).toBeUndefined();
    }
  });
});
