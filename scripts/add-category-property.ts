// Ajoute la liste « Catégorie » (Apéro, Entrée, Viande…) à la base Notion des recettes ;
// l'app s'en sert pour colorer les recettes. Sans danger à relancer : ne fait rien si la
// propriété existe déjà.
//   npm run setup:category

import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { notionConfig } from "../src/lib/notionConfig";
import { NOTION_OPTION_COLORS, RECIPE_CATEGORIES } from "../src/lib/recipeCategories";

const PROPERTY = "Catégorie";

async function main() {
  const client = new Client({ auth: notionConfig.token() });
  const databaseId = notionConfig.recipesDbId();

  const db: any = await client.databases.retrieve({ database_id: databaseId });
  const existing = db.properties?.[PROPERTY];

  if (existing) {
    if (existing.type !== "select") {
      throw new Error(
        `La propriété « ${PROPERTY} » existe déjà mais son type est « ${existing.type} » (attendu : select). Renommez-la ou supprimez-la dans Notion.`
      );
    }
    console.log(`OK  La propriété « ${PROPERTY} » (select) existe déjà, rien à faire.`);
    return;
  }

  await client.databases.update({
    database_id: databaseId,
    properties: {
      [PROPERTY]: {
        select: {
          options: RECIPE_CATEGORIES.map((name) => ({ name, color: NOTION_OPTION_COLORS[name] })),
        },
      },
    },
  } as any);
  console.log(`OK  Propriété « ${PROPERTY} » (select) ajoutée à la base des recettes.`);
}

main().catch((error) => {
  console.error("ÉCHEC", (error as Error).message);
  process.exit(1);
});
