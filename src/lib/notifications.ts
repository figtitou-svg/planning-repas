import { daysBetween, EXPIRY_ALERT_DAYS, expiryDay, toDay } from "./expiry";
import { missingFields, type MissingField } from "./incomplete";
import type { Ingredient, PantryItem, Unit } from "./types";

export interface ExpiringItem {
  pantryId: string;
  ingredientId: string;
  name: string;
  quantity: number;
  unit: Unit;
  expiryDay: string;
  daysLeft: number;
}

export interface IncompleteItem {
  ingredientId: string;
  name: string;
  missing: MissingField[];
  notionUrl: string;
}

export interface Notifications {
  expiring: ExpiringItem[];
  incomplete: IncompleteItem[];
  count: number;
}

export function buildNotifications(
  ingredients: Ingredient[],
  pantry: PantryItem[],
  today: string
): Notifications {
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  const expiring: ExpiringItem[] = [];
  for (const item of pantry) {
    const ingredient = ingredientById.get(item.ingredientId);
    if (!ingredient || !(ingredient.shelfLifeDays > 0) || !(item.quantity > 0)) continue;
    const purchaseDay = toDay(item.purchaseDate);
    if (!purchaseDay) continue;
    const expiry = expiryDay(purchaseDay, ingredient.shelfLifeDays);
    if (expiry === null) continue;
    const daysLeft = daysBetween(today, expiry);
    if (daysLeft > EXPIRY_ALERT_DAYS) continue;
    expiring.push({
      pantryId: item.id,
      ingredientId: ingredient.id,
      name: ingredient.name,
      quantity: item.quantity,
      unit: ingredient.unit,
      expiryDay: expiry,
      daysLeft,
    });
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  const incomplete: IncompleteItem[] = [];
  for (const ingredient of ingredients) {
    const missing = missingFields(ingredient);
    if (missing.length === 0) continue;
    incomplete.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
      missing,
      notionUrl: "https://www.notion.so/" + ingredient.id.replace(/-/g, ""),
    });
  }
  incomplete.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { expiring, incomplete, count: expiring.length + incomplete.length };
}
