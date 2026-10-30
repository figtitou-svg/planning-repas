import { describe, it, expect, vi } from "vitest";
import {
  decodeHtmlEntities,
  extractInstagramCaption,
  extractTikTokCaption,
  fetchSocialCaption,
  SocialImportError,
} from "./socialCaption";

function tiktokPage(desc: unknown): string {
  const data = {
    __DEFAULT_SCOPE__: { "webapp.video-detail": { itemInfo: { itemStruct: { desc } } } },
  };
  return `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

function instagramPage(description: string): string {
  return `<html><head><meta property="og:description" content="${description}" /></head></html>`;
}

function pageResponse(html: string, url = "https://www.tiktok.com/@u/video/1"): Response {
  return { ok: true, url, text: async () => html } as unknown as Response;
}

async function errorOf(promise: Promise<unknown>): Promise<SocialImportError | undefined> {
  try {
    await promise;
  } catch (e) {
    return e as SocialImportError;
  }
  return undefined;
}

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("a &amp; b &quot;c&quot; &#39;d&#39; &#x1F600; &unknown;")).toBe(
      "a & b \"c\" 'd' 😀 &unknown;"
    );
  });
});

describe("extractTikTokCaption", () => {
  it("reads the description from the rehydration JSON", () => {
    expect(extractTikTokCaption(tiktokPage("Pâtes 🍝 #recette"))).toBe("Pâtes 🍝 #recette");
  });

  it.each([
    ["no script", "<html></html>"],
    ["broken json", '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{oops</script>'],
    ["no desc", tiktokPage(undefined)],
    ["desc not a string", tiktokPage(42)],
  ])("returns null when %s", (_label, html) => {
    expect(extractTikTokCaption(html)).toBeNull();
  });
});

describe("extractInstagramCaption", () => {
  it("keeps only the quoted caption", () => {
    const html = instagramPage(
      "5,086 likes, 120 comments - chef on June 29, 2023: &quot;Pâtes &amp; sauce&#10;200 g de pâtes&quot;."
    );
    expect(extractInstagramCaption(html)).toBe("Pâtes & sauce\n200 g de pâtes");
  });

  it("handles French guillemets", () => {
    const html = instagramPage("12 j’aime, 3 commentaires - chef le 3 juin 2024 : « Gratin dauphinois »");
    expect(extractInstagramCaption(html)).toBe("Gratin dauphinois");
  });

  it("falls back to the whole description when there is no quoted part", () => {
    expect(extractInstagramCaption(instagramPage("Une recette simple"))).toBe("Une recette simple");
  });

  it("returns null without the tag", () => {
    expect(extractInstagramCaption("<html></html>")).toBeNull();
  });
});

describe("fetchSocialCaption", () => {
  it.each([
    "https://tiktok.com/@u/video/1",
    "https://www.tiktok.com/@u/video/1",
    "https://m.tiktok.com/@u/video/1",
    "https://vm.tiktok.com/ZM123/",
    "https://vt.tiktok.com/ZS123/",
    "HTTPS://WWW.TIKTOK.COM/@u/video/1",
  ])("reads a TikTok caption from %s", async (url) => {
    const fetchImpl = vi.fn().mockResolvedValue(pageResponse(tiktokPage("Pâtes"), url.toLowerCase()));
    expect(await fetchSocialCaption(url, fetchImpl as unknown as typeof fetch)).toBe("Pâtes");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchImpl.mock.calls[0][1].cache).toBe("no-store");
  });

  it.each([
    "https://www.instagram.com/reel/ABC123/",
    "https://instagram.com/p/ABC123/",
  ])("reads an Instagram caption from %s", async (url) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(pageResponse(instagramPage("1 like - a on May 1, 2024: &quot;Tarte&quot;"), url));
    expect(await fetchSocialCaption(url, fetchImpl as unknown as typeof fetch)).toBe("Tarte");
  });

  it.each([
    "https://evil.com/@u/video/1",
    "https://tiktok.com.evil.com/@u/video/1",
    "https://www.tiktok.com@evil.com/",
    "https://nottiktok.com/",
    "https://www.instagram.com.evil.com/p/1/",
    "http://www.tiktok.com/@u/video/1",
    "http://www.instagram.com/p/1/",
    "file:///etc/passwd",
    "https://127.0.0.1/",
    "pas une url",
    "",
  ])("rejects %j without any network call", async (url) => {
    const fetchImpl = vi.fn();
    const error = await errorOf(fetchSocialCaption(url, fetchImpl as unknown as typeof fetch));
    expect(error).toBeInstanceOf(SocialImportError);
    expect(error?.code).toBe("bad_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports the platform when the caption is unavailable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(pageResponse("<html></html>"));
    const error = await errorOf(
      fetchSocialCaption("https://www.tiktok.com/@u/video/1", fetchImpl as unknown as typeof fetch)
    );
    expect(error?.code).toBe("unavailable");
    expect(error?.platform).toBe("tiktok");
  });

  it("is unavailable on HTTP errors and network failures", async () => {
    const http = vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const network = vi.fn().mockRejectedValue(new Error("boom"));
    for (const fetchImpl of [http, network]) {
      const error = await errorOf(
        fetchSocialCaption("https://www.instagram.com/p/1/", fetchImpl as unknown as typeof fetch)
      );
      expect(error?.code).toBe("unavailable");
      expect(error?.platform).toBe("instagram");
    }
  });

  it("refuses a page reached through a redirect to another host", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(pageResponse(tiktokPage("secret"), "https://evil.example/landing"));
    const error = await errorOf(
      fetchSocialCaption("https://vm.tiktok.com/ZM123/", fetchImpl as unknown as typeof fetch)
    );
    expect(error?.code).toBe("unavailable");
  });

  it("refuses a redirect from TikTok to Instagram", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(pageResponse(instagramPage("x"), "https://www.instagram.com/p/1/"));
    const error = await errorOf(
      fetchSocialCaption("https://vm.tiktok.com/ZM123/", fetchImpl as unknown as typeof fetch)
    );
    expect(error?.code).toBe("unavailable");
  });

  it("caps the caption length", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(pageResponse(tiktokPage("a".repeat(20000))));
    const caption = await fetchSocialCaption(
      "https://www.tiktok.com/@u/video/1",
      fetchImpl as unknown as typeof fetch
    );
    expect(caption).toHaveLength(8000);
  });
});
