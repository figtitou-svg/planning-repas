import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notionClient";
import { listIngredients } from "@/lib/repositories/ingredients";
import {
  MAX_VIDEO_BYTES,
  parseRecipeVideo,
  RecipeParseError,
  VIDEO_MIME_TYPES,
} from "@/lib/recipeParser";
import { matchIngredients } from "@/lib/matchIngredients";

// Marge pour les en-têtes multipart autour du fichier.
const MAX_BODY_BYTES = MAX_VIDEO_BYTES + 1024 * 1024;

const EXTENSION_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Certains navigateurs n'indiquent pas le type d'une vidéo : on se rabat sur l'extension. */
function videoMimeType(file: File): string | null {
  if (VIDEO_MIME_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type === "" || file.type === "application/octet-stream"
    ? EXTENSION_TYPES[extension] ?? null
    : null;
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail("Vidéo trop lourde (50 Mo maximum)", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Envoi invalide", 400);
  }
  const file = form.get("video");
  if (!(file instanceof File)) return fail("Joignez une vidéo", 400);
  if (file.size === 0) return fail("La vidéo est vide", 400);
  if (file.size > MAX_VIDEO_BYTES) return fail("Vidéo trop lourde (50 Mo maximum)", 413);
  const mimeType = videoMimeType(file);
  if (mimeType === null) return fail("Format de vidéo non pris en charge (MP4 ou MOV conseillé)", 415);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const catalog = await listIngredients(getNotionClient());
    const parsed = await parseRecipeVideo(
      { bytes, mimeType },
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
    if (e instanceof RecipeParseError) {
      if (e.code === "empty") return fail("Aucune recette exploitable trouvée dans cette vidéo", 422);
      return fail("L'analyse de la vidéo a échoué, réessayez", 502);
    }
    console.error("import/video: erreur interne", e instanceof Error ? e.name : typeof e);
    return fail("Erreur interne", 500);
  }
}
