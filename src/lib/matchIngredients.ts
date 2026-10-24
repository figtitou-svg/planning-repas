import { normalizeText } from "./ingredientSearch";
import type { ParsedIngredient } from "./recipeParser";
import type { Ingredient, RecipeIngredient, Unit } from "./types";

export interface MatchedLine extends RecipeIngredient {
  unitMismatch?: true;
}

export interface CreatedLine {
  name: string;
  unit: Unit;
  quantity: number;
  unitMismatch?: true;
}

export interface MatchResult {
  matched: MatchedLine[];
  created: CreatedLine[];
}

const MIN_LENGTH_FOR_PLURAL = 4;

export function normalizeName(name: string): string {
  const base = normalizeText(name).replace(/\s+/g, " ");
  return base.length >= MIN_LENGTH_FOR_PLURAL && /[sx]$/.test(base) ? base.slice(0, -1) : base;
}

export function matchIngredients(parsed: ParsedIngredient[], catalog: Ingredient[]): MatchResult {
  const catalogByName = new Map<string, Ingredient>();
  for (const ingredient of catalog) {
    const key = normalizeName(ingredient.name);
    if (!catalogByName.has(key)) catalogByName.set(key, ingredient);
  }

  const matched = new Map<string, MatchedLine>();
  const created = new Map<string, CreatedLine>();

  for (const line of parsed) {
    const key = normalizeName(line.name);
    const known = catalogByName.get(key);

    if (known) {
      const existing = matched.get(known.id) ?? { ingredientId: known.id, quantity: 0 };
      existing.quantity += line.quantity;
      if (line.unit !== known.unit) existing.unitMismatch = true;
      matched.set(known.id, existing);
      continue;
    }

    const existing = created.get(key);
    if (!existing) {
      created.set(key, {
        name: line.name.replace(/\s+/g, " ").trim(),
        unit: line.unit,
        quantity: line.quantity,
      });
    } else if (existing.unit === line.unit) {
      existing.quantity += line.quantity;
    } else {
      existing.unitMismatch = true;
    }
  }

  return { matched: [...matched.values()], created: [...created.values()] };
}
