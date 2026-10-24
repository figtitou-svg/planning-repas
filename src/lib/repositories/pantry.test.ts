import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "@notionhq/client";
import { listPantry, addPantryItem, updatePantryQuantity, removePantryItem } from "./pantry";

vi.mock("../notionConfig", () => ({
  notionConfig: { pantryDbId: (household: string) => (household === "household-2" ? "db-pantry-2" : "db-pantry") },
}));

function pantryPage(id: string, ingredientId: string, quantity: number, purchaseDate: string) {
  return {
    id,
    properties: {
      Ingredient: { relation: [{ id: ingredientId }] },
      Quantité: { number: quantity },
      "Date d'achat": { date: { start: purchaseDate } },
    },
  };
}

function fakeClient(): Client {
  return {
    databases: { query: vi.fn() },
    pages: { create: vi.fn(), update: vi.fn() },
  } as unknown as Client;
}

describe("pantry repository", () => {
  let client: Client;

  beforeEach(() => {
    client = fakeClient();
  });

  it("lists pantry items", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [pantryPage("p-1", "ing-flour", 800, "2026-09-01")],
      has_more: false,
      next_cursor: null,
    });

    const result = await listPantry(client, "household-1");

    expect(result).toEqual([
      { id: "p-1", ingredientId: "ing-flour", quantity: 800, purchaseDate: "2026-09-01" },
    ]);
  });

  it("interroge la base du foyer 2", async () => {
    (client.databases.query as any).mockResolvedValue({ results: [], has_more: false, next_cursor: null });

    await listPantry(client, "household-2");

    expect(client.databases.query).toHaveBeenCalledWith(expect.objectContaining({ database_id: "db-pantry-2" }));
  });

  it("adds a pantry item with the given purchase date", async () => {
    (client.pages.create as any).mockResolvedValue(
      pantryPage("new-p", "ing-flour", 1000, "2026-09-16")
    );

    const result = await addPantryItem(client, "household-1", {
      ingredientId: "ing-flour",
      quantity: 1000,
      purchaseDate: "2026-09-16",
    });

    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-pantry" },
      properties: {
        Ingredient: { relation: [{ id: "ing-flour" }] },
        Quantité: { number: 1000 },
        "Date d'achat": { date: { start: "2026-09-16" } },
      },
    });
    expect(result.id).toBe("new-p");
  });

  it("updates only the quantity", async () => {
    (client.pages.update as any).mockResolvedValue(
      pantryPage("p-1", "ing-flour", 300, "2026-09-01")
    );

    await updatePantryQuantity(client, "p-1", 300);

    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "p-1",
      properties: { Quantité: { number: 300 } },
    });
  });

  it("archives the page on removal", async () => {
    (client.pages.update as any).mockResolvedValue(
      pantryPage("p-1", "ing-flour", 300, "2026-09-01")
    );

    await removePantryItem(client, "p-1");

    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "p-1", archived: true });
  });
});
