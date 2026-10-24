import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "@notionhq/client";
import {
  listIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "./ingredients";

vi.mock("../notionConfig", () => ({
  notionConfig: { ingredientsDbId: () => "db-ingredients" },
}));

function fakePage(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    properties: {
      Nom: { title: [{ plain_text: "Farine" }] },
      Unité: { select: { name: "g" } },
      "Taille du paquet": { number: 1000 },
      "Prix du paquet": { number: 1.5 },
      "Durée de conservation": { number: 365 },
      Catégorie: { select: { name: "Épicerie" } },
      ...overrides,
    },
  };
}

function fakeClient(overrides: Partial<Client> = {}): Client {
  return {
    databases: { query: vi.fn() },
    pages: { create: vi.fn(), update: vi.fn() },
    ...overrides,
  } as unknown as Client;
}

describe("ingredients repository", () => {
  let client: Client;

  beforeEach(() => {
    client = fakeClient();
  });

  it("lists ingredients, mapping every Notion property", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [fakePage("page-1")],
      has_more: false,
      next_cursor: null,
    });

    const result = await listIngredients(client);

    expect(client.databases.query).toHaveBeenCalledWith(
      expect.objectContaining({ database_id: "db-ingredients" })
    );
    expect(result).toEqual([
      {
        id: "page-1",
        name: "Farine",
        unit: "g",
        packageSize: 1000,
        packagePrice: 1.5,
        shelfLifeDays: 365,
        category: "Épicerie",
      },
    ]);
  });

  it("paginates through has_more", async () => {
    (client.databases.query as any)
      .mockResolvedValueOnce({
        results: [fakePage("page-1")],
        has_more: true,
        next_cursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        results: [fakePage("page-2")],
        has_more: false,
        next_cursor: null,
      });

    const result = await listIngredients(client);

    expect(result).toHaveLength(2);
    expect((client.databases.query as any).mock.calls[1][0]).toMatchObject({
      start_cursor: "cursor-1",
    });
  });

  it("creates an ingredient with the correct Notion payload", async () => {
    (client.pages.create as any).mockResolvedValue(fakePage("new-page"));

    const result = await createIngredient(client, {
      name: "Farine",
      unit: "g",
      packageSize: 1000,
      packagePrice: 1.5,
      shelfLifeDays: 365,
      category: "Épicerie",
    });

    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-ingredients" },
      properties: {
        Nom: { title: [{ text: { content: "Farine" } }] },
        Unité: { select: { name: "g" } },
        "Taille du paquet": { number: 1000 },
        "Prix du paquet": { number: 1.5 },
        "Durée de conservation": { number: 365 },
        Catégorie: { select: { name: "Épicerie" } },
      },
    });
    expect(result.id).toBe("new-page");
  });

  it("sends empty numbers for package size, price and shelf life when values are <= 0", async () => {
    (client.pages.create as any).mockResolvedValue(fakePage("new-page"));

    await createIngredient(client, {
      name: "Sumac",
      unit: "g",
      packageSize: 0,
      packagePrice: 0,
      shelfLifeDays: 0,
      category: "Épicerie",
    });

    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-ingredients" },
      properties: {
        Nom: { title: [{ text: { content: "Sumac" } }] },
        Unité: { select: { name: "g" } },
        "Taille du paquet": { number: null },
        "Prix du paquet": { number: null },
        "Durée de conservation": { number: null },
        Catégorie: { select: { name: "Épicerie" } },
      },
    });
  });

  it("only sends provided properties on update", async () => {
    (client.pages.update as any).mockResolvedValue(fakePage("page-1"));

    await updateIngredient(client, "page-1", { packagePrice: 1.75 });

    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { "Prix du paquet": { number: 1.75 } },
    });
  });

  it("archives the page on delete", async () => {
    (client.pages.update as any).mockResolvedValue(fakePage("page-1"));

    await deleteIngredient(client, "page-1");

    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "page-1",
      archived: true,
    });
  });
});
