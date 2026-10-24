import { describe, it, expect } from "vitest";
import {
  packageLabel,
  quantityInPackages,
  packagesToQuantity,
  quantityToPackages,
  formatQuantity,
} from "./packageHint";

describe("packageLabel", () => {
  it("describes a package in grams", () => {
    expect(packageLabel({ unit: "g", packageSize: 200 })).toBe("paquet de 200 g");
  });

  it("describes a package in millilitres", () => {
    expect(packageLabel({ unit: "mL", packageSize: 1000 })).toBe("paquet de 1000 mL");
  });

  it("describes a package in pieces", () => {
    expect(packageLabel({ unit: "pièce", packageSize: 6 })).toBe("paquet de 6 pièces");
  });

  it("uses the singular for a single piece", () => {
    expect(packageLabel({ unit: "pièce", packageSize: 1 })).toBe("paquet de 1 pièce");
  });

  it("uses a French decimal comma", () => {
    expect(packageLabel({ unit: "g", packageSize: 62.5 })).toBe("paquet de 62,5 g");
  });

  it("returns null when the package size is unknown", () => {
    expect(packageLabel({ unit: "g", packageSize: 0 })).toBeNull();
  });
});

describe("quantityInPackages", () => {
  it("says '= 1 paquet' for exactly one package", () => {
    expect(quantityInPackages(200, 200)).toBe("= 1 paquet");
  });

  it("uses the plural from two packages up", () => {
    expect(quantityInPackages(400, 200)).toBe("= 2 paquets");
  });

  it("approximates a fraction of a package", () => {
    expect(quantityInPackages(75, 200)).toBe("≈ 0,38 paquet");
  });

  it("keeps the singular below two packages", () => {
    expect(quantityInPackages(300, 200)).toBe("= 1,5 paquet");
  });

  it("approximates when the ratio is not exact", () => {
    expect(quantityInPackages(250, 150)).toBe("≈ 1,67 paquet");
  });

  it("returns null for a zero quantity", () => {
    expect(quantityInPackages(0, 200)).toBeNull();
  });

  it("returns null instead of dividing by a zero package size", () => {
    expect(quantityInPackages(75, 0)).toBeNull();
  });

  it("returns null for a non-finite quantity", () => {
    expect(quantityInPackages(Number.NaN, 200)).toBeNull();
  });
});

describe("packagesToQuantity", () => {
  it("converts packages to the base unit", () => {
    expect(packagesToQuantity(2, 200)).toBe(400);
  });

  it("converts a fraction of a package", () => {
    expect(packagesToQuantity(0.5, 200)).toBe(100);
  });

  it("does not leak floating point noise", () => {
    expect(packagesToQuantity(0.3, 200)).toBe(60);
  });
});

describe("quantityToPackages", () => {
  it("converts the base unit to packages", () => {
    expect(quantityToPackages(400, 200)).toBe(2);
  });

  it("keeps a usable precision for partial packages", () => {
    expect(quantityToPackages(75, 200)).toBe(0.375);
  });

  it("returns 0 rather than dividing by a zero package size", () => {
    expect(quantityToPackages(75, 0)).toBe(0);
  });
});

describe("formatQuantity", () => {
  it("formats grams", () => {
    expect(formatQuantity(75, "g")).toBe("75 g");
  });

  it("uses a French decimal comma and drops float noise", () => {
    expect(formatQuantity(62.5, "mL")).toBe("62,5 mL");
    expect(formatQuantity(0.1 + 0.2, "g")).toBe("0,3 g");
  });

  it("pluralises pieces from two up", () => {
    expect(formatQuantity(1, "pièce")).toBe("1 pièce");
    expect(formatQuantity(6, "pièce")).toBe("6 pièces");
  });
});
