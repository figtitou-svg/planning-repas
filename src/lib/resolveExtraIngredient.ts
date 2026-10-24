import { checkNewIngredientName } from "./newIngredientCheck";
import type { Ingredient } from "./types";

export type ResolvedExtra =
  | { ok: true; ingredient: Ingredient; created: boolean }
  | { ok: false; error: string };

// Retrouve l'ingrédient tapé à la main dans le catalogue, ou le crée s'il n'y est pas :
// il arrive alors sans taille ni prix de paquet, à compléter dans Notion.
export async function resolveExtraIngredient(
  name: string,
  catalog: Ingredient[],
  create: (name: string) => Promise<Ingredient>
): Promise<ResolvedExtra> {
  const check = checkNewIngredientName(name, catalog, []);
  if (check.kind === "empty") return { ok: false, error: "Tapez le nom d'un article" };
  if (check.kind === "invalid") return { ok: false, error: check.message };
  if (check.kind === "exists") return { ok: true, ingredient: check.ingredient, created: false };
  // « pending » n'existe pas ici (aucun brouillon en attente) : seul « ok » reste.
  if (check.kind !== "ok") return { ok: false, error: "Nom d'article invalide" };
  return { ok: true, ingredient: await create(check.name), created: true };
}
