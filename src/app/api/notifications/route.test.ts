import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listIngredients = vi.fn();
const listPantry = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/ingredients", () => ({
  listIngredients: (...args: unknown[]) => listIngredients(...args),
}));
vi.mock("@/lib/repositories/pantry", () => ({
  listPantry: (...args: unknown[]) => listPantry(...args),
}));

import { GET } from "./route";
import { resetServerCache } from "@/lib/serverCache";

const milk = {
  id: "milk",
  name: "Lait",
  unit: "mL",
  packageSize: 1000,
  packagePrice: 1,
  shelfLifeDays: 5,
  category: "Frais",
};

function get(query = "") {
  return GET(new Request(`http://localhost/api/notifications${query}`));
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    resetServerCache();
    listIngredients.mockReset();
    listPantry.mockReset();
    listIngredients.mockResolvedValue([milk]);
    listPantry.mockResolvedValue([
      { id: "p1", ingredientId: "milk", quantity: 500, purchaseDate: "2026-09-14" },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads Notion once for repeated requests, and again with ?fresh=1", async () => {
    await get("?today=2026-09-19");
    await get("?today=2026-09-19");
    expect(listIngredients).toHaveBeenCalledTimes(1);
    expect(listPantry).toHaveBeenCalledTimes(1);

    await get("?today=2026-09-19&fresh=1");
    expect(listIngredients).toHaveBeenCalledTimes(2);
    expect(listPantry).toHaveBeenCalledTimes(2);
  });

  it("uses the today query parameter", async () => {
    const response = await get("?today=2026-09-19");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.expiring[0]).toMatchObject({ pantryId: "p1", daysLeft: 0 });
  });

  it.each(["?today=hier", "?today=2026-02-30", "?today=2026-9-19", ""])(
    "falls back to the server UTC date for %s",
    async (query) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
      const body = await (await get(query)).json();
      expect(body.expiring[0].daysLeft).toBe(-1);
    }
  );

  it("returns a generic 500 on failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    listIngredients.mockRejectedValue(new Error("secret notion detail"));
    const response = await get("?today=2026-09-19");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Erreur interne" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
    spy.mockRestore();
  });
});
