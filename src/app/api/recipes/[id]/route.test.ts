import { describe, it, expect, vi, beforeEach } from "vitest";

const updateRecipe = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/recipes", () => ({
  getRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  updateRecipe: (...args: unknown[]) => updateRecipe(...args),
}));

import { PATCH } from "./route";

function patch(body: unknown, raw = false) {
  return PATCH(
    new Request("http://localhost/api/recipes/r1", {
      method: "PATCH",
      body: raw ? (body as string) : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "r1" }) }
  );
}

describe("PATCH /api/recipes/[id]", () => {
  beforeEach(() => {
    updateRecipe.mockReset();
    updateRecipe.mockResolvedValue(undefined);
  });

  it("passes a favorite toggle to the repository", async () => {
    const response = await patch({ favorite: true });

    expect(response.status).toBe(204);
    expect(updateRecipe).toHaveBeenCalledWith({}, "r1", { favorite: true });
  });

  it("accepts favorite: false to remove a favorite", async () => {
    const response = await patch({ favorite: false });

    expect(response.status).toBe(204);
    expect(updateRecipe).toHaveBeenCalledWith({}, "r1", { favorite: false });
  });

  it("rejects a favorite that is not a boolean", async () => {
    const response = await patch({ favorite: "oui" });

    expect(response.status).toBe(400);
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it("passes steps to the repository", async () => {
    const response = await patch({ steps: ["Mélanger"] });

    expect(response.status).toBe(204);
    expect(updateRecipe).toHaveBeenCalledWith({}, "r1", { steps: ["Mélanger"] });
  });

  it("rejects steps that are not a list of texts", async () => {
    const response = await patch({ steps: "Mélanger" });

    expect(response.status).toBe(400);
    expect(updateRecipe).not.toHaveBeenCalled();
  });

  it("rejects an invalid JSON body", async () => {
    const response = await patch("{nope", true);

    expect(response.status).toBe(400);
    expect(updateRecipe).not.toHaveBeenCalled();
  });
});
