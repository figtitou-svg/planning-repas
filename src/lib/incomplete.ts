import type { Ingredient } from "./types";

export type MissingField = "packageSize" | "packagePrice" | "shelfLifeDays";

export function missingFields(ingredient: Ingredient): MissingField[] {
  const missing: MissingField[] = [];
  if (!(ingredient.packageSize > 0)) missing.push("packageSize");
  if (!(ingredient.packagePrice > 0)) missing.push("packagePrice");
  if (!(ingredient.shelfLifeDays > 0)) missing.push("shelfLifeDays");
  return missing;
}
