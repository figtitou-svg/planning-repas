import { describe, it, expect } from "vitest";
import {
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
