import { describe, expect, it } from "vitest";
import { swipeState, swipeThreshold } from "./swipeState";

describe("swipeThreshold", () => {
  it("vaut 96 px sur un grand écran", () => {
    expect(swipeThreshold(400)).toBe(96);
  });

  it("vaut 35 % de la largeur sur un petit élément", () => {
    expect(swipeThreshold(200)).toBeCloseTo(70);
  });

  it("retombe sur 96 px si la largeur est inconnue", () => {
    expect(swipeThreshold(0)).toBe(96);
    expect(swipeThreshold(NaN)).toBe(96);
  });
});

describe("swipeState", () => {
  it("est neutre sans mouvement", () => {
    expect(swipeState(0, 400)).toMatchObject({ direction: null, armed: false, progress: 0 });
  });

  it("détecte la direction", () => {
    expect(swipeState(30, 400).direction).toBe("right");
    expect(swipeState(-30, 400).direction).toBe("left");
  });

  it("n'arme pas sous le seuil", () => {
    const s = swipeState(-95, 400);
    expect(s.armed).toBe(false);
    expect(s.progress).toBeCloseTo(95 / 96);
  });

  it("arme à partir du seuil, dans les deux sens", () => {
    expect(swipeState(96, 400).armed).toBe(true);
    expect(swipeState(-200, 400)).toMatchObject({ armed: true, progress: 1, direction: "left" });
  });

  it("utilise 35 % de la largeur quand elle est petite", () => {
    expect(swipeState(71, 200).armed).toBe(true);
    expect(swipeState(69, 200).armed).toBe(false);
  });
});
