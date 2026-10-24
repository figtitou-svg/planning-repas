import { describe, it, expect } from "vitest";
import { filterRecipes } from "./recipeFilter";
import type { Ingredient, Recipe } from "./types";

function ingredient(id: string, name: string): Ingredient {
  return { id, name, unit: "g", packageSize: 100, packagePrice: 1, shelfLifeDays: 10, category: "Autre" };
}

function recipe(id: string, name: string, ingredientIds: string[], favorite = false): Recipe {
  return {
    id,
    name,
    portions: 4,
    favorite,
    ingredients: ingredientIds.map((ingredientId) => ({ ingredientId, quantity: 1 })),
  };
}

const catalog = [ingredient("egg", "Œufs"), ingredient("flour", "Farine"), ingredient("rice", "Riz")];
const crepes = recipe("r1", "Crêpes", ["flour", "egg"]);
const carbonara = recipe("r2", "Pâtes carbonara", ["egg"], true);
const risotto = recipe("r3", "Risotto", ["rice"], true);
const all = [crepes, carbonara, risotto];

const ids = (list: Recipe[]) => list.map((r) => r.id);

describe("filterRecipes", () => {
  it("puts favorites first and keeps the original order inside each group", () => {
    expect(ids(filterRecipes(all, catalog, { query: "", onlyFavorites: false }))).toEqual([
      "r2",
      "r3",
      "r1",
    ]);
  });

  it("keeps only favorites when asked", () => {
    expect(ids(filterRecipes(all, catalog, { query: "", onlyFavorites: true }))).toEqual(["r2", "r3"]);
  });

  it("searches recipe names without caring about accents or case", () => {
    expect(ids(filterRecipes(all, catalog, { query: "CREPES", onlyFavorites: false }))).toEqual(["r1"]);
    expect(ids(filterRecipes(all, catalog, { query: "pates", onlyFavorites: false }))).toEqual(["r2"]);
  });

  it("also finds a recipe by one of its ingredients", () => {
    expect(ids(filterRecipes(all, catalog, { query: "oeuf", onlyFavorites: false }))).toEqual(["r2", "r1"]);
  });

  it("combines the search with the favorites filter", () => {
    expect(ids(filterRecipes(all, catalog, { query: "oeuf", onlyFavorites: true }))).toEqual(["r2"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterRecipes(all, catalog, { query: "pizza", onlyFavorites: false })).toEqual([]);
  });

  it("ignores an ingredient that is no longer in the catalogue", () => {
    const orphan = recipe("r4", "Mystère", ["gone"]);
    expect(ids(filterRecipes([orphan], catalog, { query: "gone", onlyFavorites: false }))).toEqual([]);
  });
});
