import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { cachedReads, wantsFresh } from "@/lib/cachedReads";
import { buildNotifications } from "@/lib/notifications";
import { isValidDay } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const household = householdFromRequest(request);
  const requested = new URL(request.url).searchParams.get("today");
  const today =
    requested !== null && isValidDay(requested) ? requested : new Date().toISOString().slice(0, 10);
  try {
    const client = getNotionClient();
    const options = wantsFresh(request);
    const [ingredients, pantry] = await Promise.all([
      cachedReads.listIngredients(client, options),
      cachedReads.listPantry(client, household, options),
    ]);
    return NextResponse.json(buildNotifications(ingredients, pantry, today));
  } catch (e) {
    console.error("notifications: erreur interne", e instanceof Error ? e.name : typeof e);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
