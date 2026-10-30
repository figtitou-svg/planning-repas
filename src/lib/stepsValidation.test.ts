import { describe, it, expect } from "vitest";
import { invalidSteps } from "./stepsValidation";

describe("invalidSteps", () => {
  it.each([[undefined], [[]], [["a", "b"]]])("accepts %j", (steps) => {
    expect(invalidSteps(steps)).toBe(false);
  });

  it.each([["texte"], [null], [[1]], [["a", null]], [{ 0: "a" }], [Array(101).fill("a")]])(
    "rejects %j",
    (steps) => {
      expect(invalidSteps(steps)).toBe(true);
    }
  );
});
