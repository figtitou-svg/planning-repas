import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { getRecipe, updateRecipe, deleteRecipe } from "@/lib/repositories/recipes";
import { invalidSteps } from "@/lib/stepsValidation";
import { invalidateRecipes } from "@/lib/cachedReads";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const recipe = await getRecipe(getNotionClient(), (await params).id);
  if (!recipe) return new NextResponse(null, { status: 404 });
  return NextResponse.json(recipe);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (data?.favorite !== undefined && typeof data.favorite !== "boolean") {
    return NextResponse.json({ error: "favorite doit être true ou false" }, { status: 400 });
  }
  if (invalidSteps(data?.steps)) {
    return NextResponse.json({ error: "steps doit être une liste de textes" }, { status: 400 });
  }
  try {
    await updateRecipe(getNotionClient(), (await params).id, data);
  } finally {
    invalidateRecipes();
  }
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await deleteRecipe(getNotionClient(), (await params).id);
  } finally {
    invalidateRecipes();
  }
  return new NextResponse(null, { status: 204 });
}
