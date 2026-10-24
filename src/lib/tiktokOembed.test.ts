import { describe, it, expect, vi } from "vitest";
import { fetchTikTokCaption, TikTokImportError } from "./tiktokOembed";

function okResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return e instanceof TikTokImportError ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

describe("fetchTikTokCaption", () => {
  it.each([
    "https://tiktok.com/@u/video/1",
    "https://www.tiktok.com/@u/video/1",
    "https://m.tiktok.com/@u/video/1",
    "https://vm.tiktok.com/ZM123/",
    "https://vt.tiktok.com/ZS123/",
    "HTTPS://WWW.TIKTOK.COM/@u/video/1",
  ])("accepts %s and calls the fixed oEmbed endpoint", async (url) => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ title: "Pâtes" }));

    const caption = await fetchTikTokCaption(url, fetchImpl as unknown as typeof fetch);

    expect(caption).toBe("Pâtes");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    );
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchImpl.mock.calls[0][1].cache).toBe("no-store");
  });

  it.each([
    "https://evil.com/@u/video/1",
    "https://tiktok.com.evil.com/@u/video/1",
    "https://www.tiktok.com@evil.com/",
    "https://nottiktok.com/",
    "https://www.tiktok.com.evil.com/",
    "https://www.tiktok.com./",
    "http://www.tiktok.com/@u/video/1",
    "file:///etc/passwd",
    "https://127.0.0.1/",
    "pas une url",
    "",
  ])("rejects %s with bad_url and never calls fetch", async (url) => {
    const fetchImpl = vi.fn();

    const code = await codeOf(fetchTikTokCaption(url, fetchImpl as unknown as typeof fetch));

    expect(code).toBe("bad_url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("truncates the caption to 8000 characters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ title: "a".repeat(9000) }));

    const caption = await fetchTikTokCaption(
      "https://www.tiktok.com/@u/video/1",
      fetchImpl as unknown as typeof fetch
    );

    expect(caption).toHaveLength(8000);
  });

  it("returns unavailable on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });

    const code = await codeOf(
      fetchTikTokCaption("https://www.tiktok.com/@u/video/1", fetchImpl as unknown as typeof fetch)
    );

    expect(code).toBe("unavailable");
  });

  it.each([{}, { title: "" }, { title: 42 }, null])(
    "returns unavailable when the JSON has no usable title (%j)",
    async (body) => {
      const fetchImpl = vi.fn().mockResolvedValue(okResponse(body));

      const code = await codeOf(
        fetchTikTokCaption(
          "https://www.tiktok.com/@u/video/1",
          fetchImpl as unknown as typeof fetch
        )
      );

      expect(code).toBe("unavailable");
    }
  );

  it("returns unavailable on network failure or timeout", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));

    const code = await codeOf(
      fetchTikTokCaption("https://www.tiktok.com/@u/video/1", fetchImpl as unknown as typeof fetch)
    );

    expect(code).toBe("unavailable");
  });

  it("returns unavailable when the body is not valid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });

    const code = await codeOf(
      fetchTikTokCaption("https://www.tiktok.com/@u/video/1", fetchImpl as unknown as typeof fetch)
    );

    expect(code).toBe("unavailable");
  });
});
