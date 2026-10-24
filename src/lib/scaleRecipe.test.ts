import { describe, it, expect } from "vitest";
import { scaleRecipe } from "./scaleRecipe";

describe("scaleRecipe", () => {
  const baseRecipe = {
    id: "test-1",
    name: "Test Recipe",
    portions: 2,
    favorite: false,
    ingredients: [
      { ingredientId: "ing-1", quantity: 100 },
      { ingredientId: "ing-2", quantity: 50 },
    ],
  };

  it("scales up when requested portions > base portions", () => {
    const result = scaleRecipe(baseRecipe, 4);
    expect(result.ingredients[0].quantity).toBe(200);
    expect(result.ingredients[1].quantity).toBe(100);
  });

  it("scales down when requested portions < base portions", () => {
    const recipe = { ...baseRecipe, portions: 4 };
    const result = scaleRecipe(recipe, 2);
    expect(result.ingredients[0].quantity).toBe(50);
    expect(result.ingredients[1].quantity).toBe(25);
  });

  it("returns ratio 1 when base portions is 0", () => {
    const recipe = { ...baseRecipe, portions: 0 };
    const result = scaleRecipe(recipe, 4);
    expect(result.ingredients[0].quantity).toBe(100);
    expect(result.ingredients[1].quantity).toBe(50);
  });

  it("returns ratio 1 when base portions is NaN", () => {
    const recipe = { ...baseRecipe, portions: NaN };
    const result = scaleRecipe(recipe, 4);
    expect(result.ingredients[0].quantity).toBe(100);
    expect(result.ingredients[1].quantity).toBe(50);
  });

  it("returns ratio 1 when requested portions is 0", () => {
    const result = scaleRecipe(baseRecipe, 0);
    expect(result.ingredients[0].quantity).toBe(100);
    expect(result.ingredients[1].quantity).toBe(50);
  });

  it("returns ratio 1 when requested portions is negative", () => {
    const result = scaleRecipe(baseRecipe, -2);
    expect(result.ingredients[0].quantity).toBe(100);
    expect(result.ingredients[1].quantity).toBe(50);
  });

  it("returns ratio 1 when requested portions is NaN", () => {
    const result = scaleRecipe(baseRecipe, NaN);
    expect(result.ingredients[0].quantity).toBe(100);
    expect(result.ingredients[1].quantity).toBe(50);
  });

  it("does not mutate the original recipe", () => {
    const original = {
      id: "test-2",
      name: "Original",
      portions: 2,
      favorite: false,
      ingredients: [{ ingredientId: "ing-1", quantity: 100 }],
    };
    const originalQuantity = original.ingredients[0].quantity;

    scaleRecipe(original, 4);

    expect(original.ingredients[0].quantity).toBe(originalQuantity);
  });
});
