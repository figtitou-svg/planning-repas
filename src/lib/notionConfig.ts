import { householdEnvSuffix, type HouseholdId } from "./households";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const notionConfig = {
  token: () => requireEnv("NOTION_TOKEN"),
  ingredientsDbId: () => requireEnv("NOTION_INGREDIENTS_DB_ID"),
  recipesDbId: () => requireEnv("NOTION_RECIPES_DB_ID"),
  recipeIngredientsDbId: () => requireEnv("NOTION_RECIPE_INGREDIENTS_DB_ID"),
  pantryDbId: (household: HouseholdId) => requireEnv(`NOTION_PANTRY_DB_ID${householdEnvSuffix(household)}`),
  weeklyPlanDbId: (household: HouseholdId) => requireEnv(`NOTION_WEEKLY_PLAN_DB_ID${householdEnvSuffix(household)}`),
  shoppingChecksDbId: (household: HouseholdId) =>
    requireEnv(`NOTION_SHOPPING_CHECKS_DB_ID${householdEnvSuffix(household)}`),
  geminiApiKey: () => requireEnv("GEMINI_API_KEY"),
};
