import type { Ingredient } from "./types";

export const MAX_SEARCH_RESULTS = 8;

/** Minuscules, sans accents, ligatures œ/æ dépliées : « Crème » ~ « creme », « Bœuf » ~ « boeuf ». */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .trim();
}

/** Ingrédients dont le nom contient la requête (insensible à la casse et aux accents). Requête vide : aucun résultat. */
export function searchIngredients(
  ingredients: Ingredient[],
  query: string,
  max: number = MAX_SEARCH_RESULTS
): Ingredient[] {
  const needle = normalizeText(query);
  if (needle === "") return [];
  return ingredients.filter((ing) => normalizeText(ing.name).includes(needle)).slice(0, max);
}
