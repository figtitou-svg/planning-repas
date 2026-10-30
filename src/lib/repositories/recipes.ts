import type { Client } from "@notionhq/client";
import { notionConfig } from "../notionConfig";
import type { Recipe, RecipeIngredient } from "../types";
import { mapLimit } from "../mapLimit";

// Notion tolère environ 3 requêtes par seconde : on écrit par petits lots plutôt qu'à la file.
const WRITE_CONCURRENCY = 3;

// Limites de Notion : 2 000 caractères par bloc de texte, 100 blocs par ajout.
const MAX_STEP_CHARS = 2000;
const MAX_BLOCKS_PER_APPEND = 100;
const STEP_BLOCK_TYPES = new Set(["numbered_list_item", "bulleted_list_item", "paragraph"]);

export function cleanSteps(steps: readonly unknown[]): string[] {
  return steps
    .filter((step): step is string => typeof step === "string")
    .map((step) => step.trim().slice(0, MAX_STEP_CHARS))
    .filter((step) => step !== "");
}

async function listStepBlocks(client: Client, pageId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const response: any = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    });
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);
  return blocks.filter((block) => STEP_BLOCK_TYPES.has(block.type));
}

async function readSteps(client: Client, pageId: string): Promise<string[]> {
  const blocks = await listStepBlocks(client, pageId);
  return blocks
    .map((block) =>
      ((block[block.type]?.rich_text ?? []) as Array<{ plain_text?: string }>)
        .map((part) => part.plain_text ?? "")
        .join("")
        .trim()
    )
    .filter((text) => text !== "");
}

async function appendSteps(client: Client, pageId: string, steps: string[]): Promise<void> {
  for (let i = 0; i < steps.length; i += MAX_BLOCKS_PER_APPEND) {
    await client.blocks.children.append({
      block_id: pageId,
      children: steps.slice(i, i + MAX_BLOCKS_PER_APPEND).map((step) => ({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: [{ type: "text", text: { content: step } }] },
      })),
    } as any);
  }
}

// Remplace les étapes existantes (blocs de texte de la page) par la liste voulue.
async function replaceSteps(client: Client, pageId: string, steps: string[]): Promise<void> {
  const existing = await listStepBlocks(client, pageId);
  await mapLimit(existing, WRITE_CONCURRENCY, (block) =>
    client.blocks.delete({ block_id: block.id }).then(() => undefined)
  );
  await appendSteps(client, pageId, steps);
}

function pageToRecipeBase(page: any): {
  id: string;
  name: string;
  portions: number;
  favorite: boolean;
} {
  return {
    id: page.id,
    name: page.properties["Nom"].title[0]?.plain_text ?? "",
    portions: page.properties["Portions"]?.number ?? 2,
    // La propriété peut manquer tant que la case « Favori » n'a pas été ajoutée dans Notion.
    favorite: page.properties["Favori"]?.checkbox ?? false,
  };
}

