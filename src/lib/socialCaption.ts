export type SocialPlatform = "tiktok" | "instagram";
export type SocialErrorCode = "bad_url" | "unavailable";

export class SocialImportError extends Error {
  constructor(
    public code: SocialErrorCode,
    message: string,
    public platform: SocialPlatform | null = null
  ) {
    super(message);
  }
}

const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

const TIMEOUT_MS = 10000;
const MAX_CAPTION_LENGTH = 8000;
const MAX_HTML_LENGTH = 3_000_000;

function platformOf(hostname: string): SocialPlatform | null {
  if (TIKTOK_HOSTS.has(hostname)) return "tiktok";
  if (INSTAGRAM_HOSTS.has(hostname)) return "instagram";
  return null;
}

function parseSocialUrl(url: string): { platform: SocialPlatform } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SocialImportError("bad_url", "Lien invalide.");
  }
  const platform = parsed.protocol === "https:" ? platformOf(parsed.hostname) : null;
  if (platform === null) throw new SocialImportError("bad_url", "Lien invalide.");
  return { platform };
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** La légende d'une vidéo TikTok est dans le JSON de réhydratation de la page (champ `desc`). */
export function extractTikTokCaption(html: string): string | null {
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const desc = data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct?.desc;
    return typeof desc === "string" ? desc : null;
  } catch {
    return null;
  }
}

/**
 * La légende d'un post ou d'un reel Instagram est dans la balise og:description, sous la forme
 * « 1 234 likes, 12 comments - auteur on 3 June 2024: "légende" » (guillemets droits ou « »).
 */
export function extractInstagramCaption(html: string): string | null {
  const tag = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"/i);
  if (!tag) return null;
  const description = decodeHtmlEntities(tag[1]).trim();
  const quoted = description.match(/:\s*["«“]\s*([\s\S]*?)\s*["»”]\.?$/);
  const caption = (quoted ? quoted[1] : description).trim();
  return caption === "" ? null : caption;
}

export async function fetchSocialCaption(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const { platform } = parseSocialUrl(url);
  const unavailable = () =>
    new SocialImportError("unavailable", "Légende indisponible.", platform);

  let html: string;
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: { "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Les liens courts redirigent : on refuse de lire une page qui ne serait plus chez la même plateforme.
    if (response.url && platformOf(new URL(response.url).hostname) !== platform) {
      throw new Error("redirection hors plateforme");
    }
    html = (await response.text()).slice(0, MAX_HTML_LENGTH);
  } catch {
    throw unavailable();
  }

  const caption = platform === "tiktok" ? extractTikTokCaption(html) : extractInstagramCaption(html);
  if (caption === null || caption.trim() === "") throw unavailable();
  return caption.trim().slice(0, MAX_CAPTION_LENGTH);
}
