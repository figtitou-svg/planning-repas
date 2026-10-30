import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SocialImportError } from "@/lib/socialCaption";
import { RecipeParseError } from "@/lib/recipeParser";

const fetchSocialCaption = vi.fn();
const parseRecipeText = vi.fn();
const listIngredients = vi.fn();

vi.mock("@/lib/notionClient", () => ({ getNotionClient: () => ({}) }));
vi.mock("@/lib/repositories/ingredients", () => ({
  listIngredients: (...args: unknown[]) => listIngredients(...args),
}));
vi.mock("@/lib/socialCaption", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/socialCaption")>()),
  fetchSocialCaption: (...args: unknown[]) => fetchSocialCaption(...args),
}));
vi.mock("@/lib/recipeParser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recipeParser")>()),
  parseRecipeText: (...args: unknown[]) => parseRecipeText(...args),
}));

import { POST } from "./route";

const CATALOG = [
  { id: "i1", name: "Pâtes", unit: "g", packageSize: 500, packagePrice: 1, shelfLifeDays: 300, category: "Épicerie" },
  { id: "i2", name: "Tomate", unit: "pièce", packageSize: 1, packagePrice: 1, shelfLifeDays: 7, category: "Légumes" },
];

function post(body: unknown, raw = false) {
  return POST(
    new Request("http://localhost/api/import/recipe", {
      method: "POST",
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
}

describe("POST /api/import/recipe", () => {
  const consoleError = vi.fn();

  beforeEach(() => {
    fetchSocialCaption.mockReset();
    parseRecipeText.mockReset();
    listIngredients.mockReset();
    listIngredients.mockResolvedValue(CATALOG);
    fetchSocialCaption.mockResolvedValue("légende TikTok");
    parseRecipeText.mockResolvedValue({
      name: "Pâtes tomate",
      portions: 4,
      ingredients: [
        { name: "pâtes", quantity: 400, unit: "g" },
        { name: "tomates", quantity: 200, unit: "g" },
        { name: "basilic", quantity: 5, unit: "g" },
      ],
      steps: ["Cuire les pâtes", "Ajouter la sauce"],
    });
    consoleError.mockReset();
    vi.spyOn(console, "error").mockImplementation(consoleError);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("imports a TikTok url and returns matched and created lines", async () => {
    const response = await post({ url: "https://www.tiktok.com/@a/video/1" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "Pâtes tomate",
      portions: 4,
      matched: [
        { ingredientId: "i1", quantity: 400 },
        { ingredientId: "i2", quantity: 200, unitMismatch: true },
      ],
      created: [{ name: "basilic", unit: "g", quantity: 5 }],
      steps: ["Cuire les pâtes", "Ajouter la sauce"],
    });
    expect(fetchSocialCaption).toHaveBeenCalledWith("https://www.tiktok.com/@a/video/1");
    expect(parseRecipeText).toHaveBeenCalledWith("légende TikTok", ["Pâtes", "Tomate"]);
  });

  it("imports pasted text without fetching a page", async () => {
    const response = await post({ text: "Pâtes tomate pour 4" });

    expect(response.status).toBe(200);
    expect(fetchSocialCaption).not.toHaveBeenCalled();
    expect(parseRecipeText).toHaveBeenCalledWith("Pâtes tomate pour 4", ["Pâtes", "Tomate"]);
  });

  it.each([
    ["neither url nor text", {}],
    ["both url and text", { url: "https://www.tiktok.com/x", text: "abc" }],
    ["url not a string", { url: 3 }],
    ["text not a string", { text: ["a"] }],
    ["url null", { url: null }],
    ["a JSON array", ["a"]],
    ["a JSON null", null],
    ["a JSON string", "abc"],
  ])("rejects %s with 400", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(fetchSocialCaption).not.toHaveBeenCalled();
    expect(parseRecipeText).not.toHaveBeenCalled();
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", "  \n\t "],
  ])("rejects %s text with 400 before reading the catalogue", async (_label, text) => {
    const response = await post({ text });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Le texte est vide" });
    expect(listIngredients).not.toHaveBeenCalled();
    expect(parseRecipeText).not.toHaveBeenCalled();
  });

  it("rejects text over 8000 characters with 422 before reading the catalogue", async () => {
    const response = await post({ text: "a".repeat(8001) });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Le texte est trop long (8 000 caractères maximum)",
    });
    expect(listIngredients).not.toHaveBeenCalled();
    expect(parseRecipeText).not.toHaveBeenCalled();
  });

  it("passes text of exactly 8000 characters through to the parser", async () => {
    const text = "a".repeat(8000);

    const response = await post({ text });

    expect(response.status).toBe(200);
    expect(parseRecipeText).toHaveBeenCalledWith(text, ["Pâtes", "Tomate"]);
  });

  it("rejects malformed JSON with 400", async () => {
    expect((await post("{nope", true)).status).toBe(400);
  });

  it("maps bad_url to 400", async () => {
    fetchSocialCaption.mockRejectedValue(new SocialImportError("bad_url", "détail"));

    const response = await post({ url: "https://evil.com" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Lien TikTok ou Instagram invalide" });
    expect(parseRecipeText).not.toHaveBeenCalled();
  });

  it("maps an unavailable video to 502", async () => {
    fetchSocialCaption.mockRejectedValue(new SocialImportError("unavailable", "détail", "tiktok"));

    const response = await post({ url: "https://www.tiktok.com/@a/video/1" });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error:
        "Impossible de lire la publication TikTok (lien privé ou supprimé ? Collez plutôt le texte de la description)",
    });
  });

  it("names Instagram when an Instagram post is unavailable", async () => {
    fetchSocialCaption.mockRejectedValue(
      new SocialImportError("unavailable", "détail", "instagram")
    );

    const response = await post({ url: "https://www.instagram.com/reel/abc/" });

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("publication Instagram");
  });

  it("imports an Instagram reel like any other url", async () => {
    fetchSocialCaption.mockResolvedValue("légende Instagram");

    const response = await post({ url: "https://www.instagram.com/reel/abc/" });

    expect(response.status).toBe(200);
    expect(fetchSocialCaption).toHaveBeenCalledWith("https://www.instagram.com/reel/abc/");
    expect(parseRecipeText).toHaveBeenCalledWith("légende Instagram", ["Pâtes", "Tomate"]);
  });

  it("maps an empty parse to 422", async () => {
    parseRecipeText.mockRejectedValue(new RecipeParseError("empty", "détail"));

    const response = await post({ text: "blabla" });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Aucune recette exploitable trouvée dans ce texte",
    });
  });

  it.each(["invalid", "unavailable"] as const)("maps parse code %s to 502", async (code) => {
    parseRecipeText.mockRejectedValue(new RecipeParseError(code, "détail secret"));

    const response = await post({ text: "blabla" });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "L'analyse de la recette a échoué, réessayez",
    });
  });

  it("answers 500 without detail when the Gemini key is missing", async () => {
    parseRecipeText.mockRejectedValue(
      new Error("Variable d'environnement manquante : GEMINI_API_KEY")
    );

    const response = await post({ text: "blabla" });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Erreur interne" });
  });

  it("answers 500 without detail when the catalogue cannot be read", async () => {
    listIngredients.mockRejectedValue(new Error("notion secret_abc unauthorized"));

    const response = await post({ text: "blabla" });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Erreur interne" });
    expect(parseRecipeText).not.toHaveBeenCalled();
  });

  it("does not log the raw error message", async () => {
    parseRecipeText.mockRejectedValue(new Error("secret-value"));

    await post({ text: "blabla" });

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret-value");
  });
});
