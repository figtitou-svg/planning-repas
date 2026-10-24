import { describe, it, expect } from "vitest";
import { parseExtraItem } from "./parseExtraItem";

describe("parseExtraItem", () => {
  it("leaves a plain name without quantity", () => {
    expect(parseExtraItem("Sauce sriracha")).toEqual({ name: "Sauce sriracha", quantity: null, unit: null });
  });

  it("reads a quantity, a unit and the name", () => {
    expect(parseExtraItem("500 g farine")).toEqual({ name: "farine", quantity: 500, unit: "g" });
    expect(parseExtraItem("500g de farine")).toEqual({ name: "farine", quantity: 500, unit: "g" });
  });

  it("converts kg to g and litres, dl, cl to mL", () => {
    expect(parseExtraItem("2 kg riz")).toEqual({ name: "riz", quantity: 2000, unit: "g" });
    expect(parseExtraItem("1,5 l lait")).toEqual({ name: "lait", quantity: 1500, unit: "mL" });
    expect(parseExtraItem("1 litre de lait")).toEqual({ name: "lait", quantity: 1000, unit: "mL" });
    expect(parseExtraItem("50 cl crème")).toEqual({ name: "crème", quantity: 500, unit: "mL" });
    expect(parseExtraItem("2 dl jus")).toEqual({ name: "jus", quantity: 200, unit: "mL" });
    expect(parseExtraItem("250 ml lait")).toEqual({ name: "lait", quantity: 250, unit: "mL" });
  });

  it("counts a bare number as pieces", () => {
    expect(parseExtraItem("6 œufs")).toEqual({ name: "œufs", quantity: 6, unit: "pièce" });
    expect(parseExtraItem("2x yaourts")).toEqual({ name: "yaourts", quantity: 2, unit: "pièce" });
    expect(parseExtraItem("3 pièces de pain")).toEqual({ name: "pain", quantity: 3, unit: "pièce" });
  });

  it("does not take the start of a word for a unit", () => {
    expect(parseExtraItem("2 grosses tomates")).toEqual({ name: "grosses tomates", quantity: 2, unit: "pièce" });
    expect(parseExtraItem("3 lardons")).toEqual({ name: "lardons", quantity: 3, unit: "pièce" });
  });

  it("only reads a number that stands on its own at the start", () => {
    expect(parseExtraItem("7up")).toEqual({ name: "7up", quantity: null, unit: null });
    expect(parseExtraItem("Coca 0 sucre")).toEqual({ name: "Coca 0 sucre", quantity: null, unit: null });
  });

  it("drops the article after the quantity", () => {
    expect(parseExtraItem("2 kg d'oignons")).toEqual({ name: "oignons", quantity: 2000, unit: "g" });
    expect(parseExtraItem("1 kg de la farine")).toEqual({ name: "farine", quantity: 1000, unit: "g" });
  });

  it("ignores a zero quantity and keeps the name", () => {
    expect(parseExtraItem("0 lait")).toEqual({ name: "lait", quantity: null, unit: null });
  });

  it("collapses whitespace and returns an empty name when only a quantity is typed", () => {
    expect(parseExtraItem("  3   kiwis ")).toEqual({ name: "kiwis", quantity: 3, unit: "pièce" });
    expect(parseExtraItem("500 g")).toEqual({ name: "", quantity: 500, unit: "g" });
    expect(parseExtraItem("   ")).toEqual({ name: "", quantity: null, unit: null });
  });
});
