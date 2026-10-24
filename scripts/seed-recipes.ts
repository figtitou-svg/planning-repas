// Ajoute une série de recettes de base dans Notion, uniquement avec des ingrédients DÉJÀ présents
// dans le catalogue (aucun ingrédient incomplet n'est créé).
//   npm run seed:recipes            simulation : affiche ce qui serait ajouté
//   npm run seed:recipes -- --apply ajoute réellement les recettes
// Relançable sans risque : une recette dont le nom existe déjà est ignorée.

import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { notionConfig } from "../src/lib/notionConfig";
import { normalizeText } from "../src/lib/ingredientSearch";
import { listIngredients } from "../src/lib/repositories/ingredients";
import { createRecipe, listRecipes } from "../src/lib/repositories/recipes";

interface SeedRecipe {
  name: string;
  portions: number;
  /** Nom de l'ingrédient tel qu'il est dans le catalogue, et quantité dans SON unité (g, mL, pièce). */
  ingredients: Array<[name: string, quantity: number]>;
}

const RECIPES: SeedRecipe[] = [
  {
    name: "Pâtes carbonara",
    portions: 4,
    ingredients: [["Pâtes", 400], ["Lardons", 200], ["Œufs", 3], ["Parmesan", 60]],
  },
  {
    name: "Crêpes",
    portions: 6,
    ingredients: [["Farine", 250], ["Œufs", 3], ["Lait", 500], ["Beurre", 30], ["Sucre en poudre", 30]],
  },
  {
    name: "Quiche lorraine",
    portions: 6,
    ingredients: [
      ["Pâte brisée", 230],
      ["Lardons", 200],
      ["Œufs", 3],
      ["Crème fraîche", 200],
      ["Emmental râpé", 100],
      ["Lait", 100],
    ],
  },
  {
    name: "Poulet crémeux, poivrons et riz",
    portions: 4,
    ingredients: [
      ["Blancs de poulet", 300],
      ["Riz", 300],
      ["Poivron", 300],
      ["Oignons", 150],
      ["Crème fraîche", 150],
      ["Huile d'olive", 15],
    ],
  },
  {
    name: "Pizzas express sur tortillas",
    portions: 4,
    ingredients: [
      ["Tortillas", 320],
      ["Tomates", 300],
      ["Mozzarella", 125],
      ["Jambon blanc", 160],
      ["Origan", 2],
      ["Huile d'olive", 15],
    ],
  },
  {
    name: "Hachis parmentier",
    portions: 4,
    ingredients: [
      ["Viande hachée", 350],
      ["Pommes de terre", 800],
      ["Oignons", 150],
      ["Lait", 100],
      ["Beurre", 40],
      ["Emmental râpé", 60],
    ],
  },
  {
    name: "Soupe de poireaux et pommes de terre",
    portions: 4,
    ingredients: [
      ["Poireaux", 600],
      ["Pommes de terre", 500],
      ["Oignons", 100],
      ["Bouillon de volaille", 20],
      ["Crème fraîche", 100],
      ["Beurre", 20],
    ],
  },
  {
    name: "Saumon au four, riz et courgettes",
    portions: 2,
    ingredients: [
      ["Saumon", 240],
      ["Riz", 150],
      ["Courgettes", 300],
      ["Citrons", 1],
      ["Huile d'olive", 15],
      ["Ail", 5],
    ],
  },
  {
    name: "Lentilles aux saucisses",
    portions: 4,
    ingredients: [
      ["Lentilles", 300],
      ["Saucisses", 350],
      ["Carottes", 200],
      ["Oignons", 100],
      ["Bouillon de volaille", 20],
    ],
  },
  {
    name: "Porridge banane et miel",
    portions: 2,
    ingredients: [["Flocons d'avoine", 100], ["Lait", 300], ["Bananes", 2], ["Miel", 20]],
  },
  {
    name: "Gâteau au chocolat",
    portions: 6,
    ingredients: [
      ["Cacao en poudre", 40],
      ["Farine", 100],
      ["Sucre en poudre", 150],
      ["Œufs", 4],
      ["Beurre", 150],
      ["Levure chimique", 5],
    ],
  },
  {
    name: "Tarte tomate et moutarde",
    portions: 4,
    ingredients: [
      ["Pâte brisée", 230],
      ["Tomates", 400],
      ["Mozzarella", 125],
      ["Moutarde", 30],
      ["Origan", 2],
    ],
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const client = new Client({ auth: notionConfig.token() });

  const [catalog, existing] = await Promise.all([listIngredients(client), listRecipes(client)]);
  const idByName = new Map(catalog.map((ing) => [normalizeText(ing.name), ing.id]));
  const existingNames = new Set(existing.map((r) => normalizeText(r.name)));

  // Tout est vérifié avant la première écriture : un nom d'ingrédient inconnu arrête tout.
  const unknown: string[] = [];
  for (const recipe of RECIPES) {
    for (const [name] of recipe.ingredients) {
      if (!idByName.has(normalizeText(name))) unknown.push(`${recipe.name} → « ${name} »`);
    }
  }
  if (unknown.length > 0) {
    console.error("ÉCHEC  Ingrédients absents du catalogue (rien n'a été écrit) :");
    for (const line of unknown) console.error(`  - ${line}`);
    process.exit(1);
  }

  let added = 0;
  for (const recipe of RECIPES) {
    if (existingNames.has(normalizeText(recipe.name))) {
      console.log(`IGNORÉE  ${recipe.name} (existe déjà)`);
      continue;
    }
    const summary = recipe.ingredients.map(([name, qty]) => `${name} ${qty}`).join(", ");
    if (!apply) {
      console.log(`AJOUTERAIT  ${recipe.name} (${recipe.portions} p.) : ${summary}`);
      added++;
      continue;
    }
    await createRecipe(client, {
      name: recipe.name,
      portions: recipe.portions,
      ingredients: recipe.ingredients.map(([name, quantity]) => ({
        ingredientId: idByName.get(normalizeText(name))!,
        quantity,
      })),
    });
    console.log(`AJOUTÉE  ${recipe.name}`);
    added++;
  }

  console.log(
    apply
      ? `\n${added} recette(s) ajoutée(s).`
      : `\nSimulation : ${added} recette(s) seraient ajoutées. Relancez avec --apply pour les créer.`
  );
}

main().catch((error) => {
  console.error("ÉCHEC", (error as Error).message);
  process.exit(1);
});
