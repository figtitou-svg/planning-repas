export type TikTokErrorCode = "bad_url" | "unavailable";

export class TikTokImportError extends Error {
  constructor(public code: TikTokErrorCode, message: string) {
    super(message);
  }
}

const ALLOWED_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const OEMBED_ENDPOINT = "https://www.tiktok.com/oembed";
const TIMEOUT_MS = 8000;
const MAX_CAPTION_LENGTH = 8000;

function assertTikTokUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TikTokImportError("bad_url", "Lien TikTok invalide.");
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new TikTokImportError("bad_url", "Lien TikTok invalide.");
  }
}

export async function fetchTikTokCaption(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  assertTikTokUrl(url);

  let title: unknown;
  try {
    const response = await fetchImpl(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`oEmbed HTTP ${response.status}`);
    }
    const body = await response.json();
    title = body?.title;
  } catch {
    throw new TikTokImportError("unavailable", "Légende TikTok indisponible.");
  }

  if (typeof title !== "string" || title.trim() === "") {
    throw new TikTokImportError("unavailable", "Légende TikTok indisponible.");
  }
  return title.slice(0, MAX_CAPTION_LENGTH);
}
