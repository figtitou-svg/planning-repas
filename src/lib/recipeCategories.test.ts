import { describe, it, expect } from "vitest";
import {
  groupByCategory,
  invalidCategory,
  isRecipeCategory,
  parseRecipeCategory,
  recipeCategoryColor,
  RECIPE_CATEGORIES,
} from "./recipeCategories";

describe("recipe categories", () => {
  it("gives every category its own colour slot", () => {
    const colors = RECIPE_CATEGORIES.map((category) => recipeCategoryColor(category));
    expect(new Set(colors).size).toBe(RECIPE_CATEGORIES.length);
    expect(colors.every((color) => /^var\(--cat-[1-8]\)$/.test(color))).toBe(true);
  });

  it.each([[undefined], [""], ["Inconnue"]])("uses the neutral colour for %j", (category) => {
    expect(recipeCategoryColor(category)).toBe(recipeCategoryColor("Autre"));
  });

  it("recognises only known categories", () => {
    expect(isRecipeCategory("Dessert")).toBe(true);
    expect(isRecipeCategory("dessert")).toBe(false);
    expect(isRecipeCategory(3)).toBe(false);
  });

  it("reads an unknown Notion value as no category", () => {
    expect(parseRecipeCategory("Viande")).toBe("Viande");
    expect(parseRecipeCategory("Supprimée")).toBe("");
    expect(parseRecipeCategory(null)).toBe("");
  });

  it("validates a request category", () => {
    expect(invalidCategory(undefined)).toBe(false);
    expect(invalidCategory("")).toBe(false);
    expect(invalidCategory("Apéro")).toBe(false);
    expect(invalidCategory("Pizza")).toBe(true);
    expect(invalidCategory(4)).toBe(true);
    expect(invalidCategory(null)).toBe(true);
  });
});

describe("groupByCategory", () => {
  it("groupe dans l'ordre des catégories, sans catégorie à la fin, sans groupe vide", () => {
    const recipes = [
      { id: "1", category: "Dessert" },
      { id: "2" },
      { id: "3", category: "Légumes" },
      { id: "4", category: "Dessert" },
      { id: "5", category: "Inconnue" },
    ];
    expect(groupByCategory(recipes).map((g) => [g.category, g.recipes.map((r) => r.id)])).toEqual([
      ["Légumes", ["3"]],
      ["Dessert", ["1", "4"]],
      ["", ["2", "5"]],
    ]);
  });
});
