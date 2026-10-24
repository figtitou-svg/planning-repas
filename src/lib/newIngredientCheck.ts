import { validateNewIngredientName, type NewIngredientDraft } from "./importDraft";
import { normalizeName } from "./matchIngredients";
import type { Ingredient } from "./types";

export type NewIngredientCheck =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "exists"; ingredient: Ingredient }
  | { kind: "pending" }
  | { kind: "ok"; name: string };

export function checkNewIngredientName(
  query: string,
  catalog: Ingredient[],
  pending: NewIngredientDraft[]
): NewIngredientCheck {
  const name = query.replace(/\s+/g, " ").trim();
  if (name === "") return { kind: "empty" };

  const problem = validateNewIngredientName(name);
  if (problem) return { kind: "invalid", message: problem };

  const key = normalizeName(name);
  const existing = catalog.find((ingredient) => normalizeName(ingredient.name) === key);
  if (existing) return { kind: "exists", ingredient: existing };
  if (pending.some((item) => normalizeName(item.name) === key)) return { kind: "pending" };

  return { kind: "ok", name };
}
