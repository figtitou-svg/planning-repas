import type { CreatedLine, MatchedLine } from "./matchIngredients";
import type { Ingredient, RecipeIngredient, Unit } from "./types";

export const MAX_INGREDIENT_NAME_LENGTH = 80;

export type NewIngredientDraft = {
  name: string;
  unit: Unit;
  quantity: number;
  unitMismatch?: true;
};

export interface ImportResponse {
  name: string;
  portions: number;
  matched: MatchedLine[];
  created: CreatedLine[];
  /** Étapes de préparation ; absent des anciennes réponses. */
  steps?: string[];
}

export interface RecipeDraft {
  name: string;
  portions: number;
  ingredients: RecipeIngredient[];
  newIngredients: NewIngredientDraft[];
  unitMismatchIds?: string[];
  steps: string[];
}

// Lines whose ingredient is no longer in the catalogue are dropped: the form
// could not display them and saving them would point at a missing page.
export function buildDraft(response: ImportResponse, catalog: Ingredient[]): RecipeDraft {
  const known = new Set(catalog.map((ingredient) => ingredient.id));
  const kept = response.matched.filter((line) => known.has(line.ingredientId));
  return {
    name: response.name,
    portions:
      Number.isFinite(response.portions) && response.portions >= 1
        ? Math.round(response.portions)
        : 2,
    ingredients: kept.map(({ ingredientId, quantity }) => ({ ingredientId, quantity })),
    newIngredients: response.created.map(({ name, unit, quantity, unitMismatch }) => ({
      name,
      unit,
      quantity,
      ...(unitMismatch ? { unitMismatch: true as const } : {}),
    })),
    unitMismatchIds: kept.filter((line) => line.unitMismatch).map((line) => line.ingredientId),
    steps: Array.isArray(response.steps)
      ? response.steps.filter((step): step is string => typeof step === "string")
      : [],
  };
}

export function validateNewIngredientName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Le nom d'un nouvel ingrédient est vide";
  if (trimmed.length > MAX_INGREDIENT_NAME_LENGTH) {
    return `Le nom d'un nouvel ingrédient est trop long (${MAX_INGREDIENT_NAME_LENGTH} caractères maximum)`;
  }
  return null;
}
