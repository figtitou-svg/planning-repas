import { describe, it, expect } from "vitest";
import { buildNotifications } from "./notifications";
import type { Ingredient, PantryItem } from "./types";

function ingredient(overrides: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    name: overrides.id,
    unit: "g",
    packageSize: 100,
    packagePrice: 1,
    shelfLifeDays: 5,
    category: "Épicerie",
    ...overrides,
  };
}

function item(
  ingredientId: string,
  purchaseDate: string,
  quantity = 100,
  id = `p-${ingredientId}-${purchaseDate}`
): PantryItem {
  return { id, ingredientId, quantity, purchaseDate };
}

const TODAY = "2026-09-19";

describe("buildNotifications - expiring", () => {
  const milk = ingredient({ id: "milk", name: "Lait", shelfLifeDays: 5 });

  it("includes an item expiring in 3 days", () => {
    const { expiring } = buildNotifications([milk], [item("milk", "2026-09-17")], TODAY);
    expect(expiring).toEqual([
      {
        pantryId: "p-milk-2026-09-17",
        ingredientId: "milk",
        name: "Lait",
        quantity: 100,
        unit: "g",
        expiryDay: "2026-09-22",
        daysLeft: 3,
      },
    ]);
  });

  it("excludes an item expiring in 4 days", () => {
    const { expiring } = buildNotifications([milk], [item("milk", "2026-09-18")], TODAY);
    expect(expiring).toEqual([]);
  });

  it("reports daysLeft 0 for an item expiring today", () => {
    const { expiring } = buildNotifications([milk], [item("milk", "2026-09-14")], TODAY);
    expect(expiring[0].daysLeft).toBe(0);
  });

  it("reports a negative daysLeft for an expired item", () => {
    const { expiring } = buildNotifications([milk], [item("milk", "2026-09-12")], TODAY);
    expect(expiring[0].daysLeft).toBe(-2);
    expect(expiring[0].expiryDay).toBe("2026-09-17");
  });

  it("excludes ingredients with shelfLifeDays 0", () => {
    const salt = ingredient({ id: "salt", shelfLifeDays: 0 });
    const { expiring } = buildNotifications([salt], [item("salt", "2026-01-01")], TODAY);
    expect(expiring).toEqual([]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1e12])(
    "excludes ingredients with an unusable shelfLifeDays (%s) without throwing",
    (shelfLifeDays) => {
      const odd = ingredient({ id: "odd", shelfLifeDays });
      const { expiring } = buildNotifications([odd], [item("odd", "2026-01-01")], TODAY);
      expect(expiring).toEqual([]);
    }
  );

  it("excludes items with quantity 0", () => {
    const { expiring } = buildNotifications([milk], [item("milk", "2026-09-14", 0)], TODAY);
    expect(expiring).toEqual([]);
  });

  it("ignores items whose ingredient was removed from the catalogue", () => {
    const { expiring, count } = buildNotifications([], [item("ghost", "2026-09-01")], TODAY);
    expect(expiring).toEqual([]);
    expect(count).toBe(0);
  });

  it("ignores items with an empty or invalid purchase date without crashing", () => {
    const { expiring } = buildNotifications(
      [milk],
      [item("milk", "", 100, "a"), item("milk", "pas une date", 100, "b")],
      TODAY
    );
    expect(expiring).toEqual([]);
  });

  it("sorts by daysLeft ascending", () => {
    const { expiring } = buildNotifications(
      [milk],
      [
        item("milk", "2026-09-17", 100, "soon"),
        item("milk", "2026-09-10", 100, "expired"),
        item("milk", "2026-09-14", 100, "today"),
      ],
      TODAY
    );
    expect(expiring.map((e) => e.pantryId)).toEqual(["expired", "today", "soon"]);
  });

  it("handles month boundaries", () => {
    const { expiring } = buildNotifications([milk], [item("milk", "2026-09-28")], "2026-10-02");
    expect(expiring[0]).toMatchObject({ expiryDay: "2026-10-03", daysLeft: 1 });
  });
});

describe("buildNotifications - incomplete", () => {
  it("lists incomplete ingredients sorted by name with Notion url", () => {
    const { incomplete } = buildNotifications(
      [
        ingredient({ id: "aaaa-bbbb-cccc", name: "Zaatar", packageSize: 0 }),
        ingredient({ id: "dddd-eeee", name: "Ail", packagePrice: 0, shelfLifeDays: 0 }),
        ingredient({ id: "full", name: "Farine" }),
        ingredient({ id: "ffff", name: "Échalote", packageSize: 0 }),
      ],
      [],
      TODAY
    );
    expect(incomplete.map((i) => i.name)).toEqual(["Ail", "Échalote", "Zaatar"]);
    expect(incomplete[0]).toEqual({
      ingredientId: "dddd-eeee",
      name: "Ail",
      missing: ["packagePrice", "shelfLifeDays"],
      notionUrl: "https://www.notion.so/ddddeeee",
    });
    expect(incomplete[2].notionUrl).toBe("https://www.notion.so/aaaabbbbcccc");
  });

  it("counts expiring and incomplete together", () => {
    const milk = ingredient({ id: "milk", name: "Lait", shelfLifeDays: 5 });
    const raw = ingredient({ id: "raw", name: "Cru", packageSize: 0 });
    const result = buildNotifications([milk, raw], [item("milk", "2026-09-14")], TODAY);
    expect(result.expiring).toHaveLength(1);
    expect(result.incomplete).toHaveLength(1);
    expect(result.count).toBe(2);
  });
});
