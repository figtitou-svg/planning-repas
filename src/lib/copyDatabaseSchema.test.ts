import { describe, it, expect } from "vitest";
import { copyDatabaseSchema, splitDatabaseSchema } from "./copyDatabaseSchema";

describe("copyDatabaseSchema", () => {
  it("convertit chaque type en payload de création", () => {
    const result = copyDatabaseSchema({
      Nom: { id: "a", name: "Nom", type: "title", title: {} },
      Quantité: { id: "b", name: "Quantité", type: "number", number: { format: "number" } },
      Semaine: { id: "c", name: "Semaine", type: "date", date: {} },
      Coché: { id: "d", name: "Coché", type: "checkbox", checkbox: {} },
      Ingredient: {
        id: "e",
        name: "Ingredient",
        type: "relation",
        relation: { database_id: "ing-db", type: "single_property", single_property: {} },
      },
      Durée: {
        id: "f",
        name: "Durée",
        type: "rollup",
        rollup: { relation_property_name: "Ingredient", rollup_property_name: "Durée de conservation", function: "sum" },
      },
      Péremption: { id: "g", name: "Péremption", type: "formula", formula: { expression: "1+1" } },
    });
    expect(result).toEqual({
      Nom: { title: {} },
      Quantité: { number: { format: "number" } },
      Semaine: { date: {} },
      Coché: { checkbox: {} },
      Ingredient: { relation: { database_id: "ing-db", single_property: {} } },
      Durée: {
        rollup: { relation_property_name: "Ingredient", rollup_property_name: "Durée de conservation", function: "sum" },
      },
      Péremption: { formula: { expression: "1+1" } },
    });
  });

  it("refuse un type non géré", () => {
    expect(() => copyDatabaseSchema({ X: { type: "people", people: {} } })).toThrow(/people/);
  });

  it("place relations et propriétés simples avant rollup, puis formula", () => {
    const result = copyDatabaseSchema({
      F: { type: "formula", formula: { expression: "1" } },
      R: { type: "rollup", rollup: { relation_property_name: "Rel", rollup_property_name: "X", function: "sum" } },
      Rel: { type: "relation", relation: { database_id: "d", type: "single_property", single_property: {} } },
      Nom: { type: "title", title: {} },
    });
    expect(Object.keys(result)).toEqual(["Rel", "Nom", "R", "F"]);
  });

  it("sépare les formules du reste du schéma", () => {
    const { create, formulas } = splitDatabaseSchema({
      F: { type: "formula", formula: { expression: "1" } },
      Nom: { type: "title", title: {} },
    });
    expect(create).toEqual({ Nom: { title: {} } });
    expect(formulas).toEqual({ F: { formula: { expression: "1" } } });
  });
});
