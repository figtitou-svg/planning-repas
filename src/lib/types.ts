export type Unit = "g" | "mL" | "pièce";

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
  packageSize: number;
  packagePrice: number;
  shelfLifeDays: number;
  category: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  portions: number;
  /** Recette gardée à portée de main (case « Favori » dans Notion). */
  favorite: boolean;
  ingredients: RecipeIngredient[];
}

export interface PantryItem {
  id: string;
  ingredientId: string;
  quantity: number;
  purchaseDate: string;
}

export interface PlannedMeal {
  id: string;
  weekStart: string;
  recipeId: string;
  portions: number;
}

/** Article ajouté à la main pour une semaine ; `quantity` (dans l'unité du catalogue) est facultative. */
export interface ShoppingExtra {
  ingredientId: string;
  quantity: number | null;
}

export interface ShoppingListLine {
  ingredientId: string;
  ingredientName: string;
  category: string;
  missingQuantity: number;
  unit: Unit;
  packagesToBuy: number;
  lineCost: number;
  /** Ajouté à la main, sans recette : peut être retiré de la liste. */
  manual?: boolean;
  /** Part tapée à la main (dans l'unité du catalogue) pour un article ajouté : sert à la modifier. */
  extraQuantity?: number;
  /** Taille ou prix du paquet inconnus : la ligne existe mais n'a pas de prix fiable. */
  incomplete?: boolean;
}

export interface ShoppingListGroup {
  category: string;
  lines: ShoppingListLine[];
  subtotal: number;
}

export interface ShoppingList {
  groups: ShoppingListGroup[];
  totalCost: number;
}
