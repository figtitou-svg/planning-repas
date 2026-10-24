import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("confirms the test toolchain runs", () => {
    expect(1 + 1).toBe(2);
  });
});
