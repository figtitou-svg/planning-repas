import { describe, expect, it } from "vitest";
import { isClearlyVertical, lockGesture } from "./swipeGesture";

describe("lockGesture", () => {
  it("reste indécis sous 16 px", () => {
    expect(lockGesture(12, 2)).toBeNull();
    expect(lockGesture(0, 15)).toBeNull();
  });

  it("verrouille l'horizontale avec une dominance nette", () => {
    expect(lockGesture(20, 5)).toBe("h");
    expect(lockGesture(30, 19)).toBe("h");
  });

  it("verrouille la verticale quand Y domine", () => {
    expect(lockGesture(5, 20)).toBe("v");
    expect(lockGesture(15, 16)).toBe("v");
  });

  it("ne tranche pas trop vite une diagonale, puis choisit la verticale", () => {
    expect(lockGesture(20, 16)).toBeNull();
    expect(lockGesture(30, 28)).toBe("v");
  });
});

describe("isClearlyVertical", () => {
  it("exige une dérive verticale nette et d'au moins 24 px", () => {
    expect(isClearlyVertical(10, 20)).toBe(false);
    expect(isClearlyVertical(10, 30)).toBe(true);
    expect(isClearlyVertical(40, 30)).toBe(false);
  });
});
