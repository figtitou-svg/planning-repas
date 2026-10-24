import type { Client } from "@notionhq/client";
import { notionConfig } from "../notionConfig";
import type { HouseholdId } from "../households";
import type { PantryItem } from "../types";

function pageToPantryItem(page: any): PantryItem {
  return {
    id: page.id,
    ingredientId: page.properties["Ingredient"].relation[0]?.id ?? "",
    quantity: page.properties["Quantité"].number ?? 0,
    purchaseDate: page.properties["Date d'achat"].date?.start ?? "",
  };
}

export async function listPantry(client: Client, household: HouseholdId): Promise<PantryItem[]> {
  const results: PantryItem[] = [];
  let cursor: string | undefined;
  do {
    const response: any = await client.databases.query({
      database_id: notionConfig.pantryDbId(household),
      start_cursor: cursor,
    });
    results.push(...response.results.map(pageToPantryItem));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results;
}

export async function addPantryItem(
  client: Client,
  household: HouseholdId,
  data: { ingredientId: string; quantity: number; purchaseDate: string }
): Promise<PantryItem> {
  const page = await client.pages.create({
    parent: { database_id: notionConfig.pantryDbId(household) },
    properties: {
      Ingredient: { relation: [{ id: data.ingredientId }] },
      Quantité: { number: data.quantity },
      "Date d'achat": { date: { start: data.purchaseDate } },
    } as any,
  });
  return pageToPantryItem(page);
}

export async function updatePantryQuantity(
  client: Client,
  id: string,
  quantity: number
): Promise<PantryItem> {
  const page = await client.pages.update({
    page_id: id,
    properties: { Quantité: { number: quantity } },
  } as any);
  return pageToPantryItem(page);
}

export async function removePantryItem(client: Client, id: string): Promise<void> {
  await client.pages.update({ page_id: id, archived: true } as any);
}
