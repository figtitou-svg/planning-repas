import { describe, it, expect } from "vitest";
import { parseHousehold, householdFromRequest, hasChosenHousehold, HOUSEHOLDS, DEFAULT_HOUSEHOLD } from "./households";

describe("parseHousehold", () => {
  it("accepte les deux foyers connus", () => {
    expect(parseHousehold("household-1")).toBe("household-1");
    expect(parseHousehold("household-2")).toBe("household-2");
  });
  it("retombe sur le foyer par défaut pour toute autre valeur", () => {
    expect(parseHousehold("autre")).toBe(DEFAULT_HOUSEHOLD);
    expect(parseHousehold("")).toBe(DEFAULT_HOUSEHOLD);
    expect(parseHousehold(null)).toBe(DEFAULT_HOUSEHOLD);
    expect(parseHousehold(undefined)).toBe(DEFAULT_HOUSEHOLD);
  });
});

describe("householdFromRequest", () => {
  const req = (cookie?: string) =>
    new Request("http://x/api", { headers: cookie ? { cookie } : {} });
  it("lit le cookie household parmi d'autres cookies", () => {
    expect(householdFromRequest(req("a=1; household=household-2; b=2"))).toBe("household-2");
  });
  it("défaut sans cookie ou avec cookie invalide", () => {
    expect(householdFromRequest(req())).toBe("household-1");
    expect(householdFromRequest(req("household=hacker"))).toBe("household-1");
  });
});

describe("HOUSEHOLDS", () => {
  it("expose id et libellé de chaque foyer", () => {
    expect(HOUSEHOLDS.map((h) => h.id)).toEqual(["household-1", "household-2"]);
  });
});

describe("hasChosenHousehold", () => {
  const req = (cookie?: string) =>
    new Request("http://x/api", { headers: cookie ? { cookie } : {} });
  it("vrai seulement avec un cookie de foyer valide", () => {
    expect(hasChosenHousehold(req("a=1; household=household-2"))).toBe(true);
    expect(hasChosenHousehold(req())).toBe(false);
    expect(hasChosenHousehold(req("household=hacker"))).toBe(false);
  });
});
