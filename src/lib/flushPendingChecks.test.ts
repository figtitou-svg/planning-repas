import { describe, it, expect, vi } from "vitest";
import { flushPendingChecks } from "./flushPendingChecks";
import { CHECK_QUEUE_KEY, loadQueue, type PendingCheck } from "./checkQueue";

function fakeStorage(queue: PendingCheck[]) {
  const data = new Map<string, string>([[CHECK_QUEUE_KEY, JSON.stringify(queue)]]);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const a: PendingCheck = { weekStart: "2026-09-14", ingredientId: "a", checked: true };
const b: PendingCheck = { weekStart: "2026-09-14", ingredientId: "b", checked: false };

describe("flushPendingChecks", () => {
  it("vide la file quand tout est envoyé", async () => {
    const storage = fakeStorage([a, b]);
    const put = vi.fn().mockResolvedValue("saved");

    expect(await flushPendingChecks(storage, put)).toBe(0);
    expect(put).toHaveBeenCalledTimes(2);
    expect(loadQueue(storage)).toEqual([]);
  });

  it("s'arrête au premier échec réseau et garde le reste en file", async () => {
    const storage = fakeStorage([a, b]);
    const put = vi.fn().mockResolvedValueOnce("saved").mockResolvedValueOnce("offline");

    expect(await flushPendingChecks(storage, put)).toBe(1);
    expect(loadQueue(storage)).toEqual([b]);
  });

  it("abandonne une coche refusée par le serveur", async () => {
    const storage = fakeStorage([a]);
    expect(await flushPendingChecks(storage, vi.fn().mockResolvedValue("rejected"))).toBe(0);
  });
});
