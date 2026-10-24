import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { removePlannedMeal } from "@/lib/repositories/plannedMeals";
import { invalidatePlan } from "@/lib/cachedReads";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const household = householdFromRequest(request);
  try {
    const removed = await removePlannedMeal(getNotionClient(), household, (await params).id);
    if (!removed) {
      return NextResponse.json({ error: "Recette programmée introuvable" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  } finally {
    invalidatePlan(household);
  }
}
