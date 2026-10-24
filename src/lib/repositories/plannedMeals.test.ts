import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "@notionhq/client";
import { listPlannedMeals, schedulePlannedMeal, removePlannedMeal } from "./plannedMeals";

vi.mock("../notionConfig", () => ({
  notionConfig: { weeklyPlanDbId: (household: string) => (household === "household-2" ? "db-weekly-plan-2" : "db-weekly-plan") },
}));

function mealPage(id: string, weekStart: string, recipeId: string | null, portions: number | null) {
  return {
    id,
    properties: {
      Semaine: { date: { start: weekStart } },
      Recipe: { relation: recipeId ? [{ id: recipeId }] : [] },
      Portions: { number: portions },
    },
  };
}

function fakeClient(): Client {
  return {
    databases: { query: vi.fn() },
    pages: {
      create: vi.fn(),
      update: vi.fn(),
      retrieve: vi.fn().mockResolvedValue({ parent: { database_id: "db-weekly-plan" } }),
    },
  } as unknown as Client;
}

describe("plannedMeals repository", () => {
  let client: Client;

  beforeEach(() => {
    client = fakeClient();
  });

  it("interroge la base du foyer 2", async () => {
    (client.databases.query as any).mockResolvedValue({ results: [], has_more: false, next_cursor: null });

    await listPlannedMeals(client, "household-2", "2026-09-14");

    expect(client.databases.query).toHaveBeenCalledWith(
      expect.objectContaining({ database_id: "db-weekly-plan-2" })
    );
  });

  it("lists the planned meals of a week", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [
        mealPage("meal-1", "2026-09-14", "recipe-1", 4),
        mealPage("meal-2", "2026-09-14", "recipe-2", null),
      ],
      has_more: false,
      next_cursor: null,
    });

    const result = await listPlannedMeals(client, "household-1", "2026-09-14");

    expect(result).toEqual([
      { id: "meal-1", weekStart: "2026-09-14", recipeId: "recipe-1", portions: 4 },
      { id: "meal-2", weekStart: "2026-09-14", recipeId: "recipe-2", portions: 0 },
    ]);
    expect(client.databases.query).toHaveBeenCalledWith({
      database_id: "db-weekly-plan",
      start_cursor: undefined,
      filter: { property: "Semaine", date: { equals: "2026-09-14" } },
    });
  });

  it("ignores legacy rows without a Recipe relation", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [
        mealPage("legacy", "2026-09-14", null, null),
        mealPage("meal-1", "2026-09-14", "recipe-1", 2),
      ],
      has_more: false,
      next_cursor: null,
    });

    const result = await listPlannedMeals(client, "household-1", "2026-09-14");

    expect(result.map((m) => m.id)).toEqual(["meal-1"]);
  });

  it("follows pagination", async () => {
    (client.databases.query as any)
      .mockResolvedValueOnce({
        results: [mealPage("meal-1", "2026-09-14", "recipe-1", 2)],
        has_more: true,
        next_cursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        results: [mealPage("meal-2", "2026-09-14", "recipe-2", 2)],
        has_more: false,
        next_cursor: null,
      });

    const result = await listPlannedMeals(client, "household-1", "2026-09-14");

    expect(result.map((m) => m.id)).toEqual(["meal-1", "meal-2"]);
    expect((client.databases.query as any).mock.calls[1][0].start_cursor).toBe("cursor-2");
  });

  it("creates a page for a scheduled meal", async () => {
    (client.pages.create as any).mockResolvedValue(mealPage("new-meal", "2026-09-21", "recipe-3", 6));

    const result = await schedulePlannedMeal(client, "household-1", {
      weekStart: "2026-09-21",
      recipeId: "recipe-3",
      portions: 6,
    });

    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-weekly-plan" },
      properties: {
        Semaine: { date: { start: "2026-09-21" } },
        Recipe: { relation: [{ id: "recipe-3" }] },
        Portions: { number: 6 },
      },
    });
    expect(result).toEqual({
      id: "new-meal",
      weekStart: "2026-09-21",
      recipeId: "recipe-3",
      portions: 6,
    });
  });

  it("tolerates pages with missing properties", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [{ id: "odd", properties: {} }, { id: "odd-2" }],
      has_more: false,
      next_cursor: null,
    });

    expect(await listPlannedMeals(client, "household-1", "2026-09-14")).toEqual([]);
  });

  it("archives the page when removing a planned meal", async () => {
    const removed = await removePlannedMeal(client, "household-1", "meal-1");

    expect(removed).toBe(true);
    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "meal-1", archived: true });
  });

  it("foyer 2 : refuse une page de la base du foyer 1", async () => {
    (client.pages.retrieve as any).mockResolvedValue({ parent: { database_id: "db-weekly-plan" } });

    expect(await removePlannedMeal(client, "household-2", "meal-1")).toBe(false);
    expect(client.pages.update).not.toHaveBeenCalled();
  });

  it("foyer 2 : archive une page de sa propre base", async () => {
    (client.pages.retrieve as any).mockResolvedValue({ parent: { database_id: "db-weekly-plan-2" } });

    expect(await removePlannedMeal(client, "household-2", "meal-1")).toBe(true);
    expect(client.pages.update).toHaveBeenCalledWith({ page_id: "meal-1", archived: true });
  });

  it("accepts a database id written with dashes", async () => {
    (client.pages.retrieve as any).mockResolvedValue({
      parent: { database_id: "db-weekly-plan".replace(/-/g, "") },
    });

    expect(await removePlannedMeal(client, "household-1", "meal-1")).toBe(true);
  });

  it("refuses to archive a page of another database", async () => {
    (client.pages.retrieve as any).mockResolvedValue({ parent: { database_id: "db-recipes" } });

    expect(await removePlannedMeal(client, "household-1", "recipe-1")).toBe(false);
    expect(client.pages.update).not.toHaveBeenCalled();
  });

  it("returns false when the page does not exist", async () => {
    (client.pages.retrieve as any).mockRejectedValue({ code: "object_not_found" });

    expect(await removePlannedMeal(client, "household-1", "ghost")).toBe(false);
    expect(client.pages.update).not.toHaveBeenCalled();
  });

  it("rethrows unexpected errors from Notion", async () => {
    (client.pages.retrieve as any).mockRejectedValue({ code: "internal_server_error" });

    await expect(removePlannedMeal(client, "household-1", "meal-1")).rejects.toEqual({
      code: "internal_server_error",
    });
  });

  it("does not update an already archived page", async () => {
    (client.pages.retrieve as any).mockResolvedValue({
      archived: true,
      parent: { database_id: "db-weekly-plan" },
    });

    expect(await removePlannedMeal(client, "household-1", "meal-1")).toBe(true);
    expect(client.pages.update).not.toHaveBeenCalled();
  });
});
