import { describe, it, expect, vi } from "vitest";
import type { Client } from "@notionhq/client";
import { getCategoryOrder } from "./categoryOrder";

vi.mock("../notionConfig", () => ({
  notionConfig: { ingredientsDbId: () => "db-ingredients" },
}));

function fakeClient(options: { name: string }[]): Client {
  return {
    databases: {
      retrieve: vi.fn().mockResolvedValue({
        properties: { Catégorie: { select: { options } } },
      }),
    },
  } as unknown as Client;
}

describe("getCategoryOrder", () => {
  it("returns select option names in Notion's configured order", async () => {
    const client = fakeClient([
      { name: "Fruits & Légumes" },
      { name: "Épicerie" },
      { name: "Produits laitiers" },
    ]);

    const result = await getCategoryOrder(client);

    expect(result).toEqual(["Fruits & Légumes", "Épicerie", "Produits laitiers"]);
    expect(client.databases.retrieve).toHaveBeenCalledWith({ database_id: "db-ingredients" });
  });

  it("returns an empty array when the property has no options", async () => {
    const client = fakeClient([]);

    const result = await getCategoryOrder(client);

    expect(result).toEqual([]);
  });
});
