import { describe, it, expect } from "vitest";
import {
  CHECK_QUEUE_KEY,
  dropCheck,
  enqueueCheck,
  loadQueue,
  overlayChecks,
  parseQueue,
  removeSent,
  saveQueue,
  type PendingCheck,
} from "./checkQueue";

const W1 = "2026-09-28";
const W2 = "2026-10-05";
const check = (ingredientId: string, checked: boolean, weekStart = W1): PendingCheck => ({
  weekStart,
  ingredientId,
  checked,
});

describe("enqueueCheck", () => {
  it("keeps only the latest value for the same article and week", () => {
    let queue = enqueueCheck([], check("flour", true));
    queue = enqueueCheck(queue, check("milk", true));
    queue = enqueueCheck(queue, check("flour", false));

    expect(queue).toEqual([check("milk", true), check("flour", false)]);
  });

  it("keeps the same article in two different weeks", () => {
    const queue = enqueueCheck([check("flour", true, W1)], check("flour", true, W2));

    expect(queue).toHaveLength(2);
  });

  it("does not modify the queue it receives", () => {
    const original = [check("flour", true)];
    enqueueCheck(original, check("flour", false));

    expect(original).toEqual([check("flour", true)]);
  });
});

describe("dropCheck", () => {
  it("forgets one article of one week only", () => {
    const queue = [check("flour", true, W1), check("flour", true, W2), check("milk", true, W1)];

    expect(dropCheck(queue, { weekStart: W1, ingredientId: "flour" })).toEqual([
      check("flour", true, W2),
      check("milk", true, W1),
    ]);
  });
});

describe("removeSent", () => {
  it("removes a check once it was sent", () => {
    expect(removeSent([check("flour", true)], check("flour", true))).toEqual([]);
  });

  it("keeps a newer value the user set while the old one was being sent", () => {
    const queue = [check("flour", false)];

    expect(removeSent(queue, check("flour", true))).toEqual([check("flour", false)]);
  });
});

describe("overlayChecks", () => {
  it("lets waiting checks win over the server for that week", () => {
    const queue = [check("flour", true), check("milk", false), check("eggs", true, W2)];

    expect(overlayChecks(W1, { flour: false, milk: true, rice: true }, queue)).toEqual({
      flour: true,
      milk: false,
      rice: true,
    });
  });

  it("returns the server checks untouched when nothing is waiting", () => {
    expect(overlayChecks(W1, { flour: true }, [])).toEqual({ flour: true });
  });
});

describe("parseQueue", () => {
  it("reads a saved queue", () => {
    const queue = [check("flour", true)];

    expect(parseQueue(JSON.stringify(queue))).toEqual(queue);
  });

  it("falls back to an empty queue for missing or corrupted content", () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("{nope")).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
  });

  it("drops malformed entries and keeps the valid ones", () => {
    const raw = JSON.stringify([check("flour", true), { weekStart: W1 }, "x", null, { ...check("milk", true), checked: "yes" }]);

    expect(parseQueue(raw)).toEqual([check("flour", true)]);
  });
});

describe("loadQueue / saveQueue", () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      data,
      getItem: (key: string) => data[key] ?? null,
      setItem: (key: string, value: string) => void (data[key] = value),
    };
  }

  it("round-trips through storage", () => {
    const storage = memoryStorage();
    saveQueue(storage, [check("flour", true)]);

    expect(loadQueue(storage)).toEqual([check("flour", true)]);
    expect(Object.keys(storage.data)).toEqual([CHECK_QUEUE_KEY]);
  });

  it("does not throw when the storage refuses to read or write", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };

    expect(loadQueue(broken)).toEqual([]);
    expect(() => saveQueue(broken, [check("flour", true)])).not.toThrow();
  });
});