function pageToJunction(page: any) {
  return {
    id: page.id,
    recipeId: page.properties["Recipe"].relation[0]?.id ?? "",
    ingredientId: page.properties["Ingredient"].relation[0]?.id ?? "",
    quantity: page.properties["Quantité"].number ?? 0,
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

export async function listRecipes(client: Client): Promise<Recipe[]> {
  const recipePages = await queryAll(client, notionConfig.recipesDbId());
  const junctions = (await queryAll(client, notionConfig.recipeIngredientsDbId())).map(
    pageToJunction
  );

  return recipePages.map((page) => {
    const { id, name, portions, favorite } = pageToRecipeBase(page);
    const ingredients: RecipeIngredient[] = junctions
      .filter((j) => j.recipeId === id)
      .map((j) => ({ ingredientId: j.ingredientId, quantity: j.quantity }));
    return { id, name, portions, favorite, ingredients };
  });
}

export async function getRecipe(client: Client, id: string): Promise<Recipe | null> {
  let page: any;
  try {
    page = await client.pages.retrieve({ page_id: id });
  } catch {
    return null;
  }
  const junctions = (
    await queryAll(client, notionConfig.recipeIngredientsDbId(), {
      property: "Recipe",
      relation: { contains: id },
    })
  ).map(pageToJunction);
  const { name, portions, favorite } = pageToRecipeBase(page);
  return {
    id,
    name,
    portions,
    favorite,
    ingredients: junctions.map((j) => ({ ingredientId: j.ingredientId, quantity: j.quantity })),
    steps: await readSteps(client, id),
  };
}

async function createJunctionRow(
  client: Client,
  recipeId: string,
  ri: RecipeIngredient
): Promise<void> {
  await client.pages.create({
    parent: { database_id: notionConfig.recipeIngredientsDbId() },
    properties: {
      Recipe: { relation: [{ id: recipeId }] },
      Ingredient: { relation: [{ id: ri.ingredientId }] },
      Quantité: { number: ri.quantity },
    } as any,
  });
}

async function createJunctionRows(
  client: Client,
  recipeId: string,
  ingredients: RecipeIngredient[]
): Promise<void> {
  await mapLimit(ingredients, WRITE_CONCURRENCY, (ri) => createJunctionRow(client, recipeId, ri));
}

async function archivePage(client: Client, pageId: string): Promise<void> {
  await client.pages.update({ page_id: pageId, archived: true } as any);
}

async function archiveJunctionRowsForRecipe(client: Client, recipeId: string): Promise<void> {
  const junctionPages = await queryAll(client, notionConfig.recipeIngredientsDbId(), {
    property: "Recipe",
    relation: { contains: recipeId },
  });
  await mapLimit(junctionPages, WRITE_CONCURRENCY, (page) => archivePage(client, page.id));
}

// Aligne les lignes de liaison sur la liste voulue en ne touchant qu'à ce qui change :
// une ligne existante pour le même ingrédient est réutilisée (quantité mise à jour si besoin),
// les lignes en trop sont archivées, les ingrédients nouveaux sont créés.
async function syncJunctionRows(
  client: Client,
  recipeId: string,
  wanted: RecipeIngredient[]
): Promise<void> {
  const existing = (
    await queryAll(client, notionConfig.recipeIngredientsDbId(), {
      property: "Recipe",
      relation: { contains: recipeId },
    })
  ).map(pageToJunction);

  const available = new Map<string, typeof existing>();
  for (const row of existing) {
    available.set(row.ingredientId, [...(available.get(row.ingredientId) ?? []), row]);
  }

  const operations: Array<() => Promise<void>> = [];
  for (const ri of wanted) {
    const match = available.get(ri.ingredientId)?.shift();
    if (!match) {
      operations.push(() => createJunctionRow(client, recipeId, ri));
    } else if (match.quantity !== ri.quantity) {
      operations.push(async () => {
        await client.pages.update({
          page_id: match.id,
          properties: { Quantité: { number: ri.quantity } },
        } as any);
      });
    }
  }
  for (const leftovers of available.values()) {
    for (const row of leftovers) operations.push(() => archivePage(client, row.id));
  }

  await mapLimit(operations, WRITE_CONCURRENCY, (operation) => operation());
}

export async function createRecipe(
  client: Client,
  data: { name: string; portions: number; ingredients: RecipeIngredient[]; steps?: string[] }
): Promise<Recipe> {
  const page = await client.pages.create({
    parent: { database_id: notionConfig.recipesDbId() },
    properties: {
      Nom: { title: [{ text: { content: data.name } }] },
      Portions: { number: data.portions },
    } as any,
  });
  await createJunctionRows(client, page.id, data.ingredients);
  const steps = cleanSteps(data.steps ?? []);
  if (steps.length > 0) await appendSteps(client, page.id, steps);
  return {
    id: page.id,
    name: data.name,
    portions: data.portions,
    favorite: false,
    ingredients: data.ingredients,
    ...(steps.length > 0 ? { steps } : {}),
  };
}

export async function updateRecipe(
  client: Client,
  id: string,
  data: {
    name?: string;
    portions?: number;
    favorite?: boolean;
    ingredients?: RecipeIngredient[];
    steps?: string[];
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (data.name !== undefined) {
    properties.Nom = { title: [{ text: { content: data.name } }] };
  }
  if (data.portions !== undefined) {
    properties.Portions = { number: data.portions };
  }
  if (data.favorite !== undefined) {
    properties.Favori = { checkbox: data.favorite };
  }
  if (Object.keys(properties).length > 0) {
    await client.pages.update({ page_id: id, properties } as any);
  }
  if (data.ingredients !== undefined) {
    await syncJunctionRows(client, id, data.ingredients);
  }
  if (data.steps !== undefined) {
    await replaceSteps(client, id, cleanSteps(data.steps));
  }
}

export async function deleteRecipe(client: Client, id: string): Promise<void> {
  await archiveJunctionRowsForRecipe(client, id);
  await client.pages.update({ page_id: id, archived: true } as any);
}
