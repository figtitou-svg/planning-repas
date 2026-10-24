import type { Recipe } from "./types";

export function scaleRecipe(recipe: Recipe, portions: number): Recipe {
  const base = recipe.portions;
  const valid = Number.isFinite(base) && base > 0 && Number.isFinite(portions) && portions > 0;
  const ratio = valid ? portions / base : 1;
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ri) => ({ ...ri, quantity: ri.quantity * ratio })),
  };
}
