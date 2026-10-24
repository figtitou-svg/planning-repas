import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Ingredient } from "@/lib/types";

const addExtra = vi.fn();
const setExtraQuantity = vi.fn();
const createIngredient = vi.fn();
const listIngredients = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/ingredients", () => ({
  createIngredient: (...args: unknown[]) => createIngredient(...args),
}));
vi.mock("@/lib/repositories/shoppingChecks", () => ({
  addExtra: (...args: unknown[]) => addExtra(...args),
  removeExtra: vi.fn(),
  setExtraQuantity: (...args: unknown[]) => setExtraQuantity(...args),
  isMissingExtraProperty: (error: any) => /Ajouté/.test(error?.message ?? ""),
  isMissingQuantityProperty: (error: any) => /Quantité/.test(error?.message ?? ""),
}));
vi.mock("@/lib/cachedReads", () => ({
  cachedReads: { listIngredients: (...args: unknown[]) => listIngredients(...args) },
  invalidateChecks: vi.fn(),
  invalidateExtras: vi.fn(),
  invalidateIngredients: vi.fn(),
}));

import { PATCH, POST } from "./route";

const flour: Ingredient = {
  id: "ing-flour",
  name: "Farine",
  unit: "g",
  packageSize: 1000,
  packagePrice: 1.5,
  shelfLifeDays: 365,
  category: "Épicerie",
};

function post(body: unknown) {
  return POST(new Request("http://localhost/api/shopping-extras", { method: "POST", body: JSON.stringify(body) }));
}

function patch(body: unknown) {
  return PATCH(new Request("http://localhost/api/shopping-extras", { method: "PATCH", body: JSON.stringify(body) }));
}

describe("PATCH /api/shopping-extras", () => {
  beforeEach(() => {
    setExtraQuantity.mockReset().mockResolvedValue(true);
  });

  it("replaces the typed quantity", async () => {
    const response = await patch({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 200 });

    expect(response.status).toBe(204);
    expect(setExtraQuantity).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-flour", 200);
  });

  it("clears the quantity with null", async () => {
    const response = await patch({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: null });

    expect(response.status).toBe(204);
    expect(setExtraQuantity).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-flour", null);
  });

  it("rejects a missing week, a missing item or a quantity that is not a positive number", async () => {
    for (const body of [
      { ingredientId: "ing-flour", quantity: 2 },
      { weekStart: "2026-09-14", quantity: 2 },
      { weekStart: "2026-09-14", ingredientId: "ing-flour" },
      { weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 0 },
      { weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: -1 },
      { weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: "2" },
    ]) {
      const response = await patch(body);
      expect(response.status).toBe(400);
    }
    expect(setExtraQuantity).not.toHaveBeenCalled();
  });

  it("answers 404 when the item is not an extra of that week", async () => {
    setExtraQuantity.mockResolvedValue(false);

    const response = await patch({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 2 });

    expect(response.status).toBe(404);
  });

  it("answers 503 with a hint when the « Quantité » property is not in Notion yet", async () => {
    setExtraQuantity.mockRejectedValue({ code: "validation_error", message: "Quantité is not a property" });

    const response = await patch({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 2 });

    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/setup:extras/);
  });
});

describe("POST /api/shopping-extras", () => {
  beforeEach(() => {
    addExtra.mockReset().mockResolvedValue(undefined);
    createIngredient.mockReset().mockImplementation(async (_client, draft) => ({
      id: "ing-new",
      shelfLifeDays: 0,
      ...draft,
    }));
    listIngredients.mockReset().mockResolvedValue([flour]);
  });

  it("écrit dans le foyer du cookie (household-2)", async () => {
    const response = await POST(
      new Request("http://localhost/api/shopping-extras", {
        method: "POST",
        headers: { cookie: "household=household-2" },
        body: JSON.stringify({ weekStart: "2026-09-14", ingredientId: "ing-flour" }),
      })
    );

    expect(response.status).toBe(201);
    expect(addExtra).toHaveBeenCalledWith({}, "household-2", "2026-09-14", "ing-flour", undefined);
  });

  it("keeps the old behaviour without a quantity", async () => {
    const response = await post({ weekStart: "2026-09-14", ingredientId: "ing-flour" });

    expect(response.status).toBe(201);
    expect(addExtra).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-flour", undefined);
    expect(await response.json()).toMatchObject({ ingredientId: "ing-flour", quantity: null, created: false });
  });

  it("stores the typed quantity for an existing ingredient in the same unit", async () => {
    const response = await post({ weekStart: "2026-09-14", name: "farine", quantity: 500, unit: "g" });

    expect(response.status).toBe(201);
    expect(addExtra).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-flour", 500);
    expect(await response.json()).toMatchObject({ quantity: 500, unit: "g", created: false });
  });

  it("creates an unknown ingredient with the detected unit and keeps the quantity", async () => {
    const response = await post({ weekStart: "2026-09-14", name: "Lait d'avoine", quantity: 1500, unit: "mL" });

    expect(response.status).toBe(201);
    expect(createIngredient).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ name: "Lait d'avoine", unit: "mL", packageSize: 0, packagePrice: 0 })
    );
    expect(addExtra).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-new", 1500);
    expect(await response.json()).toMatchObject({ created: true, quantity: 1500, unit: "mL" });
  });

  it("creates an unknown ingredient in pieces when no quantity is typed", async () => {
    await post({ weekStart: "2026-09-14", name: "Sriracha" });

    expect(createIngredient).toHaveBeenCalledWith({}, expect.objectContaining({ unit: "pièce" }));
    expect(addExtra).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-new", undefined);
  });

  it("does not guess when the typed unit differs from the ingredient's", async () => {
    const response = await post({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 3, unit: "pièce" });

    expect(response.status).toBe(201);
    expect(addExtra).toHaveBeenCalledWith({}, "household-1", "2026-09-14", "ing-flour", undefined);
    expect(await response.json()).toMatchObject({ quantity: null, quantityIgnored: "unit" });
  });

  it("still adds the item when the « Quantité » property is not in Notion yet", async () => {
    addExtra.mockRejectedValueOnce({ code: "validation_error", message: "Quantité is not a property" });

    const response = await post({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 500, unit: "g" });

    expect(response.status).toBe(201);
    expect(addExtra).toHaveBeenLastCalledWith({}, "household-1", "2026-09-14", "ing-flour", undefined);
    expect(await response.json()).toMatchObject({ quantity: null, quantityIgnored: "setup" });
  });

  it("rejects a quantity that is not a positive number", async () => {
    for (const quantity of [0, -2, "beaucoup", null]) {
      addExtra.mockClear();
      const response = await post({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity, unit: "g" });
      if (quantity === null) {
        expect(response.status).toBe(201);
      } else {
        expect(response.status).toBe(400);
        expect(addExtra).not.toHaveBeenCalled();
      }
    }
  });

  it("rejects an unknown unit", async () => {
    const response = await post({ weekStart: "2026-09-14", ingredientId: "ing-flour", quantity: 2, unit: "tonne" });

    expect(response.status).toBe(400);
  });
});
