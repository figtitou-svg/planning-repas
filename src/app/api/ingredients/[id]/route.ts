import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { updateIngredient, deleteIngredient } from "@/lib/repositories/ingredients";
import { invalidateIngredients } from "@/lib/cachedReads";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await request.json();
  let ingredient;
  try {
    ingredient = await updateIngredient(getNotionClient(), (await params).id, data);
  } finally {
    invalidateIngredients();
  }
  return NextResponse.json(ingredient);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await deleteIngredient(getNotionClient(), (await params).id);
  } finally {
    invalidateIngredients();
  }
  return new NextResponse(null, { status: 204 });
}
