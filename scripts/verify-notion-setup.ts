import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { notionConfig } from "../src/lib/notionConfig";

const checks: { label: string; dbId: () => string }[] = [
  { label: "Ingredients", dbId: notionConfig.ingredientsDbId },
  { label: "Recipes", dbId: notionConfig.recipesDbId },
  { label: "RecipeIngredients", dbId: notionConfig.recipeIngredientsDbId },
  { label: "Pantry", dbId: () => notionConfig.pantryDbId("household-1") },
  { label: "Pantry (foyer 2)", dbId: () => notionConfig.pantryDbId("household-2") },
  { label: "WeeklyPlan", dbId: () => notionConfig.weeklyPlanDbId("household-1") },
  { label: "WeeklyPlan (foyer 2)", dbId: () => notionConfig.weeklyPlanDbId("household-2") },
  { label: "ShoppingChecks", dbId: () => notionConfig.shoppingChecksDbId("household-1") },
  { label: "ShoppingChecks (foyer 2)", dbId: () => notionConfig.shoppingChecksDbId("household-2") },
];

// Expected properties per database: this is the Notion schema the app relies on,
// kept in sync with how each repository in src/lib/repositories/*.ts reads
// `page.properties[...]`. `types` lists the Notion property `type` string(s)
// accepted for that property, as returned by `databases.retrieve()`.
type ExpectedProperty = { name: string; types: string[] };

const schemas: Record<string, ExpectedProperty[]> = {
  Ingredients: [
    { name: "Nom", types: ["title"] },
    { name: "Unité", types: ["select"] },
    { name: "Taille du paquet", types: ["number"] },
    { name: "Prix du paquet", types: ["number"] },
    { name: "Durée de conservation", types: ["number"] },
    { name: "Catégorie", types: ["select"] },
  ],
  Recipes: [
    { name: "Nom", types: ["title"] },
    { name: "Portions", types: ["number"] },
    // Ajoutée par `npm run setup:favorite` (favorites de l'app).
    { name: "Favori", types: ["checkbox"] },
  ],
  RecipeIngredients: [
    { name: "Recipe", types: ["relation"] },
    { name: "Ingredient", types: ["relation"] },
    { name: "Quantité", types: ["number"] },
  ],
  Pantry: [
    { name: "Ingredient", types: ["relation"] },
    { name: "Quantité", types: ["number"] },
    { name: "Date d'achat", types: ["date"] },
    // Spec lists this as "Formula/Rollup" (a computed display field, not read
    // by any repository) — accept either underlying Notion type.
    { name: "Péremption estimée", types: ["formula", "rollup"] },
  ],
  WeeklyPlan: [
    { name: "Semaine", types: ["date"] },
    { name: "Recipe", types: ["relation"] },
    { name: "Portions", types: ["number"] },
  ],
  ShoppingChecks: [
    { name: "Semaine", types: ["date"] },
    { name: "Ingredient", types: ["relation"] },
    { name: "Coché", types: ["checkbox"] },
    // Ajoutée par `npm run setup:extras` (articles ajoutés à la main à la liste de courses).
    { name: "Ajouté", types: ["checkbox"] },
    // Ajoutée par `npm run setup:extras` (quantité tapée avec l'article ajouté à la main).
    { name: "Quantité", types: ["number"] },
  ],
};

function checkProperties(label: string, db: any, allOk: { value: boolean }) {
  // Les bases du foyer 2 réutilisent le schéma de leur base d'origine.
  const expectedProps = schemas[label.split(" ")[0]] ?? [];
  for (const prop of expectedProps) {
    const actual = db.properties?.[prop.name];
    if (!actual) {
      allOk.value = false;
      console.error(
        `  ÉCHEC   propriété "${prop.name}" absente de la base ${label} (attendu: ${prop.types.join(" ou ")})`
      );
    } else if (!prop.types.includes(actual.type)) {
      allOk.value = false;
      console.error(
        `  ÉCHEC   propriété "${prop.name}" dans ${label} a le type "${actual.type}" (attendu: ${prop.types.join(" ou ")})`
      );
    } else {
      console.log(`  OK      propriété "${prop.name}" (${actual.type})`);
    }
  }
}

async function main() {
  const client = new Client({ auth: notionConfig.token() });
  const allOk = { value: true };

  for (const check of checks) {
    try {
      const db: any = await client.databases.retrieve({ database_id: check.dbId() });
      const title = db.title?.[0]?.plain_text ?? "(sans titre)";
      console.log(`OK    ${check.label.padEnd(26)} → "${title}"`);
      checkProperties(check.label, db, allOk);
    } catch (error) {
      allOk.value = false;
      console.error(`ÉCHEC ${check.label.padEnd(26)} → ${(error as Error).message}`);
    }
  }

  if (!allOk.value) {
    console.error(
      "\nCertaines bases ne sont pas accessibles, ou leurs propriétés ne correspondent pas au schéma attendu. Vérifiez les IDs dans .env.local, que chaque base est bien partagée avec l'intégration (Step 3), et que les noms/types de propriétés correspondent exactement au tableau du plan (accents compris)."
    );
    process.exit(1);
  }
  console.log("\nToutes les bases sont accessibles et leurs propriétés correspondent au schéma attendu.");
}

main();
