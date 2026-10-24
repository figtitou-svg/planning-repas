import type { Ingredient, Recipe } from "./types";

export interface RecipeCost {
  /** Coût de la recette entière, pour ses `portions` d'origine. */
  total: number;
  perPortion: number;
  /** Faux si au moins un ingrédient n'a pas pu être chiffré (montant alors sous-estimé). */
  complete: boolean;
}

/**
 * Coût de ce que la recette consomme : quantité ÷ taille du paquet × prix du paquet. La liste de
 * courses, elle, compte des paquets entiers. Un ingrédient absent du catalogue, sans prix, sans
 * taille de paquet ou avec une quantité nulle (import non complété) n'est pas chiffré.
 * Renvoie null quand aucun ingrédient n'a pu être chiffré.
 */
export function recipeCost(recipe: Recipe, catalog: Ingredient[]): RecipeCost | null {
  const byId = new Map(catalog.map((ing) => [ing.id, ing]));
  let total = 0;
  let priced = 0;

  for (const ri of recipe.ingredients) {
    const ing = byId.get(ri.ingredientId);
    if (!ing || !(ing.packageSize > 0) || !(ing.packagePrice > 0) || !(ri.quantity > 0)) continue;
    total += (ri.quantity / ing.packageSize) * ing.packagePrice;
    priced++;
  }

  if (priced === 0) return null;
  return {
    total,
    perPortion: total / Math.max(1, recipe.portions),
    complete: priced === recipe.ingredients.length,
  };
}
