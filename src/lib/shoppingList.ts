import { expiryDay, toDay } from "./expiry";
import type {
  Ingredient,
  PantryItem,
  Recipe,
  ShoppingExtra,
  ShoppingList,
  ShoppingListGroup,
  ShoppingListLine,
} from "./types";

function isExpired(item: PantryItem, ingredient: Ingredient, today: Date): boolean {
  const purchaseDay = toDay(item.purchaseDate);
  if (!purchaseDay) return false;
  const expiry = expiryDay(purchaseDay, ingredient.shelfLifeDays);
  if (expiry === null) return false;
  return expiry < today.toISOString().slice(0, 10);
}

export function computeShoppingList(
  recipes: Recipe[],
  ingredients: Ingredient[],
  pantry: PantryItem[],
  categoryOrder: string[] = [],
  today: Date = new Date(),
  extras: ShoppingExtra[] = []
): ShoppingList {
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const needed = new Map<string, number>();
  for (const recipe of recipes) {
    for (const ri of recipe.ingredients) {
      needed.set(ri.ingredientId, (needed.get(ri.ingredientId) ?? 0) + ri.quantity);
    }
  }

  // Une quantité tapée à la main s'ajoute à ce que demandent les recettes, avant le stock.
  const extraIds = new Set(extras.map((extra) => extra.ingredientId));
  const typed = new Map<string, number>();
  for (const { ingredientId, quantity } of extras) {
    if (quantity === null || !(quantity > 0)) continue;
    needed.set(ingredientId, (needed.get(ingredientId) ?? 0) + quantity);
    typed.set(ingredientId, (typed.get(ingredientId) ?? 0) + quantity);
  }

  const available = new Map<string, number>();
  for (const item of pantry) {
    const ingredient = ingredientById.get(item.ingredientId);
    if (!ingredient) continue;
    if (isExpired(item, ingredient, today)) continue;
    available.set(item.ingredientId, (available.get(item.ingredientId) ?? 0) + item.quantity);
  }

  const linesByCategory = new Map<string, ShoppingListLine[]>();
  const listed = new Set<string>();
  const addLine = (line: ShoppingListLine) => {
    const bucket = linesByCategory.get(line.category) ?? [];
    bucket.push(line);
    linesByCategory.set(line.category, bucket);
    listed.add(line.ingredientId);
  };

  for (const [ingredientId, neededQty] of needed) {
    const ingredient = ingredientById.get(ingredientId);
    if (!ingredient) continue;
    const have = available.get(ingredientId) ?? 0;
    const missing = neededQty - have;
    if (missing <= 0) continue;
    // A package size of 0 (or negative) makes "how many packages to buy" undefined
    // (division would yield Infinity/NaN, which breaks JSON serialization and the UI).
    // Skip the ingredient rather than fabricate a number.
    if (ingredient.packageSize <= 0) continue;
    const packagesToBuy = Math.ceil(missing / ingredient.packageSize);
    const lineCost = packagesToBuy * ingredient.packagePrice;
    addLine({
      ingredientId,
      ingredientName: ingredient.name,
      category: ingredient.category,
      missingQuantity: missing,
      unit: ingredient.unit,
      packagesToBuy,
      lineCost,
      ...(typed.has(ingredientId) ? { manual: true as const, extraQuantity: typed.get(ingredientId) } : {}),
    });
  }

  // Articles ajoutés à la main que les recettes n'ont pas déjà fait lister : un paquet chacun,
  // même si le catalogue ne connaît pas encore leur taille ou leur prix. Une quantité tapée
  // pour un article sans taille de paquet reste affichée telle quelle.
  for (const ingredientId of extraIds) {
    if (listed.has(ingredientId)) continue;
    const ingredient = ingredientById.get(ingredientId);
    if (!ingredient) continue;
    const hasPackage = ingredient.packageSize > 0;
    const hasPrice = ingredient.packagePrice > 0;
    const typedMissing = typed.has(ingredientId)
      ? (needed.get(ingredientId) ?? 0) - (available.get(ingredientId) ?? 0)
      : 0;
    addLine({
      ingredientId,
      ingredientName: ingredient.name,
      category: ingredient.category,
      missingQuantity: hasPackage ? ingredient.packageSize : Math.max(typedMissing, 0),
      unit: ingredient.unit,
      packagesToBuy: 1,
      lineCost: hasPrice ? ingredient.packagePrice : 0,
      manual: true,
      ...(typed.has(ingredientId) ? { extraQuantity: typed.get(ingredientId) } : {}),
      ...(hasPackage && hasPrice ? {} : { incomplete: true as const }),
    });
  }

  const orderIndex = (category: string) => {
    const idx = categoryOrder.indexOf(category);
    return idx === -1 ? categoryOrder.length : idx;
  };

  const groups: ShoppingListGroup[] = Array.from(linesByCategory.entries())
    .map(([category, lines]) => ({
      category,
      lines,
      subtotal: lines.reduce((sum, l) => sum + l.lineCost, 0),
    }))
    .sort((a, b) => orderIndex(a.category) - orderIndex(b.category));

  const totalCost = groups.reduce((sum, g) => sum + g.subtotal, 0);

  return { groups, totalCost };
}
