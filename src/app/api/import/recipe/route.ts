import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { listIngredients } from "@/lib/repositories/ingredients";
import { fetchSocialCaption, SocialImportError } from "@/lib/socialCaption";
import { parseRecipeText, RecipeParseError } from "@/lib/recipeParser";
import { matchIngredients } from "@/lib/matchIngredients";

const MAX_TEXT_LENGTH = 8000;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Corps JSON invalide", 400);
  }

  const { url, text } =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { url?: unknown; text?: unknown })
      : { url: undefined, text: undefined };
  const hasUrl = url !== undefined;
  const hasText = text !== undefined;
  if (
    hasUrl === hasText ||
    (hasUrl && typeof url !== "string") ||
    (hasText && typeof text !== "string")
  ) {
    return fail("Fournissez soit url, soit text (une chaîne)", 400);
  }

  if (hasText) {
    const pasted = text as string;
    if (pasted.trim() === "") return fail("Le texte est vide", 400);
    if (pasted.length > MAX_TEXT_LENGTH) {
      return fail("Le texte est trop long (8 000 caractères maximum)", 422);
    }
  }

  try {
    const source = hasUrl ? await fetchSocialCaption(url as string) : (text as string);
    const catalog = await listIngredients(getNotionClient());
    const parsed = await parseRecipeText(
      source,
      catalog.map((ingredient) => ingredient.name)
    );
    const { matched, created } = matchIngredients(parsed.ingredients, catalog);
    return NextResponse.json({
      name: parsed.name,
      portions: parsed.portions,
      matched,
      created,
      steps: parsed.steps,
    });
  } catch (e) {
    if (e instanceof SocialImportError) {
      if (e.code === "bad_url") return fail("Lien TikTok ou Instagram invalide", 400);
      const platform = e.platform === "instagram" ? "Instagram" : "TikTok";
      return fail(
        `Impossible de lire la publication ${platform} (lien privé ou supprimé ? Collez plutôt le texte de la description)`,
        502
      );
    }
    if (e instanceof RecipeParseError) {
      return e.code === "empty"
        ? fail("Aucune recette exploitable trouvée dans ce texte", 422)
        : fail("L'analyse de la recette a échoué, réessayez", 502);
    }
    console.error("import/recipe: erreur interne", e instanceof Error ? e.name : typeof e);
    return fail("Erreur interne", 500);
  }
}
