import { describe, it, expect } from "vitest";
import { missingFields } from "./incomplete";
import type { Ingredient } from "./types";

const complete: Ingredient = {
  id: "i1",
  name: "Farine",
  unit: "g",
  packageSize: 1000,
  packagePrice: 1.5,
  shelfLifeDays: 365,
  category: "Épicerie",
};

describe("missingFields", () => {
  it("returns an empty list when complete", () => {
    expect(missingFields(complete)).toEqual([]);
  });

  it("flags each non-positive field", () => {
    expect(missingFields({ ...complete, packageSize: 0 })).toEqual(["packageSize"]);
    expect(missingFields({ ...complete, packagePrice: 0 })).toEqual(["packagePrice"]);
    expect(missingFields({ ...complete, shelfLifeDays: 0 })).toEqual(["shelfLifeDays"]);
  });

  it("lists fields in a fixed order", () => {
    expect(
      missingFields({ ...complete, packageSize: 0, packagePrice: 0, shelfLifeDays: 0 })
    ).toEqual(["packageSize", "packagePrice", "shelfLifeDays"]);
  });
});
