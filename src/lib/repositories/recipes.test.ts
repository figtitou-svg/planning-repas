import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "@notionhq/client";
import { listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe } from "./recipes";

vi.mock("../notionConfig", () => ({
  notionConfig: {
    recipesDbId: () => "db-recipes",
    recipeIngredientsDbId: () => "db-recipe-ingredients",
  },
}));

function recipePage(
  id: string,
  name: string,
  portions: number | null = 2,
  favorite?: boolean
) {
  return {
    id,
    properties: {
      Nom: { title: [{ plain_text: name }] },
      Portions: { number: portions },
      // Sans la colonne « Favori » dans Notion, la propriété est simplement absente.
      ...(favorite === undefined ? {} : { Favori: { checkbox: favorite } }),
    },
  };
}

function junctionPage(id: string, recipeId: string, ingredientId: string, quantity: number) {
  return {
    id,
    properties: {
      Recipe: { relation: [{ id: recipeId }] },
      Ingredient: { relation: [{ id: ingredientId }] },
      Quantité: { number: quantity },
    },
  };
}

function fakeClient(): Client {
  return {
    databases: { query: vi.fn() },
    pages: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn() },
  } as unknown as Client;
}

describe("recipes repository", () => {
  let client: Client;

  beforeEach(() => {
    client = fakeClient();
  });

  it("lists recipes joined with their ingredients", async () => {
    (client.databases.query as any).mockImplementation(({ database_id }: any) => {
      if (database_id === "db-recipes") {
        return Promise.resolve({
          results: [recipePage("recipe-1", "Crêpes")],
          has_more: false,
          next_cursor: null,
        });
      }
      return Promise.resolve({
        results: [junctionPage("j-1", "recipe-1", "ing-flour", 500)],
        has_more: false,
        next_cursor: null,
      });
    });

    const result = await listRecipes(client);

    expect(result).toEqual([
      {
        id: "recipe-1",
        name: "Crêpes",
        portions: 2,
        favorite: false,
        ingredients: [{ ingredientId: "ing-flour", quantity: 500 }],
      },
    ]);
  });

  it("lists the favorite flag from the Favori checkbox", async () => {
    (client.databases.query as any).mockImplementation(({ database_id }: any) => {
      if (database_id === "db-recipes") {
        return Promise.resolve({
          results: [
            recipePage("recipe-1", "Crêpes", 2, true),
            recipePage("recipe-2", "Quiche", 6, false),
            recipePage("recipe-3", "Salade", 2),
          ],
          has_more: false,
          next_cursor: null,
        });
      }
      return Promise.resolve({ results: [], has_more: false, next_cursor: null });
    });

    const result = await listRecipes(client);

    expect(result.map((r) => r.favorite)).toEqual([true, false, false]);
  });

  it("lists the Notion portions value and defaults to 2 when null", async () => {
    (client.databases.query as any).mockImplementation(({ database_id }: any) => {
      if (database_id === "db-recipes") {
        return Promise.resolve({
          results: [recipePage("recipe-1", "Gratin", 6), recipePage("recipe-2", "Salade", null)],
          has_more: false,
          next_cursor: null,
        });
      }
      return Promise.resolve({ results: [], has_more: false, next_cursor: null });
    });

    const result = await listRecipes(client);

    expect(result.map((r) => r.portions)).toEqual([6, 2]);
  });

  it("returns null from getRecipe for a missing id", async () => {
    (client.pages.retrieve as any).mockRejectedValue(new Error("not found"));

    const result = await getRecipe(client, "missing");

    expect(result).toBeNull();
  });

  it("getRecipe returns the recipe with its ingredients", async () => {
    (client.pages.retrieve as any).mockResolvedValue(recipePage("recipe-1", "Crêpes"));
    (client.databases.query as any).mockResolvedValue({
      results: [junctionPage("j-1", "recipe-1", "ing-flour", 500)],
      has_more: false,
      next_cursor: null,
    });

    const result = await getRecipe(client, "recipe-1");

    expect(result).toEqual({
      id: "recipe-1",
      name: "Crêpes",
      portions: 2,
      favorite: false,
      ingredients: [{ ingredientId: "ing-flour", quantity: 500 }],
    });
  });

  it("creates a recipe page then one junction row per ingredient", async () => {
    (client.pages.create as any).mockImplementation(({ parent }: any) => {
      if (parent.database_id === "db-recipes") {
        return Promise.resolve(recipePage("new-recipe", "Crêpes"));
      }
      return Promise.resolve(junctionPage("new-j", "new-recipe", "ing-flour", 500));
    });

    const result = await createRecipe(client, {
      name: "Crêpes",
      portions: 4,
      ingredients: [{ ingredientId: "ing-flour", quantity: 500 }],
    });

    expect(result.id).toBe("new-recipe");
    expect(result.portions).toBe(4);
    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-recipes" },
      properties: {
        Nom: { title: [{ text: { content: "Crêpes" } }] },
        Portions: { number: 4 },
      },
    });
    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-recipe-ingredients" },
      properties: {
        Recipe: { relation: [{ id: "new-recipe" }] },
        Ingredient: { relation: [{ id: "ing-flour" }] },
        Quantité: { number: 500 },
      },
    });
  });

  it("updateRecipe with ingredients archives old junction rows and creates new ones", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [junctionPage("old-j", "recipe-1", "ing-flour", 500)],
      has_more: false,
      next_cursor: null,
    });
    (client.pages.create as any).mockResolvedValue(
      junctionPage("new-j", "recipe-1", "ing-milk", 200)
    );

    await updateRecipe(client, "recipe-1", {
      ingredients: [{ ingredientId: "ing-milk", quantity: 200 }],
    });

    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "old-j", archived: true });
    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-recipe-ingredients" },
      properties: {
        Recipe: { relation: [{ id: "recipe-1" }] },
        Ingredient: { relation: [{ id: "ing-milk" }] },
        Quantité: { number: 200 },
      },
    });
  });

  it("updateRecipe leaves unchanged ingredients alone and only updates changed quantities", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [
        junctionPage("j-flour", "recipe-1", "ing-flour", 500),
        junctionPage("j-milk", "recipe-1", "ing-milk", 200),
        junctionPage("j-egg", "recipe-1", "ing-egg", 3),
      ],
      has_more: false,
      next_cursor: null,
    });

    await updateRecipe(client, "recipe-1", {
      ingredients: [
        { ingredientId: "ing-flour", quantity: 500 },
        { ingredientId: "ing-milk", quantity: 250 },
        { ingredientId: "ing-egg", quantity: 3 },
      ],
    });

    expect(client.pages.create).not.toHaveBeenCalled();
    expect(client.pages.update).toHaveBeenCalledTimes(1);
    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "j-milk",
      properties: { Quantité: { number: 250 } },
    });
  });

  it("updateRecipe archives duplicate rows for the same ingredient", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [
        junctionPage("j-1", "recipe-1", "ing-flour", 500),
        junctionPage("j-2", "recipe-1", "ing-flour", 500),
      ],
      has_more: false,
      next_cursor: null,
    });

    await updateRecipe(client, "recipe-1", {
      ingredients: [{ ingredientId: "ing-flour", quantity: 500 }],
    });

    expect(client.pages.create).not.toHaveBeenCalled();
    expect(client.pages.update).toHaveBeenCalledTimes(1);
    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "j-2", archived: true });
  });

  it("updateRecipe without ingredients does not touch junction rows", async () => {
    await updateRecipe(client, "recipe-1", { name: "Crêpes salées" });

    expect(client.databases.query).not.toHaveBeenCalled();
    expect(client.pages.create).not.toHaveBeenCalled();
    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "recipe-1",
      properties: { Nom: { title: [{ text: { content: "Crêpes salées" } }] } },
    });
  });

  it("updateRecipe with favorite only toggles the Favori checkbox", async () => {
    await updateRecipe(client, "recipe-1", { favorite: true });

    expect(client.databases.query).not.toHaveBeenCalled();
    expect(client.pages.create).not.toHaveBeenCalled();
    expect(client.pages.update).toHaveBeenCalledTimes(1);
    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "recipe-1",
      properties: { Favori: { checkbox: true } },
    });
  });

  it("updateRecipe with portions updates the Portions property", async () => {
    await updateRecipe(client, "recipe-1", { portions: 3 });

    expect(client.databases.query).not.toHaveBeenCalled();
    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "recipe-1",
      properties: { Portions: { number: 3 } },
    });
  });

  it("deleteRecipe archives the recipe and its junction rows", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [junctionPage("j-1", "recipe-1", "ing-flour", 500)],
      has_more: false,
      next_cursor: null,
    });

    await deleteRecipe(client, "recipe-1");

    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "j-1", archived: true });
    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "recipe-1", archived: true });
  });
});
