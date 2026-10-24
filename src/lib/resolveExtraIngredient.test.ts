import { describe, it, expect, vi } from "vitest";
import { resolveExtraIngredient } from "./resolveExtraIngredient";
import type { Ingredient } from "./types";

const milk: Ingredient = {
  id: "ing-milk",
  name: "Lait",
  unit: "mL",
  packageSize: 1000,
  packagePrice: 1.1,
  shelfLifeDays: 7,
  category: "Produits laitiers",
};

function creator() {
  return vi.fn(async (name: string): Promise<Ingredient> => ({
    id: "ing-new",
    name,
    unit: "pièce",
    packageSize: 0,
    packagePrice: 0,
    shelfLifeDays: 0,
    category: "Autre",
  }));
}

describe("resolveExtraIngredient", () => {
  it("reuses the catalogue ingredient, ignoring case, accents and plural", async () => {
    const create = creator();
    const result = await resolveExtraIngredient("  LAITS ", [milk], create);
    expect(result).toEqual({ ok: true, ingredient: milk, created: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates an ingredient that is not in the catalogue, with the cleaned-up name", async () => {
    const create = creator();
    const result = await resolveExtraIngredient("  Sauce   sriracha ", [milk], create);
    expect(create).toHaveBeenCalledWith("Sauce sriracha");
    expect(result).toMatchObject({ ok: true, created: true, ingredient: { id: "ing-new" } });
  });

  it("refuses an empty name without creating anything", async () => {
    const create = creator();
    const result = await resolveExtraIngredient("   ", [milk], create);
    expect(result).toEqual({ ok: false, error: "Tapez le nom d'un article" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a name that is too long", async () => {
    const create = creator();
    const result = await resolveExtraIngredient("x".repeat(81), [milk], create);
    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
