import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { setCheck } from "@/lib/repositories/shoppingChecks";
import { cachedReads, invalidateChecks, wantsFresh } from "@/lib/cachedReads";

export async function GET(request: Request) {
  const household = householdFromRequest(request);
  const week = new URL(request.url).searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "Paramètre 'week' requis (YYYY-MM-DD)" }, { status: 400 });
  }
  const checks = await cachedReads.listChecks(getNotionClient(), household, week, wantsFresh(request));
  return NextResponse.json(checks);
}

export async function PUT(request: Request) {
  const household = householdFromRequest(request);
  const { weekStart, ingredientId, checked } = await request.json();
  try {
    await setCheck(getNotionClient(), household, weekStart, ingredientId, checked);
  } finally {
    invalidateChecks(household, weekStart);
  }
  return new NextResponse(null, { status: 204 });
}
