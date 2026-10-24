import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { notionConfig } from "./notionConfig";

const ENV_KEYS = [
  "NOTION_TOKEN",
  "NOTION_INGREDIENTS_DB_ID",
  "NOTION_RECIPES_DB_ID",
  "NOTION_RECIPE_INGREDIENTS_DB_ID",
  "NOTION_PANTRY_DB_ID",
  "NOTION_WEEKLY_PLAN_DB_ID",
  "NOTION_SHOPPING_CHECKS_DB_ID",
  "NOTION_PANTRY_DB_ID_2",
  "NOTION_WEEKLY_PLAN_DB_ID_2",
  "NOTION_SHOPPING_CHECKS_DB_ID_2",
  "GEMINI_API_KEY",
] as const;

describe("notionConfig", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("throws a clear error when NOTION_TOKEN is missing", () => {
    expect(() => notionConfig.token()).toThrow("NOTION_TOKEN");
  });

  it("returns the token when set", () => {
    process.env.NOTION_TOKEN = "secret_abc";
    expect(notionConfig.token()).toBe("secret_abc");
  });

  it("throws for each missing database id with its own env var name", () => {
    expect(() => notionConfig.ingredientsDbId()).toThrow("NOTION_INGREDIENTS_DB_ID");
    expect(() => notionConfig.recipesDbId()).toThrow("NOTION_RECIPES_DB_ID");
    expect(() => notionConfig.recipeIngredientsDbId()).toThrow(
      "NOTION_RECIPE_INGREDIENTS_DB_ID"
    );
    expect(() => notionConfig.pantryDbId("household-1")).toThrow("NOTION_PANTRY_DB_ID");
    expect(() => notionConfig.weeklyPlanDbId("household-1")).toThrow("NOTION_WEEKLY_PLAN_DB_ID");
    expect(() => notionConfig.shoppingChecksDbId("household-1")).toThrow("NOTION_SHOPPING_CHECKS_DB_ID");
  });

  it("throws a clear error when GEMINI_API_KEY is missing", () => {
    expect(() => notionConfig.geminiApiKey()).toThrow(
      "Variable d'environnement manquante : GEMINI_API_KEY"
    );
  });

  it("returns the Gemini key when set", () => {
    process.env.GEMINI_API_KEY = "fake-gemini-key";
    expect(notionConfig.geminiApiKey()).toBe("fake-gemini-key");
  });

  it("returns database ids when set", () => {
    process.env.NOTION_INGREDIENTS_DB_ID = "db-ingredients";
    expect(notionConfig.ingredientsDbId()).toBe("db-ingredients");
  });

  it("résout les bases de chaque foyer avec son suffixe", () => {
    process.env.NOTION_PANTRY_DB_ID = "p1";
    process.env.NOTION_PANTRY_DB_ID_2 = "p2";
    process.env.NOTION_WEEKLY_PLAN_DB_ID_2 = "w2";
    process.env.NOTION_SHOPPING_CHECKS_DB_ID_2 = "s2";
    expect(notionConfig.pantryDbId("household-1")).toBe("p1");
    expect(notionConfig.pantryDbId("household-2")).toBe("p2");
    expect(notionConfig.weeklyPlanDbId("household-2")).toBe("w2");
    expect(notionConfig.shoppingChecksDbId("household-2")).toBe("s2");
  });

  it("nomme la variable manquante du foyer 2", () => {
    expect(() => notionConfig.pantryDbId("household-2")).toThrow("NOTION_PANTRY_DB_ID_2");
  });
});
