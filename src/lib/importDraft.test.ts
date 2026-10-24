import { describe, expect, it } from "vitest";
import { buildDraft, validateNewIngredientName } from "./importDraft";
import type { Ingredient } from "./types";

const CATALOG: Ingredient[] = [
  { id: "i1", name: "Pâtes", unit: "g", packageSize: 500, packagePrice: 1, shelfLifeDays: 300, category: "Épicerie" },
  { id: "i2", name: "Tomate", unit: "pièce", packageSize: 1, packagePrice: 1, shelfLifeDays: 7, category: "Légumes" },
];

describe("buildDraft", () => {
  it("maps matched and created lines and flags unit mismatches", () => {
    const draft = buildDraft(
      {
        name: "Pâtes tomate",
        portions: 4,
        matched: [
          { ingredientId: "i1", quantity: 400 },
          { ingredientId: "i2", quantity: 200, unitMismatch: true },
        ],
        created: [{ name: "basilic", unit: "g", quantity: 5 }],
      },
      CATALOG
    );

    expect(draft).toEqual({
      name: "Pâtes tomate",
      portions: 4,
      ingredients: [
        { ingredientId: "i1", quantity: 400 },
        { ingredientId: "i2", quantity: 200 },
      ],
      newIngredients: [{ name: "basilic", unit: "g", quantity: 5 }],
      unitMismatchIds: ["i2"],
    });
  });

  it("propagates unitMismatch on new ingredients", () => {
    const draft = buildDraft(
      {
        name: "R",
        portions: 2,
        matched: [],
        created: [
          { name: "basilic", unit: "g", quantity: 5, unitMismatch: true },
          { name: "sel", unit: "g", quantity: 1 },
        ],
      },
      CATALOG
    );

    expect(draft.newIngredients).toEqual([
      { name: "basilic", unit: "g", quantity: 5, unitMismatch: true },
      { name: "sel", unit: "g", quantity: 1 },
    ]);
  });

  it("drops matched lines whose ingredient is not in the catalogue", () => {
    const draft = buildDraft(
      {
        name: "R",
        portions: 2,
        matched: [
          { ingredientId: "i1", quantity: 1 },
          { ingredientId: "gone", quantity: 2, unitMismatch: true },
        ],
        created: [],
      },
      CATALOG
    );

    expect(draft.ingredients).toEqual([{ ingredientId: "i1", quantity: 1 }]);
    expect(draft.unitMismatchIds).toEqual([]);
  });

  it("rounds portions and falls back to 2 when unusable", () => {
    const base = { name: "R", matched: [], created: [] };

    expect(buildDraft({ ...base, portions: 3.6 }, CATALOG).portions).toBe(4);
    expect(buildDraft({ ...base, portions: 0 }, CATALOG).portions).toBe(2);
    expect(buildDraft({ ...base, portions: Number.NaN }, CATALOG).portions).toBe(2);
  });
});

describe("validateNewIngredientName", () => {
  it("accepts a normal name", () => {
    expect(validateNewIngredientName("Basilic")).toBeNull();
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateNewIngredientName("")).not.toBeNull();
    expect(validateNewIngredientName("   ")).not.toBeNull();
  });

  it("accepts 80 characters and rejects 81 (after trimming)", () => {
    expect(validateNewIngredientName(` ${"a".repeat(80)} `)).toBeNull();
    expect(validateNewIngredientName("a".repeat(81))).not.toBeNull();
  });
});
