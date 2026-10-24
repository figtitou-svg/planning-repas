import { describe, it, expect } from "vitest";
import { computeShoppingList } from "./shoppingList";
import type { Ingredient, PantryItem, Recipe } from "./types";

const flour: Ingredient = {
  id: "ing-flour",
  name: "Farine",
  unit: "g",
  packageSize: 1000,
  packagePrice: 1.5,
  shelfLifeDays: 365,
  category: "Épicerie",
};

const milk: Ingredient = {
  id: "ing-milk",
  name: "Lait",
  unit: "mL",
  packageSize: 1000,
  packagePrice: 1.1,
  shelfLifeDays: 7,
  category: "Produits laitiers",
};

const eggs: Ingredient = {
  id: "ing-eggs",
  name: "Œufs",
  unit: "pièce",
  packageSize: 6,
  packagePrice: 2.4,
  shelfLifeDays: 21,
  category: "Produits laitiers",
};

function recipe(name: string, ingredients: Recipe["ingredients"]): Recipe {
  return { id: `recipe-${name}`, name, portions: 2, favorite: false, ingredients };
}

function pantryItem(
  ingredientId: string,
  quantity: number,
  purchaseDate: string
): PantryItem {
  return { id: `pantry-${ingredientId}-${purchaseDate}`, ingredientId, quantity, purchaseDate };
}

