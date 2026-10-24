import { describe, it, expect, vi, beforeEach } from "vitest";

const invalidatePantry = vi.fn();
vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/pantry", () => ({
  updatePantryQuantity: vi.fn().mockResolvedValue({ id: "p1" }),
  removePantryItem: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cachedReads", () => ({ invalidatePantry: (...args: unknown[]) => invalidatePantry(...args) }));

import { PATCH, DELETE } from "./route";

const ctx = { params: Promise.resolve({ id: "p1" }) };

describe("/api/pantry/[id]", () => {
  beforeEach(() => invalidatePantry.mockReset());

  it("PATCH purge le cache garde-manger de tous les foyers", async () => {
    await PATCH(new Request("http://localhost/api/pantry/p1", { method: "PATCH", body: JSON.stringify({ quantity: 2 }) }), ctx);
    expect(invalidatePantry.mock.calls.map((c) => c[0]).sort()).toEqual(["household-1", "household-2"]);
  });

  it("DELETE purge le cache garde-manger de tous les foyers", async () => {
    await DELETE(new Request("http://localhost/api/pantry/p1", { method: "DELETE" }), ctx);
    expect(invalidatePantry.mock.calls.map((c) => c[0]).sort()).toEqual(["household-1", "household-2"]);
  });
});
