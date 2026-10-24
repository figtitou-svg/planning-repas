import { describe, it, expect } from "vitest";
import { recipeCost } from "./recipeCost";
import type { Ingredient, Recipe } from "./types";

function ingredient(id: string, packageSize: number, packagePrice: number): Ingredient {
  return { id, name: id, unit: "g", packageSize, packagePrice, shelfLifeDays: 10, category: "Autre" };
}

function recipe(portions: number, ingredients: Array<[string, number]>): Recipe {
  return {
    id: "r",
    name: "Recette",
    portions,
    favorite: false,
    ingredients: ingredients.map(([ingredientId, quantity]) => ({ ingredientId, quantity })),
  };
}

const catalog = [
  ingredient("flour", 1000, 1.5), // 0,0015 €/g
  ingredient("milk", 1000, 1.2), // 0,0012 €/mL
  ingredient("free", 500, 0), // pas de prix
  ingredient("nosize", 0, 2), // pas de taille de paquet
];

describe("recipeCost", () => {
  it("prices what the recipe uses, not whole packages", () => {
    const cost = recipeCost(recipe(4, [["flour", 250], ["milk", 500]]), catalog);

    // 250 g × 0,0015 + 500 mL × 0,0012 = 0,375 + 0,6
    expect(cost?.total).toBeCloseTo(0.975);
    expect(cost?.perPortion).toBeCloseTo(0.24375);
    expect(cost?.complete).toBe(true);
  });

  it("flags an incomplete cost when some ingredients cannot be priced", () => {
    const cost = recipeCost(recipe(2, [["flour", 500], ["free", 100], ["nosize", 50], ["gone", 10]]), catalog);

    expect(cost?.total).toBeCloseTo(0.75);
    expect(cost?.perPortion).toBeCloseTo(0.375);
    expect(cost?.complete).toBe(false);
  });

  it("returns null when nothing can be priced", () => {
    expect(recipeCost(recipe(2, [["free", 100], ["nosize", 50]]), catalog)).toBeNull();
    expect(recipeCost(recipe(2, []), catalog)).toBeNull();
  });

  it("does not price an imported ingredient whose quantity is still 0", () => {
    const cost = recipeCost(recipe(2, [["flour", 0], ["milk", 0]]), catalog);

    expect(cost).toBeNull();
  });

  it("never divides by zero portions", () => {
    const cost = recipeCost(recipe(0, [["flour", 1000]]), catalog);

    expect(cost?.perPortion).toBeCloseTo(1.5);
  });
});
