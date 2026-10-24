import type { Client } from "@notionhq/client";
import { notionConfig } from "../notionConfig";
import type { HouseholdId } from "../households";
import type { ShoppingExtra } from "../types";

async function findCheckPage(
  client: Client,
  household: HouseholdId,
  weekStart: string,
  ingredientId: string
): Promise<any | null> {
  let cursor: string | undefined;
  do {
    const response: any = await client.databases.query({
      database_id: notionConfig.shoppingChecksDbId(household),
      // Une seule ligne attendue : on demande directement (semaine, ingrédient) plutôt que toute la semaine.
      filter: {
        and: [
          { property: "Semaine", date: { equals: weekStart } },
          { property: "Ingredient", relation: { contains: ingredientId } },
        ],
      },
      start_cursor: cursor,
    });
    const found = response.results.find((page: any) => page.properties["Ingredient"].relation[0]?.id === ingredientId);
    if (found) {
      return found;
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return null;
}

export async function listChecks(
  client: Client,
  household: HouseholdId,
  weekStart: string
): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  let cursor: string | undefined;
  do {
    const response: any = await client.databases.query({
      database_id: notionConfig.shoppingChecksDbId(household),
      filter: { property: "Semaine", date: { equals: weekStart } },
      start_cursor: cursor,
    });
    for (const page of response.results) {
      const ingredientId = page.properties["Ingredient"].relation[0]?.id;
      if (ingredientId) map[ingredientId] = page.properties["Coché"].checkbox ?? false;
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return map;
}

export async function setCheck(
  client: Client,
  household: HouseholdId,
  weekStart: string,
  ingredientId: string,
  checked: boolean
): Promise<void> {
  const existing = await findCheckPage(client, household, weekStart, ingredientId);
  if (existing) {
    await client.pages.update({
      page_id: existing.id,
      properties: { Coché: { checkbox: checked } },
    } as any);
    return;
  }
  await client.pages.create({
    parent: { database_id: notionConfig.shoppingChecksDbId(household) },
    properties: {
      Semaine: { date: { start: weekStart } },
      Ingredient: { relation: [{ id: ingredientId }] },
      Coché: { checkbox: checked },
    } as any,
  });
}

// Articles ajoutés à la main : une ligne de la même base, marquée par la case « Ajouté ».
// Une ligne ordinaire (simple coche d'un article de recette) n'a pas cette case cochée.
/** Notion refuse la requête : la propriété « Ajouté » n'existe pas (encore) dans la base. */
export function isMissingExtraProperty(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return code === "validation_error" && /Ajouté/.test(message ?? "");
}

/** Notion refuse l'écriture : la propriété « Quantité » n'existe pas (encore) dans la base. */
export function isMissingQuantityProperty(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return code === "validation_error" && /Quantité/.test(message ?? "");
}

export async function listExtras(client: Client, household: HouseholdId, weekStart: string): Promise<ShoppingExtra[]> {
  try {
    return await queryExtras(client, household, weekStart);
  } catch (error) {
    // Avant `npm run setup:extras`, la liste de courses doit continuer à fonctionner, sans ajouts.
    if (isMissingExtraProperty(error)) return [];
    throw error;
  }
}

async function queryExtras(client: Client, household: HouseholdId, weekStart: string): Promise<ShoppingExtra[]> {
  const extras: ShoppingExtra[] = [];
  let cursor: string | undefined;
  do {
    const response: any = await client.databases.query({
      database_id: notionConfig.shoppingChecksDbId(household),
      filter: {
        and: [
          { property: "Semaine", date: { equals: weekStart } },
          { property: "Ajouté", checkbox: { equals: true } },
        ],
      },
      start_cursor: cursor,
    });
    for (const page of response.results) {
      const ingredientId = page.properties["Ingredient"].relation[0]?.id;
      if (ingredientId) extras.push({ ingredientId, quantity: page.properties["Quantité"]?.number ?? null });
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return extras;
}

// `quantity` (dans l'unité du catalogue) s'ajoute à celle déjà tapée pour la semaine ; sans
// quantité, celle d'un article toujours présent est conservée.
export async function addExtra(
  client: Client,
  household: HouseholdId,
  weekStart: string,
  ingredientId: string,
  quantity?: number
): Promise<void> {
  const existing = await findCheckPage(client, household, weekStart, ingredientId);
  if (existing) {
    const stillExtra = existing.properties["Ajouté"]?.checkbox === true;
    const previous: number | null = existing.properties["Quantité"]?.number ?? null;
    const properties: Record<string, unknown> = { Ajouté: { checkbox: true }, Coché: { checkbox: false } };
    if (quantity !== undefined) {
      // Réajouté après un retrait : la quantité d'avant ne compte plus.
      properties.Quantité = { number: (stillExtra ? previous ?? 0 : 0) + quantity };
    } else if (!stillExtra && previous !== null) {
      properties.Quantité = { number: null };
    }
    await client.pages.update({ page_id: existing.id, properties } as any);
    return;
  }
  await client.pages.create({
    parent: { database_id: notionConfig.shoppingChecksDbId(household) },
    properties: {
      Semaine: { date: { start: weekStart } },
      Ingredient: { relation: [{ id: ingredientId }] },
      Coché: { checkbox: false },
      Ajouté: { checkbox: true },
      ...(quantity !== undefined ? { Quantité: { number: quantity } } : {}),
    } as any,
  });
}

// Remplace (sans cumuler) la quantité tapée d'un article ajouté à la main ; `null` l'efface.
// Renvoie false si l'article n'est pas un ajout manuel de cette semaine.
export async function setExtraQuantity(
  client: Client,
  household: HouseholdId,
  weekStart: string,
  ingredientId: string,
  quantity: number | null
): Promise<boolean> {
  const existing = await findCheckPage(client, household, weekStart, ingredientId);
  if (!existing || existing.properties["Ajouté"]?.checkbox !== true) return false;
  await client.pages.update({
    page_id: existing.id,
    properties: { Quantité: { number: quantity } },
  } as any);
  return true;
}

export async function removeExtra(
  client: Client,
  household: HouseholdId,
  weekStart: string,
  ingredientId: string
): Promise<void> {
  const existing = await findCheckPage(client, household, weekStart, ingredientId);
  if (!existing) return;
  await client.pages.update({
    page_id: existing.id,
    properties: {
      Ajouté: { checkbox: false },
      Coché: { checkbox: false },
      // Seulement si la base a la propriété : sinon Notion refuserait la mise à jour.
      ...("Quantité" in existing.properties ? { Quantité: { number: null } } : {}),
    },
  } as any);
}
