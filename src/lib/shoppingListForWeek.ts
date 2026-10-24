import type { Client } from "@notionhq/client";
import { listIngredients } from "./repositories/ingredients";
import { listRecipes } from "./repositories/recipes";
import { listPantry } from "./repositories/pantry";
import { listPlannedMeals } from "./repositories/plannedMeals";
import { getCategoryOrder } from "./repositories/categoryOrder";
import { listExtras } from "./repositories/shoppingChecks";
import { computeShoppingList } from "./shoppingList";
import { scaleRecipe } from "./scaleRecipe";
import type { HouseholdId } from "./households";
import type { Ingredient, PantryItem, PlannedMeal, Recipe, ShoppingExtra, ShoppingList } from "./types";

/** Les lectures dont dépend la liste : par défaut Notion en direct, la route injecte des lectures en cache. */
export interface ShoppingListReads {
  listIngredients(client: Client): Promise<Ingredient[]>;
  listRecipes(client: Client): Promise<Recipe[]>;
  listPantry(client: Client, household: HouseholdId): Promise<PantryItem[]>;
  listPlannedMeals(client: Client, household: HouseholdId, weekStart: string): Promise<PlannedMeal[]>;
  getCategoryOrder(client: Client): Promise<string[]>;
  listExtras(client: Client, household: HouseholdId, weekStart: string): Promise<ShoppingExtra[]>;
}

const directReads: ShoppingListReads = {
  listIngredients,
  listRecipes,
  listPantry,
  listPlannedMeals,
  getCategoryOrder,
  listExtras,
};

export async function buildShoppingListForWeek(
  client: Client,
  household: HouseholdId,
  weekStart: string,
  reads: ShoppingListReads = directReads
): Promise<ShoppingList> {
  const [ingredients, allRecipes, pantry, meals, categoryOrder, extras] = await Promise.all([
    reads.listIngredients(client),
    reads.listRecipes(client),
    reads.listPantry(client, household),
    reads.listPlannedMeals(client, household, weekStart),
    reads.getCategoryOrder(client),
    reads.listExtras(client, household, weekStart),
  ]);

  const scaled = meals.flatMap((meal) => {
    const recipe = allRecipes.find((r) => r.id === meal.recipeId);
    return recipe ? [scaleRecipe(recipe, meal.portions)] : [];
  });

  return computeShoppingList(scaled, ingredients, pantry, categoryOrder, new Date(), extras);
}
