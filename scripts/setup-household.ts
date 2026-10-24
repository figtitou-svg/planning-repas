import { config } from "dotenv";
config({ path: ".env.local" });

import { appendFileSync } from "node:fs";
import { Client } from "@notionhq/client";
import { notionConfig } from "../src/lib/notionConfig";
import { splitDatabaseSchema } from "../src/lib/copyDatabaseSchema";

// Crée les bases propres au foyer 2 (stock, planning, courses) en copiant celles du foyer 1.
const TITLE_SUFFIX = "Household 2";

let createdCount = 0;

async function main() {
  const envNames = ["NOTION_PANTRY_DB_ID_2", "NOTION_WEEKLY_PLAN_DB_ID_2", "NOTION_SHOPPING_CHECKS_DB_ID_2"];
  for (const envName of envNames) {
    if (process.env[envName]) {
      console.error(`${envName} existe déjà : les bases du foyer 2 sont déjà (au moins en partie) créées.`);
      process.exit(1);
    }
  }
  const client = new Client({ auth: notionConfig.token() });
  const sources = [
    { label: "Pantry", envName: envNames[0], id: notionConfig.pantryDbId("household-1") },
    { label: "WeeklyPlan", envName: envNames[1], id: notionConfig.weeklyPlanDbId("household-1") },
    { label: "ShoppingChecks", envName: envNames[2], id: notionConfig.shoppingChecksDbId("household-1") },
  ];

  // Tous les payloads sont construits avant toute création : un type non géré échoue sans rien créer.
  const payloads = [];
  for (const source of sources) {
    const db: any = await client.databases.retrieve({ database_id: source.id });
    if (db.parent?.type !== "page_id") {
      throw new Error(`La base ${source.label} n'est pas située sous une page (parent : ${db.parent?.type}).`);
    }
    payloads.push({ source, pageId: db.parent.page_id as string, ...splitDatabaseSchema(db.properties) });
  }

  for (const { source, pageId, create, formulas } of payloads) {
    const created: any = await client.databases.create({
      parent: { type: "page_id", page_id: pageId },
      title: [{ type: "text", text: { content: `${source.label} — ${TITLE_SUFFIX}` } }],
      properties: create,
    } as any);
    createdCount++;
    // Écrit immédiatement (avant l'ajout des formules) : un échec ultérieur ne laisse pas de base non suivie.
    const header = createdCount === 1 ? ["", "# Bases du foyer 2"] : [];
    appendFileSync(".env.local", [...header, `${source.envName}=${created.id}`, ""].join("\n"));
    console.log(`OK ${source.label} → ${created.id}`);
    // Les formules sont ajoutées après : elles référencent des rollups qui doivent déjà exister.
    if (Object.keys(formulas).length > 0) {
      await client.databases.update({ database_id: created.id, properties: formulas } as any);
      console.log(`OK ${source.label} : formules ajoutées`);
    }
  }
  console.log("IDs ajoutés à .env.local.");
}

main().catch((error) => {
  console.error(`Échec : ${(error as Error).message}`);
  if (createdCount === 0) {
    console.error("Aucune base n'a été créée : vous pouvez relancer.");
  } else {
    console.error(
      "Des bases ont déjà été créées et leurs IDs sont listés dans .env.local : vérifiez-les (et les formules de la dernière base) avant toute relance ; supprimez les bases orphelines dans Notion si besoin."
    );
  }
  process.exit(1);
});
