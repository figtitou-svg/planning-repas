import { describe, it, expect, vi, beforeEach } from "vitest";

const schedulePlannedMeal = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/plannedMeals", () => ({
  listPlannedMeals: vi.fn(),
  schedulePlannedMeal: (...args: unknown[]) => schedulePlannedMeal(...args),
}));

const listPlannedMeals = vi.fn();
vi.mock("@/lib/cachedReads", () => ({
  cachedReads: { listPlannedMeals: (...args: unknown[]) => listPlannedMeals(...args) },
  invalidatePlan: vi.fn(),
  wantsFresh: () => false,
}));

import { GET, POST } from "./route";

function post(body: unknown, raw = false) {
  return POST(
    new Request("http://localhost/api/plan", {
      method: "POST",
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
}

describe("POST /api/plan", () => {
  beforeEach(() => {
    schedulePlannedMeal.mockReset();
    schedulePlannedMeal.mockImplementation(async (_client, data) => ({ id: "m1", ...data }));
  });

  it("creates a planned meal and rounds portions", async () => {
    const response = await post({ weekStart: "2026-09-21", recipeId: "r1", portions: 2.6 });

    expect(response.status).toBe(201);
    expect(schedulePlannedMeal).toHaveBeenCalledWith(
      {},
      "household-1",
      { weekStart: "2026-09-21", recipeId: "r1", portions: 3 }
    );
  });

  it.each([
    [{ weekStart: "21/09/2026", recipeId: "r1", portions: 2 }],
    [{ weekStart: "2026-09-21", recipeId: "", portions: 2 }],
    [{ weekStart: "2026-09-21", recipeId: "r1", portions: 0 }],
    [{ weekStart: "2026-09-21", recipeId: "r1", portions: "2" }],
    [{ weekStart: "2026-09-21", recipeId: "r1" }],
  ])("rejects invalid body %j", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(schedulePlannedMeal).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    expect((await post("{nope", true)).status).toBe(400);
  });

  it("écrit dans le foyer du cookie (household-2)", async () => {
    await POST(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { cookie: "household=household-2" },
        body: JSON.stringify({ weekStart: "2026-09-21", recipeId: "r1", portions: 2 }),
      })
    );

    expect(schedulePlannedMeal).toHaveBeenCalledWith({}, "household-2", expect.anything());
  });
});

describe("GET /api/plan", () => {
  it("lit le foyer du cookie (household-2)", async () => {
    listPlannedMeals.mockReset().mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/plan?week=2026-09-21", { headers: { cookie: "household=household-2" } })
    );

    expect(response.status).toBe(200);
    expect(listPlannedMeals).toHaveBeenCalledWith({}, "household-2", "2026-09-21", false);
  });
});
