import { describe, expect, it } from "vitest";
import { normalizeText, searchIngredients } from "./ingredientSearch";
import type { Ingredient } from "./types";

function ing(id: string, name: string): Ingredient {
  return { id, name, unit: "g", packageSize: 1, packagePrice: 1, shelfLifeDays: 1, category: "Autre" };
}

const LIST = [ing("1", "Crème fraîche"), ing("2", "Farine"), ing("3", "Crevettes"), ing("4", "Œufs")];

describe("normalizeText", () => {
  it("retire les accents et la casse", () => {
    expect(normalizeText("  Crème FRAÎCHE ")).toBe("creme fraiche");
  });

  it("déplie les ligatures œ et æ", () => {
    expect(normalizeText("Œufs")).toBe("oeufs");
    expect(normalizeText("Bœuf")).toBe("boeuf");
    expect(normalizeText("Æther")).toBe("aether");
  });
});

describe("searchIngredients", () => {
  it("ne renvoie rien pour une requête vide", () => {
    expect(searchIngredients(LIST, "")).toEqual([]);
    expect(searchIngredients(LIST, "   ")).toEqual([]);
  });

  it("cherche par sous-chaîne sans tenir compte des accents ni de la casse", () => {
    expect(searchIngredients(LIST, "CREME").map((i) => i.id)).toEqual(["1"]);
    expect(searchIngredients(LIST, "cre").map((i) => i.id)).toEqual(["1", "3"]);
    expect(searchIngredients(LIST, "rine").map((i) => i.id)).toEqual(["2"]);
  });

  it("trouve les ligatures avec une saisie simple", () => {
    expect(searchIngredients(LIST, "oeuf").map((i) => i.id)).toEqual(["4"]);
    expect(searchIngredients([ing("9", "Bœuf haché")], "boeuf")).toHaveLength(1);
    expect(searchIngredients(LIST, "Œuf").map((i) => i.id)).toEqual(["4"]);
  });

  it("limite le nombre de résultats", () => {
    const many = Array.from({ length: 20 }, (_, i) => ing(String(i), `Pomme ${i}`));
    expect(searchIngredients(many, "pomme")).toHaveLength(8);
    expect(searchIngredients(many, "pomme", 3)).toHaveLength(3);
  });
});
