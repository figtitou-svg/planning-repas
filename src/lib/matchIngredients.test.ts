import { describe, expect, it } from "vitest";
import { matchIngredients, normalizeName } from "./matchIngredients";
import type { Ingredient, Unit } from "./types";

function ing(id: string, name: string, unit: Unit = "g"): Ingredient {
  return { id, name, unit, packageSize: 1, packagePrice: 1, shelfLifeDays: 1, category: "Autre" };
}

const CATALOG = [
  ing("1", "Œuf", "pièce"),
  ing("2", "Pâtes"),
  ing("3", "Crème fraîche", "mL"),
  ing("4", "Tomate", "pièce"),
];

describe("normalizeName", () => {
  it("met en minuscules, retire les accents et déplie œ/æ", () => {
    expect(normalizeName("Crème FRAÎCHE")).toBe("creme fraiche");
    expect(normalizeName("bœuf")).toBe("boeuf");
    expect(normalizeName("Æther")).toBe("aether");
  });

  it("retire les espaces superflus", () => {
    expect(normalizeName("  crème   fraîche  ")).toBe("creme fraiche");
  });

  it("retire un s ou x final quand la longueur dépasse 3", () => {
    expect(normalizeName("œufs")).toBe("oeuf");
    expect(normalizeName("pâtes")).toBe("pate");
    expect(normalizeName("choux")).toBe("chou");
    expect(normalizeName("Tomates")).toBe("tomate");
  });

  it("ne touche pas aux mots de 3 caractères ou moins", () => {
    expect(normalizeName("gus")).toBe("gus");
    expect(normalizeName("riz")).toBe("riz");
    expect(normalizeName("ail")).toBe("ail");
  });

  it("ne retire qu'une seule lettre", () => {
    expect(normalizeName("pois")).toBe("poi");
    expect(normalizeName("noixs")).toBe("noix");
  });
});

describe("matchIngredients", () => {
  it("associe malgré accents, casse, pluriel et ligature", () => {
    const { matched, created } = matchIngredients(
      [
        { name: "oeufs", quantity: 3, unit: "pièce" },
        { name: "PATES", quantity: 200, unit: "g" },
        { name: "creme fraiche", quantity: 150, unit: "mL" },
      ],
      CATALOG
    );

    expect(matched).toEqual([
      { ingredientId: "1", quantity: 3 },
      { ingredientId: "2", quantity: 200 },
      { ingredientId: "3", quantity: 150 },
    ]);
    expect(created).toEqual([]);
  });

  it("fusionne deux lignes pointant le même ingrédient", () => {
    const { matched } = matchIngredients(
      [
        { name: "tomate", quantity: 2, unit: "pièce" },
        { name: "Tomates", quantity: 1, unit: "pièce" },
      ],
      CATALOG
    );

    expect(matched).toEqual([{ ingredientId: "4", quantity: 3 }]);
  });

  it("marque unitMismatch quand l'unité importée diffère de celle du catalogue", () => {
    const { matched } = matchIngredients([{ name: "tomate", quantity: 200, unit: "g" }], CATALOG);

    expect(matched).toEqual([{ ingredientId: "4", quantity: 200, unitMismatch: true }]);
  });

  it("conserve unitMismatch quand une seule des lignes fusionnées diffère", () => {
    const { matched } = matchIngredients(
      [
        { name: "tomate", quantity: 2, unit: "pièce" },
        { name: "tomates", quantity: 100, unit: "g" },
      ],
      CATALOG
    );

    expect(matched).toEqual([{ ingredientId: "4", quantity: 102, unitMismatch: true }]);
  });

  it("n'ajoute pas unitMismatch quand les unités concordent", () => {
    const { matched } = matchIngredients([{ name: "pâtes", quantity: 1, unit: "g" }], CATALOG);

    expect(matched[0]).not.toHaveProperty("unitMismatch");
  });

  it("crée les ingrédients inconnus", () => {
    const { matched, created } = matchIngredients(
      [{ name: "  Basilic  frais ", quantity: 5, unit: "g" }],
      CATALOG
    );

    expect(matched).toEqual([]);
    expect(created).toEqual([{ name: "Basilic frais", unit: "g", quantity: 5 }]);
  });

  it("dédoublonne les ingrédients inconnus par nom normalisé", () => {
    const { created } = matchIngredients(
      [
        { name: "Échalote", quantity: 1, unit: "pièce" },
        { name: "échalotes", quantity: 2, unit: "pièce" },
        { name: "basilic", quantity: 0, unit: "g" },
      ],
      CATALOG
    );

    expect(created).toEqual([
      { name: "Échalote", unit: "pièce", quantity: 3 },
      { name: "basilic", unit: "g", quantity: 0 },
    ]);
  });

  it("ne mélange pas les quantités d'unités différentes pour un même inconnu", () => {
    const { created } = matchIngredients(
      [
        { name: "basilic", quantity: 5, unit: "g" },
        { name: "basilic", quantity: 2, unit: "pièce" },
      ],
      CATALOG
    );

    expect(created).toEqual([{ name: "basilic", unit: "g", quantity: 5, unitMismatch: true }]);
  });

  it("n'ajoute pas unitMismatch aux inconnus fusionnés dans la même unité", () => {
    const { created } = matchIngredients(
      [
        { name: "basilic", quantity: 5, unit: "g" },
        { name: "basilics", quantity: 2, unit: "g" },
      ],
      CATALOG
    );

    expect(created).toEqual([{ name: "basilic", unit: "g", quantity: 7 }]);
  });

  it("garde des quantités positives ou nulles", () => {
    const { matched, created } = matchIngredients(
      [
        { name: "pâtes", quantity: 0, unit: "g" },
        { name: "sel", quantity: 0, unit: "g" },
      ],
      CATALOG
    );

    expect(matched[0].quantity).toBe(0);
    expect(created[0].quantity).toBe(0);
  });

  it("retient le premier ingrédient du catalogue en cas de noms équivalents", () => {
    const { matched } = matchIngredients(
      [{ name: "pâtes", quantity: 1, unit: "g" }],
      [ing("a", "Pâtes"), ing("b", "pate")]
    );

    expect(matched).toEqual([{ ingredientId: "a", quantity: 1 }]);
  });

  it("gère un catalogue et une liste vides", () => {
    expect(matchIngredients([], [])).toEqual({ matched: [], created: [] });
  });
});
