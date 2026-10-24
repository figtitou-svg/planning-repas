import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./repositories/pantry", () => ({
  listPantry: vi.fn(async (_c: unknown, household: string) => [{ id: household }]),
}));
vi.mock("./repositories/plannedMeals", () => ({ listPlannedMeals: vi.fn(async () => []) }));
vi.mock("./repositories/shoppingChecks", () => ({
  listChecks: vi.fn(async () => ({})),
  listExtras: vi.fn(async () => []),
}));
vi.mock("./repositories/ingredients", () => ({ listIngredients: vi.fn() }));
vi.mock("./repositories/recipes", () => ({ listRecipes: vi.fn() }));
vi.mock("./repositories/categoryOrder", () => ({ getCategoryOrder: vi.fn() }));

import { cachedReads, invalidatePantry } from "./cachedReads";
import { listPantry } from "./repositories/pantry";
import { resetServerCache } from "./serverCache";

const client = {} as any;

describe("cachedReads par foyer", () => {
  beforeEach(() => {
    resetServerCache();
    vi.mocked(listPantry).mockClear();
  });

  it("ne mélange pas le stock des deux foyers", async () => {
    const a = await cachedReads.listPantry(client, "household-1");
    const b = await cachedReads.listPantry(client, "household-2");
    expect(a).toEqual([{ id: "household-1" }]);
    expect(b).toEqual([{ id: "household-2" }]);
  });

  it("invalider un foyer laisse le cache de l'autre", async () => {
    await cachedReads.listPantry(client, "household-1");
    await cachedReads.listPantry(client, "household-2");
    vi.mocked(listPantry).mockClear();
    invalidatePantry("household-1");
    await cachedReads.listPantry(client, "household-2");
    expect(listPantry).not.toHaveBeenCalled();
    await cachedReads.listPantry(client, "household-1");
    expect(listPantry).toHaveBeenCalledTimes(1);
  });
});
