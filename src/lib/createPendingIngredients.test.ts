import { describe, expect, it, vi } from "vitest";
import { createPendingIngredients } from "./createPendingIngredients";
import type { NewIngredientDraft } from "./importDraft";

const basil: NewIngredientDraft = { name: "Basilic", unit: "g", quantity: 5 };
const cream: NewIngredientDraft = { name: "Crème", unit: "mL", quantity: 200 };
const chives: NewIngredientDraft = { name: "Ciboulette", unit: "g", quantity: 3 };

function createFn() {
  let next = 1;
  return vi.fn(async (_draft: NewIngredientDraft) => ({ id: `new${next++}` }));
}

describe("createPendingIngredients", () => {
  it("creates every pending ingredient and adds it as a row with the user quantity", async () => {
    const create = createFn();
    const onProgress = vi.fn();

    const result = await createPendingIngredients({
      rows: [{ ingredientId: "i1", quantity: 100 }],
      pending: [basil, { ...cream, quantity: 250 }],
      createFn: create,
      onProgress,
    });

    expect(result).toEqual({
      ok: true,
      rows: [
        { ingredientId: "i1", quantity: 100 },
        { ingredientId: "new1", quantity: 5 },
        { ingredientId: "new2", quantity: 250 },
      ],
      pending: [],
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(result.rows, []);
  });

  it("stops at the first failure, keeps created items as rows and the rest pending", async () => {
    const create = vi
      .fn<[NewIngredientDraft], Promise<{ id: string }>>()
      .mockResolvedValueOnce({ id: "new1" })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await createPendingIngredients({
      rows: [],
      pending: [basil, cream, chives],
      createFn: create,
    });

    expect(result).toEqual({
      ok: false,
      rows: [{ ingredientId: "new1", quantity: 5 }],
      pending: [cream, chives],
      error: "Impossible d'ajouter « Crème » au catalogue, réessayez",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries only the remaining ingredients after a partial failure", async () => {
    const failing = vi
      .fn<[NewIngredientDraft], Promise<{ id: string }>>()
      .mockResolvedValueOnce({ id: "new1" })
      .mockRejectedValueOnce(new Error("boom"));
    const first = await createPendingIngredients({
      rows: [],
      pending: [basil, cream, chives],
      createFn: failing,
    });

    const retry = createFn();
    const second = await createPendingIngredients({
      rows: first.rows,
      pending: first.pending,
      createFn: retry,
    });

    expect(retry.mock.calls.map(([draft]) => draft.name)).toEqual(["Crème", "Ciboulette"]);
    expect(second).toEqual({
      ok: true,
      rows: [
        { ingredientId: "new1", quantity: 5 },
        { ingredientId: "new1", quantity: 200 },
        { ingredientId: "new2", quantity: 3 },
      ],
      pending: [],
    });
  });

  it("blocks on an invalid name before creating anything", async () => {
    const create = createFn();

    const result = await createPendingIngredients({
      rows: [],
      pending: [basil, { ...cream, name: "   " }],
      createFn: create,
    });

    expect(result.ok).toBe(false);
    expect(result.pending).toHaveLength(2);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the rows untouched when nothing is pending", async () => {
    const create = createFn();
    const rows = [{ ingredientId: "i1", quantity: 1 }];

    const result = await createPendingIngredients({ rows, pending: [], createFn: create });

    expect(result).toEqual({ ok: true, rows, pending: [] });
    expect(create).not.toHaveBeenCalled();
  });
});
