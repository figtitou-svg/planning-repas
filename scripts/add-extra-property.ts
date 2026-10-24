// Ajoute les propriétés « Ajouté » (case) et « Quantité » (nombre) à la base Notion des coches
// de courses : nécessaires pour ajouter des articles à la main dans la liste de courses, avec
// ou sans quantité.
// Sans danger à relancer : ne fait rien pour une propriété qui existe déjà.
//   npm run setup:extras

import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { notionConfig } from "../src/lib/notionConfig";

const PROPERTIES = [
  { name: "Ajouté", type: "checkbox", definition: { checkbox: {} } },
  { name: "Quantité", type: "number", definition: { number: { format: "number" } } },
] as const;

async function main() {
  const client = new Client({ auth: notionConfig.token() });
  // Cible uniquement la base du foyer 1 (household-1).
  const databaseId = notionConfig.shoppingChecksDbId("household-1");

  const db: any = await client.databases.retrieve({ database_id: databaseId });

  const toAdd: Record<string, unknown> = {};
  for (const { name, type, definition } of PROPERTIES) {
    const existing = db.properties?.[name];
    if (!existing) {
      toAdd[name] = definition;
    } else if (existing.type !== type) {
      throw new Error(
        `La propriété « ${name} » existe déjà mais son type est « ${existing.type} » (attendu : ${type}). Renommez-la ou supprimez-la dans Notion.`
      );
    } else {
      console.log(`OK  La propriété « ${name} » (${type}) existe déjà, rien à faire.`);
    }
  }

  if (Object.keys(toAdd).length === 0) return;
  await client.databases.update({ database_id: databaseId, properties: toAdd } as any);
  for (const name of Object.keys(toAdd)) {
    console.log(`OK  Propriété « ${name} » ajoutée à la base des coches de courses.`);
  }
}

main().catch((error) => {
  console.error("ÉCHEC", (error as Error).message);
  process.exit(1);
});
