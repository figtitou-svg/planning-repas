import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { householdFromRequest } from "@/lib/households";
import { schedulePlannedMeal } from "@/lib/repositories/plannedMeals";
import { cachedReads, invalidatePlan, wantsFresh } from "@/lib/cachedReads";

export async function GET(request: Request) {
  const household = householdFromRequest(request);
  const week = new URL(request.url).searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "Paramètre 'week' requis (YYYY-MM-DD)" }, { status: 400 });
  }
  const meals = await cachedReads.listPlannedMeals(getNotionClient(), household, week, wantsFresh(request));
  return NextResponse.json(meals);
}

export async function POST(request: Request) {
  const household = householdFromRequest(request);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const { weekStart, recipeId } = body ?? {};
  const portions = typeof body?.portions === "number" ? Math.round(body.portions) : NaN;
  if (
    typeof weekStart !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
    typeof recipeId !== "string" ||
    !recipeId ||
    !Number.isFinite(portions) ||
    portions < 1
  ) {
    return NextResponse.json(
      { error: "weekStart (YYYY-MM-DD), recipeId et portions (>= 1) requis" },
      { status: 400 }
    );
  }
  let meal;
  try {
    meal = await schedulePlannedMeal(getNotionClient(), household, { weekStart, recipeId, portions });
  } finally {
    invalidatePlan(household);
  }
  return NextResponse.json(meal, { status: 201 });
}
