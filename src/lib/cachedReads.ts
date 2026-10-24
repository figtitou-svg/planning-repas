import type { Client } from "@notionhq/client";
import { cached, invalidate, type CacheOptions } from "./serverCache";
import { listIngredients } from "./repositories/ingredients";
import { listRecipes } from "./repositories/recipes";
import { listPantry } from "./repositories/pantry";
import { listPlannedMeals } from "./repositories/plannedMeals";
import { getCategoryOrder } from "./repositories/categoryOrder";
import { listChecks, listExtras } from "./repositories/shoppingChecks";
import type { HouseholdId } from "./households";

// Les données modifiées dans l'app sont invalidées à l'écriture ; ces durées ne servent
// qu'à rattraper les modifications faites directement dans Notion.
const CATALOG_TTL_MS = 60_000;
const SCHEMA_TTL_MS = 5 * 60_000;
const WEEK_TTL_MS = 30_000;

export const cachedReads = {
  listIngredients: (client: Client, options?: CacheOptions) =>
    cached("ingredients", CATALOG_TTL_MS, () => listIngredients(client), options),
  listRecipes: (client: Client, options?: CacheOptions) =>
    cached("recipes", CATALOG_TTL_MS, () => listRecipes(client), options),
  // Stock, planning et courses sont propres à chaque foyer : la clé de cache porte le foyer.
  listPantry: (client: Client, household: HouseholdId, options?: CacheOptions) =>
    cached(`pantry:${household}`, CATALOG_TTL_MS, () => listPantry(client, household), options),
  getCategoryOrder: (client: Client, options?: CacheOptions) =>
    cached("categoryOrder", SCHEMA_TTL_MS, () => getCategoryOrder(client), options),
  listPlannedMeals: (client: Client, household: HouseholdId, weekStart: string, options?: CacheOptions) =>
    cached(`meals:${household}:${weekStart}`, WEEK_TTL_MS, () => listPlannedMeals(client, household, weekStart), options),
  listChecks: (client: Client, household: HouseholdId, weekStart: string, options?: CacheOptions) =>
    cached(`checks:${household}:${weekStart}`, WEEK_TTL_MS, () => listChecks(client, household, weekStart), options),
  listExtras: (client: Client, household: HouseholdId, weekStart: string, options?: CacheOptions) =>
    cached(`extras:${household}:${weekStart}`, WEEK_TTL_MS, () => listExtras(client, household, weekStart), options),
};

export const invalidateIngredients = () => {
  invalidate("ingredients");
  invalidate("categoryOrder");
};
export const invalidateRecipes = () => invalidate("recipes");
export const invalidatePantry = (household: HouseholdId) => invalidate(`pantry:${household}`);
export const invalidatePlan = (household: HouseholdId) => invalidate(`meals:${household}`);
export const invalidateChecks = (household: HouseholdId, weekStart: string) =>
  invalidate(`checks:${household}:${weekStart}`);
export const invalidateExtras = (household: HouseholdId, weekStart: string) =>
  invalidate(`extras:${household}:${weekStart}`);

/** `?fresh=1` force une relecture de Notion (avant une édition, ou à l'ouverture d'une page d'alertes). */
export function wantsFresh(request: Request): CacheOptions {
  return { fresh: new URL(request.url).searchParams.get("fresh") === "1" };
}
