import { describe, expect, it } from "vitest";
import type { NewIngredientDraft } from "./importDraft";
import { checkNewIngredientName } from "./newIngredientCheck";
import type { Ingredient } from "./types";

const CATALOG: Ingredient[] = [
  { id: "i1", name: "Oeuf", unit: "pièce", packageSize: 6, packagePrice: 2, shelfLifeDays: 20, category: "Frais" },
  { id: "i2", name: "Tomate", unit: "pièce", packageSize: 1, packagePrice: 1, shelfLifeDays: 7, category: "Légumes" },
];

const PENDING: NewIngredientDraft[] = [{ name: "Basilic", unit: "g", quantity: 0 }];

describe("checkNewIngredientName", () => {
  it("returns empty for a blank query", () => {
    expect(checkNewIngredientName("", CATALOG, [])).toEqual({ kind: "empty" });
    expect(checkNewIngredientName("   ", CATALOG, [])).toEqual({ kind: "empty" });
  });

  it("returns invalid when the name is too long", () => {
    const result = checkNewIngredientName("a".repeat(81), CATALOG, []);
    expect(result.kind).toBe("invalid");
    expect(result).toHaveProperty("message", expect.stringContaining("trop long"));
  });

  it("finds a catalogue ingredient ignoring accents, ligatures and case", () => {
    expect(checkNewIngredientName("Œufs", CATALOG, [])).toEqual({
      kind: "exists",
      ingredient: CATALOG[0],
    });
  });

  it("finds a catalogue ingredient ignoring plurals", () => {
    expect(checkNewIngredientName("tomates", CATALOG, [])).toEqual({
      kind: "exists",
      ingredient: CATALOG[1],
    });
  });

  it("does not treat a partial match as existing", () => {
    expect(checkNewIngredientName("tom", CATALOG, [])).toEqual({ kind: "ok", name: "tom" });
  });

  it("detects a duplicate in the pending list", () => {
    expect(checkNewIngredientName("basilics", CATALOG, PENDING)).toEqual({ kind: "pending" });
  });

  it("returns the trimmed, whitespace-collapsed name when ok", () => {
    expect(checkNewIngredientName("  Crème   fraîche ", CATALOG, PENDING)).toEqual({
      kind: "ok",
      name: "Crème fraîche",
    });
  });

  it("accepts a name of exactly 80 characters and rejects 81", () => {
    expect(checkNewIngredientName("a".repeat(80), CATALOG, [])).toEqual({
      kind: "ok",
      name: "a".repeat(80),
    });
    expect(checkNewIngredientName("a".repeat(81), CATALOG, []).kind).toBe("invalid");
  });

  it("measures the length after collapsing whitespace", () => {
    const query = `${"a".repeat(40)}     ${"b".repeat(36)}`;
    expect(query.length).toBeGreaterThan(80);
    expect(checkNewIngredientName(query, CATALOG, [])).toEqual({
      kind: "ok",
      name: `${"a".repeat(40)} ${"b".repeat(36)}`,
    });
  });

  it("matches a catalogue name containing a double space", () => {
    const catalog: Ingredient[] = [{ ...CATALOG[1], id: "i3", name: "Crème  fraîche" }];
    expect(checkNewIngredientName("creme fraiche", catalog, [])).toEqual({
      kind: "exists",
      ingredient: catalog[0],
    });
  });

  it("gives the catalogue precedence over the pending list", () => {
    const pending: NewIngredientDraft[] = [{ name: "tomate", unit: "g", quantity: 0 }];
    expect(checkNewIngredientName("Tomate", CATALOG, pending)).toEqual({
      kind: "exists",
      ingredient: CATALOG[1],
    });
  });

  it("treats a singular and a distinct plural catalogue name as the same ingredient", () => {
    const catalog: Ingredient[] = [{ ...CATALOG[1], id: "i4", name: "Pâtes" }];
    expect(checkNewIngredientName("Pâte", catalog, [])).toEqual({
      kind: "exists",
      ingredient: catalog[0],
    });
  });
});
