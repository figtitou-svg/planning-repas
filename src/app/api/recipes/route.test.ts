import { describe, it, expect, vi, beforeEach } from "vitest";

const createRecipe = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/recipes", () => ({
  listRecipes: vi.fn(),
  createRecipe: (...args: unknown[]) => createRecipe(...args),
}));

import { POST } from "./route";

function post(body: unknown, raw = false) {
  return POST(
    new Request("http://localhost/api/recipes", {
      method: "POST",
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
}

describe("POST /api/recipes", () => {
  beforeEach(() => {
    createRecipe.mockReset();
    createRecipe.mockImplementation(async (_client, data) => ({ id: "r1", ...data }));
  });

  it("defaults portions to 2 when absent", async () => {
    const response = await post({ name: "Crêpes", ingredients: [] });

    expect(response.status).toBe(201);
    expect(createRecipe).toHaveBeenCalledWith({}, { name: "Crêpes", ingredients: [], portions: 2 });
  });

  it("rounds portions to an integer", async () => {
    await post({ name: "Crêpes", portions: 3.4, ingredients: [] });

    expect(createRecipe.mock.calls[0][1].portions).toBe(3);
  });

  it.each([[0], [-1], ["4"], [null], [NaN]])("rejects portions %j", async (portions) => {
    expect((await post({ name: "Crêpes", portions, ingredients: [] })).status).toBe(400);
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    expect((await post("{nope", true)).status).toBe(400);
  });

  it("passes valid steps to the repository", async () => {
    const response = await post({ name: "Crêpes", ingredients: [], steps: ["Mélanger", "Cuire"] });

    expect(response.status).toBe(201);
    expect(createRecipe.mock.calls[0][1].steps).toEqual(["Mélanger", "Cuire"]);
  });

  it("passes a known category and rejects an unknown one", async () => {
    expect((await post({ name: "Tarte", ingredients: [], category: "Dessert" })).status).toBe(201);
    expect(createRecipe.mock.calls[0][1].category).toBe("Dessert");

    createRecipe.mockClear();
    expect((await post({ name: "Tarte", ingredients: [], category: "Pizza" })).status).toBe(400);
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it.each([["texte"], [[1, 2]], [null]])("rejects steps %j", async (steps) => {
    const response = await post({ name: "Crêpes", ingredients: [], steps });

    expect(response.status).toBe(400);
    expect(createRecipe).not.toHaveBeenCalled();
  });
});
