import { NextResponse } from "next/server";
import { HOUSEHOLDS, HOUSEHOLD_COOKIE, hasChosenHousehold, householdFromRequest } from "@/lib/households";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({
    household: householdFromRequest(request),
    chosen: hasChosenHousehold(request),
    households: HOUSEHOLDS.map(({ id, label }) => ({ id, label })),
  });
}

export async function POST(request: Request) {
  let id: unknown;
  try {
    id = ((await request.json()) as { household?: unknown }).household;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const household = HOUSEHOLDS.find((h) => h.id === id);
  if (!household) return NextResponse.json({ error: "Foyer inconnu" }, { status: 400 });
  const response = NextResponse.json({ household: household.id });
  response.cookies.set(HOUSEHOLD_COOKIE, household.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