describe("computeShoppingList", () => {
  const today = new Date("2026-09-16T00:00:00Z");

  it("lists everything needed when the pantry is empty", () => {
    const recipes = [recipe("crêpes", [{ ingredientId: "ing-flour", quantity: 500 }])];
    const result = computeShoppingList(recipes, [flour], [], [], today);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].lines[0]).toMatchObject({
      ingredientId: "ing-flour",
      missingQuantity: 500,
      packagesToBuy: 1,
      lineCost: 1.5,
    });
    expect(result.totalCost).toBe(1.5);
  });

  it("excludes an ingredient fully covered by non-expired pantry stock", () => {
    const recipes = [recipe("crêpes", [{ ingredientId: "ing-flour", quantity: 500 }])];
    const pantry = [pantryItem("ing-flour", 800, "2026-09-01")];
    const result = computeShoppingList(recipes, [flour], pantry, [], today);
    expect(result.groups).toHaveLength(0);
    expect(result.totalCost).toBe(0);
  });

  it("ignores expired pantry stock, treating it as unavailable", () => {
    const recipes = [recipe("omelette", [{ ingredientId: "ing-milk", quantity: 200 }])];
    // bought 2026-09-01, shelf life 7 days -> expired by 2026-09-16
    const pantry = [pantryItem("ing-milk", 1000, "2026-09-01")];
    const result = computeShoppingList(recipes, [milk], pantry, [], today);
    expect(result.groups[0].lines[0].missingQuantity).toBe(200);
  });

  it("counts non-expired pantry stock towards the need", () => {
    const recipes = [recipe("omelette", [{ ingredientId: "ing-milk", quantity: 800 }])];
    const pantry = [pantryItem("ing-milk", 500, "2026-09-15")];
    const result = computeShoppingList(recipes, [milk], pantry, [], today);
    expect(result.groups[0].lines[0].missingQuantity).toBe(300);
    expect(result.groups[0].lines[0].packagesToBuy).toBe(1);
  });

  it("rounds up to whole packages", () => {
    const recipes = [recipe("gâteau", [{ ingredientId: "ing-eggs", quantity: 8 }])];
    const result = computeShoppingList(recipes, [eggs], [], [], today);
    // needs 8 eggs, packages of 6 -> must buy 2 packages (12 eggs)
    expect(result.groups[0].lines[0].packagesToBuy).toBe(2);
    expect(result.groups[0].lines[0].lineCost).toBe(4.8);
  });

  it("aggregates the same ingredient needed by several recipes", () => {
    const recipes = [
      recipe("crêpes", [{ ingredientId: "ing-flour", quantity: 300 }]),
      recipe("gâteau", [{ ingredientId: "ing-flour", quantity: 400 }]),
    ];
    const result = computeShoppingList(recipes, [flour], [], [], today);
    expect(result.groups[0].lines[0].missingQuantity).toBe(700);
  });

  it("groups lines by category and orders groups per the given category order", () => {
    const recipes = [
      recipe("petit-déj", [
        { ingredientId: "ing-flour", quantity: 500 },
        { ingredientId: "ing-milk", quantity: 500 },
        { ingredientId: "ing-eggs", quantity: 6 },
      ]),
    ];
    const result = computeShoppingList(
      recipes,
      [flour, milk, eggs],
      [],
      ["Produits laitiers", "Épicerie"],
      today
    );
    expect(result.groups.map((g) => g.category)).toEqual(["Produits laitiers", "Épicerie"]);
    expect(result.groups[0].lines.map((l) => l.ingredientId).sort()).toEqual(
      ["ing-eggs", "ing-milk"].sort()
    );
  });

  it("puts categories absent from categoryOrder last", () => {
    const recipes = [
      recipe("petit-déj", [
        { ingredientId: "ing-flour", quantity: 500 },
        { ingredientId: "ing-milk", quantity: 500 },
      ]),
    ];
    const result = computeShoppingList(
      recipes,
      [flour, milk],
      [],
      ["Produits laitiers"],
      today
    );
    expect(result.groups.map((g) => g.category)).toEqual(["Produits laitiers", "Épicerie"]);
  });

  it("computes a subtotal per group and a grand total", () => {
    const recipes = [
      recipe("petit-déj", [
        { ingredientId: "ing-milk", quantity: 500 },
        { ingredientId: "ing-eggs", quantity: 6 },
      ]),
    ];
    const result = computeShoppingList(recipes, [milk, eggs], [], [], today);
    expect(result.groups[0].subtotal).toBeCloseTo(1.1 + 2.4, 5);
    expect(result.totalCost).toBeCloseTo(1.1 + 2.4, 5);
  });

  it("returns an empty list when no recipes are planned", () => {
    const result = computeShoppingList([], [flour, milk, eggs], [], [], today);
    expect(result.groups).toHaveLength(0);
    expect(result.totalCost).toBe(0);
  });

  it("excludes an ingredient with a package size of 0 instead of crashing", () => {
    const brokenIngredient: Ingredient = { ...flour, id: "ing-broken", packageSize: 0 };
    const recipes = [recipe("crêpes", [{ ingredientId: "ing-broken", quantity: 500 }])];
    const result = computeShoppingList(recipes, [brokenIngredient], [], [], today);
    expect(result.groups).toHaveLength(0);
    expect(result.totalCost).toBe(0);
    expect(Number.isFinite(result.totalCost)).toBe(true);
  });

  describe("expiry boundary (calendar day rule)", () => {
    const recipes = [recipe("omelette", [{ ingredientId: "ing-milk", quantity: 200 }])];

    it("still counts stock on its expiry day, whatever the time of day", () => {
      // bought 2026-09-09, shelf life 7 days -> expiry day 2026-09-16 (= today)
      const pantry = [pantryItem("ing-milk", 1000, "2026-09-09")];
      const evening = new Date("2026-09-16T23:30:00Z");
      expect(computeShoppingList(recipes, [milk], pantry, [], evening).groups).toHaveLength(0);
    });

    it("treats stock as expired the day after its expiry day", () => {
      const pantry = [pantryItem("ing-milk", 1000, "2026-09-08")];
      expect(computeShoppingList(recipes, [milk], pantry, [], today).groups).toHaveLength(1);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, 1e12])(
      "keeps counting stock whose shelf life is unusable (%s) without throwing",
      (shelfLifeDays) => {
        const odd = { ...milk, shelfLifeDays };
        const pantry = [pantryItem("ing-milk", 1000, "2026-01-01")];
        expect(computeShoppingList(recipes, [odd], pantry, [], today).groups).toHaveLength(0);
      }
    );

    it("keeps counting stock whose purchase date is empty", () => {
      const pantry = [pantryItem("ing-milk", 1000, "")];
      expect(computeShoppingList(recipes, [milk], pantry, [], today).groups).toHaveLength(0);
    });
  });

  describe("articles ajoutés à la main", () => {
    const extra = (ingredientId: string, quantity: number | null = null) => ({ ingredientId, quantity });

    const sriracha: Ingredient = {
      id: "ing-sriracha",
      name: "Sriracha",
      unit: "pièce",
      packageSize: 0,
      packagePrice: 0,
      shelfLifeDays: 0,
      category: "Autre",
    };

    it("lists a manual item with one package and its price", () => {
      const result = computeShoppingList([], [milk], [], [], today, [extra("ing-milk")]);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].lines[0]).toMatchObject({
        ingredientId: "ing-milk",
        manual: true,
        packagesToBuy: 1,
        missingQuantity: 1000,
        lineCost: 1.1,
      });
      expect(result.groups[0].lines[0].incomplete).toBeUndefined();
      expect(result.totalCost).toBe(1.1);
    });

    it("keeps a manual item whose package size and price are unknown, flagged incomplete", () => {
      const result = computeShoppingList([], [sriracha], [], [], today, [extra("ing-sriracha")]);
      expect(result.groups[0].lines[0]).toMatchObject({
        ingredientId: "ing-sriracha",
        manual: true,
        incomplete: true,
        packagesToBuy: 1,
        missingQuantity: 0,
        lineCost: 0,
      });
      expect(result.totalCost).toBe(0);
    });

    it("does not list an item twice when a recipe already needs it", () => {
      const recipes = [recipe("crêpes", [{ ingredientId: "ing-milk", quantity: 500 }])];
      const result = computeShoppingList(recipes, [milk], [], [], today, [extra("ing-milk")]);
      const lines = result.groups.flatMap((g) => g.lines);
      expect(lines).toHaveLength(1);
      expect(lines[0].manual).toBeUndefined();
      expect(lines[0].missingQuantity).toBe(500);
    });

    it("lists a manual item even when the pantry covers the recipe need", () => {
      const recipes = [recipe("crêpes", [{ ingredientId: "ing-milk", quantity: 500 }])];
      const pantry = [pantryItem("ing-milk", 1000, "2026-09-15")];
      const result = computeShoppingList(recipes, [milk], pantry, [], today, [extra("ing-milk")]);
      expect(result.groups[0].lines[0]).toMatchObject({ ingredientId: "ing-milk", manual: true });
    });

    it("ignores duplicate ids and ingredients that left the catalogue", () => {
      const result = computeShoppingList([], [milk], [], [], today, [
        extra("ing-milk"),
        extra("ing-milk"),
        extra("ing-gone"),
      ]);
      expect(result.groups.flatMap((g) => g.lines)).toHaveLength(1);
    });

    it("adds a typed quantity to what the recipes already need", () => {
      const recipes = [recipe("pâtes", [{ ingredientId: "ing-flour", quantity: 300 }])];
      const result = computeShoppingList(recipes, [flour], [], [], today, [extra("ing-flour", 900)]);
      const lines = result.groups.flatMap((g) => g.lines);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        ingredientId: "ing-flour",
        manual: true,
        missingQuantity: 1200,
        packagesToBuy: 2,
        lineCost: 3,
      });
    });

    it("takes the pantry off the combined need", () => {
      const recipes = [recipe("pâtes", [{ ingredientId: "ing-flour", quantity: 300 }])];
      const pantry = [pantryItem("ing-flour", 400, "2026-09-15")];
      const result = computeShoppingList(recipes, [flour], pantry, [], today, [extra("ing-flour", 900)]);
      expect(result.groups[0].lines[0]).toMatchObject({ missingQuantity: 800, packagesToBuy: 1 });
    });

    it("buys the typed quantity of an item no recipe needs, rounded up to whole packages", () => {
      const result = computeShoppingList([], [eggs], [], [], today, [extra("ing-eggs", 7)]);
      expect(result.groups[0].lines[0]).toMatchObject({
        ingredientId: "ing-eggs",
        manual: true,
        missingQuantity: 7,
        packagesToBuy: 2,
        lineCost: 4.8,
      });
      expect(result.groups[0].lines[0].incomplete).toBeUndefined();
    });

    it("keeps the typed quantity on an item whose package is still unknown", () => {
      const result = computeShoppingList([], [sriracha], [], [], today, [extra("ing-sriracha", 3)]);
      expect(result.groups[0].lines[0]).toMatchObject({
        manual: true,
        incomplete: true,
        missingQuantity: 3,
        packagesToBuy: 1,
        lineCost: 0,
      });
    });

    it("adds the typed quantity to the recipes' need even when the package is unknown", () => {
      const recipes = [recipe("sauce", [{ ingredientId: "ing-sriracha", quantity: 2 }])];
      const result = computeShoppingList(recipes, [sriracha], [], [], today, [extra("ing-sriracha", 3)]);
      expect(result.groups[0].lines[0]).toMatchObject({ incomplete: true, missingQuantity: 5 });
    });

    it("still lists the item when the pantry covers the typed quantity", () => {
      const pantry = [pantryItem("ing-flour", 5000, "2026-09-15")];
      const result = computeShoppingList([], [flour], pantry, [], today, [extra("ing-flour", 500)]);
      expect(result.groups[0].lines[0]).toMatchObject({ ingredientId: "ing-flour", manual: true, packagesToBuy: 1 });
    });

    it("exposes the typed quantity on the line so it can be edited", () => {
      const recipes = [recipe("pâtes", [{ ingredientId: "ing-flour", quantity: 300 }])];
      const combined = computeShoppingList(recipes, [flour], [], [], today, [extra("ing-flour", 900)]);
      expect(combined.groups[0].lines[0].extraQuantity).toBe(900);

      const alone = computeShoppingList([], [sriracha], [], [], today, [extra("ing-sriracha", 3)]);
      expect(alone.groups[0].lines[0].extraQuantity).toBe(3);
    });

    it("has no extraQuantity without a typed quantity", () => {
      const result = computeShoppingList([], [milk], [], [], today, [extra("ing-milk"), ]);
      expect(result.groups[0].lines[0].extraQuantity).toBeUndefined();
    });

    it("treats a zero quantity like no quantity", () => {
      const result = computeShoppingList([], [milk], [], [], today, [extra("ing-milk", 0)]);
      expect(result.groups[0].lines[0]).toMatchObject({ missingQuantity: 1000, packagesToBuy: 1 });
    });

    it("places manual items in their category group, in category order", () => {
      const result = computeShoppingList(
        [recipe("crêpes", [{ ingredientId: "ing-flour", quantity: 500 }])],
        [flour, milk],
        [],
        ["Épicerie", "Produits laitiers"],
        today,
        [extra("ing-milk")]
      );
      expect(result.groups.map((g) => g.category)).toEqual(["Épicerie", "Produits laitiers"]);
    });
  });
});
