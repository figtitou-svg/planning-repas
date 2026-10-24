import type { Client } from "@notionhq/client";
import { notionConfig } from "../notionConfig";
import type { Ingredient, Unit } from "../types";

function pageToIngredient(page: any): Ingredient {
  const props = page.properties;
  return {
    id: page.id,
    name: props["Nom"].title[0]?.plain_text ?? "",
    unit: props["Unité"].select?.name as Unit,
    packageSize: props["Taille du paquet"].number ?? 0,
    packagePrice: props["Prix du paquet"].number ?? 0,
    shelfLifeDays: props["Durée de conservation"].number ?? 0,
    category: props["Catégorie"].select?.name ?? "Autre",
  };
}

export async function listIngredients(client: Client): Promise<Ingredient[]> {
  const results: Ingredient[] = [];
  let cursor: string | undefined;
  do {
    const response: any = await client.databases.query({
      database_id: notionConfig.ingredientsDbId(),
      start_cursor: cursor,
    });
    results.push(...response.results.map(pageToIngredient));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results;
}

function positiveOrNull(value: number): number | null {
  return value > 0 ? value : null;
}

export async function createIngredient(
  client: Client,
  data: Omit<Ingredient, "id">
): Promise<Ingredient> {
  const page = await client.pages.create({
    parent: { database_id: notionConfig.ingredientsDbId() },
    properties: {
      Nom: { title: [{ text: { content: data.name } }] },
      Unité: { select: { name: data.unit } },
      "Taille du paquet": { number: positiveOrNull(data.packageSize) },
      "Prix du paquet": { number: positiveOrNull(data.packagePrice) },
      "Durée de conservation": { number: positiveOrNull(data.shelfLifeDays) },
      Catégorie: { select: { name: data.category } },
    } as any,
  });
  return pageToIngredient(page);
}

export async function updateIngredient(
  client: Client,
  id: string,
  data: Partial<Omit<Ingredient, "id">>
): Promise<Ingredient> {
  const properties: Record<string, any> = {};
  if (data.name !== undefined) properties["Nom"] = { title: [{ text: { content: data.name } }] };
  if (data.unit !== undefined) properties["Unité"] = { select: { name: data.unit } };
  if (data.packageSize !== undefined)
    properties["Taille du paquet"] = { number: data.packageSize };
  if (data.packagePrice !== undefined)
    properties["Prix du paquet"] = { number: data.packagePrice };
  if (data.shelfLifeDays !== undefined)
    properties["Durée de conservation"] = { number: data.shelfLifeDays };
  if (data.category !== undefined) properties["Catégorie"] = { select: { name: data.category } };

  const page = await client.pages.update({ page_id: id, properties } as any);
  return pageToIngredient(page);
}

export async function deleteIngredient(client: Client, id: string): Promise<void> {
  await client.pages.update({ page_id: id, archived: true } as any);
}
