import { describe, it, expect, vi } from "vitest";
import { mapLimit } from "./mapLimit";

describe("mapLimit", () => {
  it("keeps the input order in the results", async () => {
    const delays = [30, 5, 15, 1];
    const result = await mapLimit(delays, 2, async (ms, i) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it("never runs more than `limit` calls at once", async () => {
    let running = 0;
    let peak = 0;
    await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
    });
    expect(peak).toBe(3);
  });

  it("returns an empty array for no items", async () => {
    expect(await mapLimit([], 3, async () => 1)).toEqual([]);
  });

  it("rejects with the first error and stops starting new calls", async () => {
    const fn = vi.fn(async (n: number) => {
      if (n === 1) throw new Error("boom");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return n;
    });

    await expect(mapLimit([0, 1, 2, 3, 4, 5, 6, 7], 2, fn)).rejects.toThrow("boom");
    expect(fn.mock.calls.length).toBeLessThan(8);
  });
});
