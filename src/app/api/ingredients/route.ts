import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { createIngredient } from "@/lib/repositories/ingredients";
import { cachedReads, invalidateIngredients, wantsFresh } from "@/lib/cachedReads";

export async function GET(request: Request) {
  const ingredients = await cachedReads.listIngredients(getNotionClient(), wantsFresh(request));
  return NextResponse.json(ingredients);
}

export async function POST(request: Request) {
  const data = await request.json();
  let ingredient;
  try {
    ingredient = await createIngredient(getNotionClient(), data);
  } finally {
    invalidateIngredients();
  }
  return NextResponse.json(ingredient, { status: 201 });
}
