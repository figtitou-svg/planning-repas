import { describe, it, expect } from "vitest";
import { categoryColorSlot, categoryColorVar } from "./categoryColor";

describe("categoryColorSlot", () => {
  it("gives each Notion category its own colour", () => {
    const categories = [
      "Fruits & Légumes",
      "Boucherie & Poissonnerie",
      "Produits laitiers",
      "Surgelés",
      "Épicerie",
      "Boissons",
      "Hygiène/Entretien",
      "Autre",
    ];
    const slots = categories.map(categoryColorSlot);
    expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("ignores accents and case", () => {
    expect(categoryColorSlot("EPICERIE")).toBe(categoryColorSlot("Épicerie"));
  });

  it("is stable for an unknown name and never picks the neutral colour", () => {
    const slot = categoryColorSlot("Bébé");
    expect(categoryColorSlot("Bébé")).toBe(slot);
    expect(slot).toBeGreaterThanOrEqual(1);
    expect(slot).toBeLessThanOrEqual(7);
  });
});

describe("categoryColorVar", () => {
  it("returns the matching CSS variable", () => {
    expect(categoryColorVar("Surgelés")).toBe("var(--cat-4)");
  });
});
