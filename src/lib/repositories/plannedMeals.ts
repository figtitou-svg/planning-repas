import type { Client } from "@notionhq/client";
import { notionConfig } from "../notionConfig";
import type { HouseholdId } from "../households";
import type { PlannedMeal } from "../types";

function pageToPlannedMeal(page: any): PlannedMeal {
  return {
    id: page.id,
    weekStart: page.properties?.["Semaine"]?.date?.start ?? "",
    recipeId: page.properties?.["Recipe"]?.relation?.[0]?.id ?? "",
    portions: page.properties?.["Portions"]?.number ?? 0,
  };
}

async function queryAll(client: Client, databaseId: string, filter?: any): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const response: any = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      ...(filter ? { filter } : {}),
    });
    results.push(...response.results);
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results;
}

export async function listPlannedMeals(
  client: Client,
  household: HouseholdId,
  weekStart: string
): Promise<PlannedMeal[]> {
  const pages = await queryAll(client, notionConfig.weeklyPlanDbId(household), {
    property: "Semaine",
    date: { equals: weekStart },
  });
  return pages.filter((page) => (page.properties?.["Recipe"]?.relation ?? []).length > 0).map(pageToPlannedMeal);
}

export async function schedulePlannedMeal(
  client: Client,
  household: HouseholdId,
  data: { weekStart: string; recipeId: string; portions: number }
): Promise<PlannedMeal> {
  const page = await client.pages.create({
    parent: { database_id: notionConfig.weeklyPlanDbId(household) },
    properties: {
      Semaine: { date: { start: data.weekStart } },
      Recipe: { relation: [{ id: data.recipeId }] },
      Portions: { number: data.portions },
    } as any,
  });
  return pageToPlannedMeal(page);
}

function normalizeId(id: string | undefined): string {
  return (id ?? "").replace(/-/g, "");
}

export async function removePlannedMeal(client: Client, household: HouseholdId, id: string): Promise<boolean> {
  let page: any;
  try {
    page = await client.pages.retrieve({ page_id: id });
  } catch (error: any) {
    if (error?.code === "object_not_found" || error?.code === "validation_error") return false;
    throw error;
  }
  if (normalizeId(page?.parent?.database_id) !== normalizeId(notionConfig.weeklyPlanDbId(household))) {
    return false;
  }
  if (!page.archived) {
    await client.pages.update({ page_id: id, archived: true } as any);
  }
  return true;
}
