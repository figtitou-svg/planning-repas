// Ajoute la case « Favori » à la base Notion des recettes (nécessaire aux favorites de l'app).
// Sans danger à relancer : ne fait rien si la propriété existe déjà.
//   npm run setup:favorite

import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { notionConfig } from "../src/lib/notionConfig";

const PROPERTY = "Favori";

async function main() {
  const client = new Client({ auth: notionConfig.token() });
  const databaseId = notionConfig.recipesDbId();

  const db: any = await client.databases.retrieve({ database_id: databaseId });
  const existing = db.properties?.[PROPERTY];

  if (existing) {
    if (existing.type !== "checkbox") {
      throw new Error(
        `La propriété « ${PROPERTY} » existe déjà mais son type est « ${existing.type} » (attendu : checkbox). Renommez-la ou supprimez-la dans Notion.`
      );
    }
    console.log(`OK  La propriété « ${PROPERTY} » (checkbox) existe déjà, rien à faire.`);
    return;
  }

  await client.databases.update({
    database_id: databaseId,
    properties: { [PROPERTY]: { checkbox: {} } },
  } as any);
  console.log(`OK  Propriété « ${PROPERTY} » (checkbox) ajoutée à la base des recettes.`);
}

main().catch((error) => {
  console.error("ÉCHEC", (error as Error).message);
  process.exit(1);
});
