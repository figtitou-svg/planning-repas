import { normalizeText } from "./ingredientSearch";
import type { Ingredient, Recipe } from "./types";

export interface RecipeFilter {
  query: string;
  onlyFavorites: boolean;
}

/**
 * Recettes à afficher : filtrées par la recherche (nom de la recette ou d'un de ses ingrédients,
 * sans tenir compte des accents ni de la casse) et par le filtre « favorites », avec les favorites
 * en premier. L'ordre d'origine est conservé à l'intérieur de chaque groupe.
 */
export function filterRecipes(
  recipes: Recipe[],
  catalog: Ingredient[],
  { query, onlyFavorites }: RecipeFilter
): Recipe[] {
  const needle = normalizeText(query);
  const nameOf = new Map(catalog.map((ing) => [ing.id, normalizeText(ing.name)]));

  const matches = (recipe: Recipe): boolean => {
    if (onlyFavorites && !recipe.favorite) return false;
    if (needle === "") return true;
    if (normalizeText(recipe.name).includes(needle)) return true;
    return recipe.ingredients.some((ri) => nameOf.get(ri.ingredientId)?.includes(needle));
  };

  const kept = recipes.filter(matches);
  return [...kept.filter((r) => r.favorite), ...kept.filter((r) => !r.favorite)];
}
