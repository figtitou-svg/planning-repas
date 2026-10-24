import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { createIngredient } from "@/lib/repositories/ingredients";
import {
  addExtra,
  isMissingExtraProperty,
  isMissingQuantityProperty,
  removeExtra,
  setExtraQuantity,
} from "@/lib/repositories/shoppingChecks";
import {
  cachedReads,
  invalidateChecks,
  invalidateExtras,
  invalidateIngredients,
} from "@/lib/cachedReads";
import { resolveExtraIngredient } from "@/lib/resolveExtraIngredient";
import type { Unit } from "@/lib/types";

const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UNITS: Unit[] = ["g", "mL", "pièce"];

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// Ajoute un article à la main à la liste d'une semaine. Il se désigne par `ingredientId`
// (choisi dans les suggestions) ou par `name` (texte libre) ; un nom absent du catalogue
// crée l'ingrédient dans Notion, sans taille ni prix de paquet, dans l'unité de `unit`.
// `quantity` (dans `unit`) est facultative : elle s'ajoute au besoin des recettes, mais seulement
// si l'unité est celle de l'ingrédient, sinon on ne devine pas et l'article est ajouté sans.
export async function POST(request: Request) {
  const household = householdFromRequest(request);
  const { weekStart, ingredientId, name, quantity, unit } = await request.json();
  if (typeof weekStart !== "string" || !WEEK_PATTERN.test(weekStart)) {
    return badRequest("Semaine invalide (YYYY-MM-DD attendu)");
  }
  const hasQuantity = quantity !== undefined && quantity !== null;
  if (hasQuantity && !(typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0)) {
    return badRequest("Quantité invalide (nombre positif attendu)");
  }
  if (hasQuantity && !UNITS.includes(unit)) {
    return badRequest("Unité invalide (g, mL ou pièce attendu)");
  }
  const typedUnit: Unit = hasQuantity ? unit : "pièce";
  const client = getNotionClient();

  let ingredient;
  let created = false;
  if (typeof ingredientId === "string" && ingredientId) {
    // Relecture forcée seulement si l'ingrédient est absent du cache.
    let catalog = await cachedReads.listIngredients(client);
    ingredient = catalog.find((item) => item.id === ingredientId);
    if (!ingredient) {
      catalog = await cachedReads.listIngredients(client, { fresh: true });
      ingredient = catalog.find((item) => item.id === ingredientId);
    }
    if (!ingredient) return NextResponse.json({ error: "Ingrédient introuvable" }, { status: 404 });
  } else {
    // Relecture forcée : un ingrédient ajouté directement dans Notion ne doit pas être dupliqué.
    const catalog = await cachedReads.listIngredients(client, { fresh: true });
    let resolved;
    try {
      resolved = await resolveExtraIngredient(String(name ?? ""), catalog, (newName) =>
        createIngredient(client, {
          name: newName,
          unit: typedUnit,
          packageSize: 0,
          packagePrice: 0,
          shelfLifeDays: 0,
          category: "Autre",
        })
      );
    } finally {
      invalidateIngredients();
    }
    if (!resolved.ok) return badRequest(resolved.error);
    ingredient = resolved.ingredient;
    created = resolved.created;
  }

  let savedQuantity: number | undefined = hasQuantity && ingredient.unit === typedUnit ? quantity : undefined;
  let quantityIgnored: "unit" | "setup" | undefined = hasQuantity && savedQuantity === undefined ? "unit" : undefined;

  try {
    try {
      await addExtra(client, household, weekStart, ingredient.id, savedQuantity);
    } catch (error) {
      if (savedQuantity === undefined || !isMissingQuantityProperty(error)) throw error;
      // Avant `npm run setup:extras`, l'article s'ajoute quand même, sans sa quantité.
      savedQuantity = undefined;
      quantityIgnored = "setup";
      await addExtra(client, household, weekStart, ingredient.id, undefined);
    }
  } catch (error) {
    if (isMissingExtraProperty(error)) {
      return NextResponse.json(
        { error: "La base Notion n'a pas encore la case « Ajouté » : lancez « npm run setup:extras »." },
        { status: 503 }
      );
    }
    throw error;
  } finally {
    invalidateExtras(household, weekStart);
    invalidateChecks(household, weekStart);
  }
  return NextResponse.json(
    {
      ingredientId: ingredient.id,
      name: ingredient.name,
      created,
      unit: ingredient.unit,
      quantity: savedQuantity ?? null,
      ...(quantityIgnored ? { quantityIgnored } : {}),
    },
    { status: 201 }
  );
}

// Change la quantité tapée d'un article ajouté à la main : elle remplace l'ancienne, `null` l'efface
// (l'article revient à un paquet).
export async function PATCH(request: Request) {
  const household = householdFromRequest(request);
  const { weekStart, ingredientId, quantity } = await request.json();
  if (typeof weekStart !== "string" || !WEEK_PATTERN.test(weekStart) || typeof ingredientId !== "string" || !ingredientId) {
    return badRequest("Semaine et article requis");
  }
  if (quantity !== null && !(typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0)) {
    return badRequest("Quantité invalide (nombre positif ou null attendu)");
  }
  let found: boolean;
  try {
    found = await setExtraQuantity(getNotionClient(), household, weekStart, ingredientId, quantity);
  } catch (error) {
    if (isMissingQuantityProperty(error)) {
      return NextResponse.json(
        { error: "La base Notion n'a pas encore la propriété « Quantité » : lancez « npm run setup:extras »." },
        { status: 503 }
      );
    }
    throw error;
  } finally {
    invalidateExtras(household, weekStart);
  }
  if (!found) return NextResponse.json({ error: "Article introuvable dans la liste" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const household = householdFromRequest(request);
  const { weekStart, ingredientId } = await request.json();
  if (typeof weekStart !== "string" || !WEEK_PATTERN.test(weekStart) || typeof ingredientId !== "string") {
    return badRequest("Semaine et article requis");
  }
  try {
    await removeExtra(getNotionClient(), household, weekStart, ingredientId);
  } finally {
    invalidateExtras(household, weekStart);
    invalidateChecks(household, weekStart);
  }
  return new NextResponse(null, { status: 204 });
}
