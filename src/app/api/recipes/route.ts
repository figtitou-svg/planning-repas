import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { createRecipe } from "@/lib/repositories/recipes";
import { cachedReads, invalidateRecipes, wantsFresh } from "@/lib/cachedReads";

export async function GET(request: Request) {
  const recipes = await cachedReads.listRecipes(getNotionClient(), wantsFresh(request));
  return NextResponse.json(recipes);
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const portions = body?.portions === undefined ? 2 : body.portions;
  if (typeof portions !== "number" || !Number.isFinite(portions) || portions < 1) {
    return NextResponse.json({ error: "portions doit être un nombre >= 1" }, { status: 400 });
  }
  let recipe;
  try {
    recipe = await createRecipe(getNotionClient(), { ...body, portions: Math.round(portions) });
  } finally {
    invalidateRecipes();
  }
  return NextResponse.json(recipe, { status: 201 });
}
