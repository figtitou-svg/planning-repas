import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cached, invalidate, resetServerCache } from "./serverCache";

describe("serverCache", () => {
  beforeEach(() => {
    resetServerCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the cached value until the TTL expires", async () => {
    const loader = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");

    expect(await cached("k", 1000, loader)).toBe("a");
    vi.advanceTimersByTime(999);
    expect(await cached("k", 1000, loader)).toBe("a");
    vi.advanceTimersByTime(2);
    expect(await cached("k", 1000, loader)).toBe("b");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shares one load between simultaneous callers", async () => {
    const loader = vi.fn().mockResolvedValue("value");

    const results = await Promise.all([
      cached("k", 1000, loader),
      cached("k", 1000, loader),
      cached("k", 1000, loader),
    ]);

    expect(results).toEqual(["value", "value", "value"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache with fresh and stores the new value", async () => {
    const loader = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");

    await cached("k", 1000, loader);
    expect(await cached("k", 1000, loader, { fresh: true })).toBe("new");
    expect(await cached("k", 1000, loader)).toBe("new");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed load", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");

    await expect(cached("k", 1000, loader)).rejects.toThrow("boom");
    expect(await cached("k", 1000, loader)).toBe("ok");
  });

  it("invalidate drops the key and its children but not other keys", async () => {
    const meals = vi.fn().mockResolvedValue("meals");
    const other = vi.fn().mockResolvedValue("other");
    await cached("meals:2026-09-21", 1000, meals);
    await cached("mealsX", 1000, other);

    invalidate("meals");

    await cached("meals:2026-09-21", 1000, meals);
    await cached("mealsX", 1000, other);
    expect(meals).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("does not store a value that was loaded before an invalidation", async () => {
    let release: (value: string) => void = () => {};
    const slow = vi.fn().mockReturnValueOnce(new Promise<string>((resolve) => (release = resolve)));
    const next = vi.fn().mockResolvedValue("after-write");

    const pending = cached("k", 1000, slow);
    invalidate("k");
    release("read-before-write");
    expect(await pending).toBe("read-before-write");

    expect(await cached("k", 1000, next)).toBe("after-write");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
