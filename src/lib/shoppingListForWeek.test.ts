import { describe, it, expect, vi } from "vitest";
import type { Client } from "@notionhq/client";
import { buildShoppingListForWeek } from "./shoppingListForWeek";

vi.mock("./repositories/ingredients", () => ({
  listIngredients: vi.fn().mockResolvedValue([
    {
      id: "ing-flour",
      name: "Farine",
      unit: "g",
      packageSize: 1000,
      packagePrice: 1.5,
      shelfLifeDays: 365,
      category: "Épicerie",
    },
  ]),
}));
vi.mock("./repositories/recipes", () => ({
  listRecipes: vi.fn().mockResolvedValue([
    { id: "recipe-1", name: "Crêpes", portions: 2, ingredients: [{ ingredientId: "ing-flour", quantity: 500 }] },
    { id: "recipe-2", name: "Gâteau", portions: 2, ingredients: [{ ingredientId: "ing-flour", quantity: 400 }] },
  ]),
}));
vi.mock("./repositories/pantry", () => ({ listPantry: vi.fn().mockResolvedValue([]) }));
vi.mock("./repositories/categoryOrder", () => ({
  getCategoryOrder: vi.fn().mockResolvedValue(["Épicerie"]),
}));
vi.mock("./repositories/plannedMeals", () => ({ listPlannedMeals: vi.fn() }));
vi.mock("./repositories/shoppingChecks", () => ({ listExtras: vi.fn().mockResolvedValue([]) }));

import { listPlannedMeals } from "./repositories/plannedMeals";
import { listExtras } from "./repositories/shoppingChecks";

function fakeClient(): Client {
  return {} as Client;
}

function meal(id: string, recipeId: string, portions: number) {
  return { id, weekStart: "2026-09-14", recipeId, portions };
}

describe("buildShoppingListForWeek", () => {
  it("only includes recipes that are planned for the week", async () => {
    (listPlannedMeals as any).mockResolvedValue([meal("meal-1", "recipe-1", 2)]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-14");

    expect(result.totalCost).toBe(1.5);
    expect(result.groups[0].lines[0].missingQuantity).toBe(500);
  });

  it("scales quantities to the planned portions", async () => {
    (listPlannedMeals as any).mockResolvedValue([meal("meal-1", "recipe-1", 4)]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-14");

    expect(result.groups[0].lines[0].missingQuantity).toBe(1000);
  });

  it("counts a recipe planned twice twice", async () => {
    (listPlannedMeals as any).mockResolvedValue([
      meal("meal-1", "recipe-1", 2),
      meal("meal-2", "recipe-1", 2),
    ]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-14");

    expect(result.groups[0].lines[0].missingQuantity).toBe(1000);
  });

  it("ignores planned meals whose recipe no longer exists", async () => {
    (listPlannedMeals as any).mockResolvedValue([
      meal("meal-1", "recipe-1", 2),
      meal("meal-2", "recipe-deleted", 2),
    ]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-14");

    expect(result.groups[0].lines[0].missingQuantity).toBe(500);
  });

  it("returns an empty shopping list when nothing is planned for the week", async () => {
    (listPlannedMeals as any).mockResolvedValue([]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-21");

    expect(result).toEqual({ groups: [], totalCost: 0 });
  });

  it("adds the items typed in by hand for that week", async () => {
    (listPlannedMeals as any).mockResolvedValue([]);
    (listExtras as any).mockResolvedValueOnce([{ ingredientId: "ing-flour", quantity: null }]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-21");

    expect(listExtras).toHaveBeenCalledWith(expect.anything(), "household-1", "2026-09-21");
    expect(result.groups[0].lines[0]).toMatchObject({ ingredientId: "ing-flour", manual: true });
  });

  it("buys the quantity typed in by hand", async () => {
    (listPlannedMeals as any).mockResolvedValue([]);
    (listExtras as any).mockResolvedValueOnce([{ ingredientId: "ing-flour", quantity: 2500 }]);

    const result = await buildShoppingListForWeek(fakeClient(), "household-1", "2026-09-21");

    expect(result.groups[0].lines[0]).toMatchObject({ ingredientId: "ing-flour", missingQuantity: 2500 });
  });
});
