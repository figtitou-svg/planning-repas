import { validateNewIngredientName, type NewIngredientDraft } from "./importDraft";
import type { RecipeIngredient } from "./types";

export type CreatePendingResult =
  | { ok: true; rows: RecipeIngredient[]; pending: NewIngredientDraft[] }
  | { ok: false; rows: RecipeIngredient[]; pending: NewIngredientDraft[]; error: string };

// Creates the unknown ingredients one at a time. Each created ingredient is
// turned into a normal row and removed from `pending` right away (reported
// through `onProgress`), so a retry after a partial failure only creates what
// is still pending and never a duplicate.
export async function createPendingIngredients({
  rows,
  pending,
  createFn,
  onProgress,
}: {
  rows: RecipeIngredient[];
  pending: NewIngredientDraft[];
  createFn: (draft: NewIngredientDraft) => Promise<{ id: string }>;
  onProgress?: (rows: RecipeIngredient[], pending: NewIngredientDraft[]) => void;
}): Promise<CreatePendingResult> {
  for (const item of pending) {
    const problem = validateNewIngredientName(item.name);
    if (problem) return { ok: false, rows, pending, error: problem };
  }

  let currentRows = rows;
  let remaining = pending;
  for (const item of pending) {
    let created: { id: string };
    try {
      created = await createFn(item);
    } catch {
      return {
        ok: false,
        rows: currentRows,
        pending: remaining,
        error: `Impossible d'ajouter « ${item.name.trim()} » au catalogue, réessayez`,
      };
    }
    currentRows = [...currentRows, { ingredientId: created.id, quantity: item.quantity }];
    remaining = remaining.filter((other) => other !== item);
    onProgress?.(currentRows, remaining);
  }
  return { ok: true, rows: currentRows, pending: remaining };
}
