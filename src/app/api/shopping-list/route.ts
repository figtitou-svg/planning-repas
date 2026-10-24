import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { buildShoppingListForWeek } from "@/lib/shoppingListForWeek";
import { cachedReads } from "@/lib/cachedReads";

export async function GET(request: Request) {
  const household = householdFromRequest(request);
  const week = new URL(request.url).searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "Paramètre 'week' requis (YYYY-MM-DD)" }, { status: 400 });
  }
  const shoppingList = await buildShoppingListForWeek(getNotionClient(), household, week, cachedReads);
  return NextResponse.json(shoppingList);
}
