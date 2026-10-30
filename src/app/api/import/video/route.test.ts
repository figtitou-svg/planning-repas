import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecipeParseError } from "@/lib/recipeParser";

const parseRecipeVideo = vi.fn();
const listIngredients = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/ingredients", () => ({
  listIngredients: (...args: unknown[]) => listIngredients(...args),
}));
vi.mock("@/lib/recipeParser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recipeParser")>()),
  parseRecipeVideo: (...args: unknown[]) => parseRecipeVideo(...args),
}));

import { POST } from "./route";

const CATALOG = [
  { id: "i1", name: "Pâtes", unit: "g", packageSize: 500, packagePrice: 1, shelfLifeDays: 300, category: "Épicerie" },
];

function post(file?: File | string, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (file !== undefined) form.set("video", file);
  return POST(new Request("http://localhost/api/import/video", { method: "POST", body: form, headers }));
}

function video(name = "recette.mp4", type = "video/mp4", size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("POST /api/import/video", () => {
  beforeEach(() => {
    parseRecipeVideo.mockReset();
    listIngredients.mockReset();
    listIngredients.mockResolvedValue(CATALOG);
    parseRecipeVideo.mockResolvedValue({
      name: "Pâtes tomate",
      portions: 2,
      ingredients: [
        { name: "pâtes", quantity: 200, unit: "g" },
        { name: "basilic", quantity: 5, unit: "g" },
      ],
      steps: ["Cuire les pâtes"],
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("analyses the video and returns the same shape as the text import", async () => {
    const response = await post(video());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "Pâtes tomate",
      portions: 2,
      matched: [{ ingredientId: "i1", quantity: 200 }],
      created: [{ name: "basilic", unit: "g", quantity: 5 }],
      steps: ["Cuire les pâtes"],
    });
    const [sent, names] = parseRecipeVideo.mock.calls[0];
    expect(sent.mimeType).toBe("video/mp4");
    expect(sent.bytes).toBeInstanceOf(Uint8Array);
    expect(sent.bytes.byteLength).toBe(10);
    expect(names).toEqual(["Pâtes"]);
  });

  it("falls back to the extension when the browser gives no type", async () => {
    const response = await post(video("clip.MOV", ""));

    expect(response.status).toBe(200);
    expect(parseRecipeVideo.mock.calls[0][0].mimeType).toBe("video/quicktime");
  });

  it.each([
    ["no file", undefined, 400],
    ["a text field instead of a file", "pas un fichier", 400],
    ["an empty file", video("a.mp4", "video/mp4", 0), 400],
    ["a pdf", video("a.pdf", "application/pdf"), 415],
    ["an unknown extension without type", video("a.xyz", ""), 415],
  ])("rejects %s", async (_label, file, status) => {
    const response = await post(file as File | string | undefined);

    expect(response.status).toBe(status);
    expect(parseRecipeVideo).not.toHaveBeenCalled();
  });

  it("rejects a declared body that is too large without reading it", async () => {
    const response = await post(video(), { "content-length": String(200 * 1024 * 1024) });

    expect(response.status).toBe(413);
    expect(parseRecipeVideo).not.toHaveBeenCalled();
  });

  it("maps an empty recipe to 422", async () => {
    parseRecipeVideo.mockRejectedValue(new RecipeParseError("empty", "détail"));

    const response = await post(video());

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("Aucune recette");
  });

  it.each(["unavailable", "invalid"] as const)("maps a %s analysis to 502", async (code) => {
    parseRecipeVideo.mockRejectedValue(new RecipeParseError(code, "détail secret"));

    const response = await post(video());

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("hides unexpected errors", async () => {
    parseRecipeVideo.mockRejectedValue(new Error("secret_abc"));

    const response = await post(video());

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret_abc");
  });
});
