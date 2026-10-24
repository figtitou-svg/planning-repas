import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { HOUSEHOLDS } from "@/lib/households";
import { updatePantryQuantity, removePantryItem } from "@/lib/repositories/pantry";
import { invalidatePantry } from "@/lib/cachedReads";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { quantity } = await request.json();
  let item;
  try {
    item = await updatePantryQuantity(getNotionClient(), (await params).id, quantity);
  } finally {
    // Écriture par id de page : on ne sait pas de quel foyer elle vient, on purge tous les caches.
    for (const h of HOUSEHOLDS) invalidatePantry(h.id);
  }
  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await removePantryItem(getNotionClient(), (await params).id);
  } finally {
    // Écriture par id de page : on ne sait pas de quel foyer elle vient, on purge tous les caches.
    for (const h of HOUSEHOLDS) invalidatePantry(h.id);
  }
  return new NextResponse(null, { status: 204 });
}
