import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { addPantryItem } from "@/lib/repositories/pantry";
import { cachedReads, invalidatePantry, wantsFresh } from "@/lib/cachedReads";

export async function GET(request: Request) {
  const household = householdFromRequest(request);
  const items = await cachedReads.listPantry(getNotionClient(), household, wantsFresh(request));
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const household = householdFromRequest(request);
  const data = await request.json();
  let item;
  try {
    item = await addPantryItem(getNotionClient(), household, data);
  } finally {
    invalidatePantry(household);
  }
  return NextResponse.json(item, { status: 201 });
}
