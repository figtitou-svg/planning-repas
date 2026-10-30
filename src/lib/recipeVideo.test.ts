import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseRecipeVideo, RecipeParseError, MAX_VIDEO_BYTES } from "./recipeParser";

const GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const SESSION_URL = "https://upload.example/session-1";
const FILE_URL = "https://generativelanguage.googleapis.com/v1beta/files/abc";

const RECIPE = {
  name: "Pâtes tomate",
  portions: 2,
  ingredients: [{ name: "pâtes", quantity: 200, unit: "g" }],
  steps: ["Cuire les pâtes"],
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function json(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body, headers: new Headers() } as Response;
}

function fakeGemini(overrides: Record<string, Handler> = {}, states = ["PROCESSING", "ACTIVE"]) {
  let poll = 0;
  const handlers: Record<string, Handler> = {
    [UPLOAD_URL]: () =>
      ({ ok: true, headers: new Headers({ "x-goog-upload-url": SESSION_URL }) }) as Response,
    [SESSION_URL]: () => json({ file: { name: "files/abc", uri: FILE_URL } }),
    [GENERATE_URL]: () =>
      json({ candidates: [{ content: { parts: [{ text: JSON.stringify(RECIPE) }] } }] }),
    ...overrides,
  };
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === FILE_URL && init?.method === "DELETE") return json({});
    if (url === FILE_URL) return json({ state: states[Math.min(poll++, states.length - 1)] });
    const handler = handlers[url];
    if (!handler) throw new Error(`unexpected ${url}`);
    return handler(url, init);
  });
  return fetchImpl as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const VIDEO = { bytes: new Uint8Array([1, 2, 3, 4]), mimeType: "video/mp4" };
const noSleep = async () => {};

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return e instanceof RecipeParseError ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

describe("parseRecipeVideo", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uploads, waits for processing, analyses then deletes the file", async () => {
    const fetchImpl = fakeGemini();

    const result = await parseRecipeVideo(VIDEO, ["pâtes"], fetchImpl, noSleep);

    expect(result.name).toBe("Pâtes tomate");
    expect(result.steps).toEqual(["Cuire les pâtes"]);
    const calls = (fetchImpl as any).mock.calls as Array<[string, RequestInit?]>;
    expect(calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`)).toEqual([
      `POST ${UPLOAD_URL}`,
      `POST ${SESSION_URL}`,
      `GET ${FILE_URL}`,
      `GET ${FILE_URL}`,
      `POST ${GENERATE_URL}`,
      `DELETE ${FILE_URL}`,
    ]);

    const start = calls[0][1]!;
    expect((start.headers as Record<string, string>)["X-Goog-Upload-Header-Content-Type"]).toBe(
      "video/mp4"
    );
    expect((start.headers as Record<string, string>)["X-Goog-Upload-Header-Content-Length"]).toBe("4");

    const body = JSON.parse(calls[4][1]!.body as string);
    expect(body.contents[0].parts[0]).toEqual({
      fileData: { mimeType: "video/mp4", fileUri: FILE_URL },
    });
    expect(body.systemInstruction.parts[0].text).toContain("vidéo");
    expect(body.systemInstruction.parts[0].text).toContain("pâtes");
    for (const [url] of calls) expect(url).not.toContain("test-key");
  });

  it.each([
    ["empty", new Uint8Array(0), "video/mp4"],
    ["too big", { byteLength: MAX_VIDEO_BYTES + 1 } as unknown as Uint8Array, "video/mp4"],
    ["wrong type", new Uint8Array([1]), "application/pdf"],
  ])("rejects a %s video before any network call", async (_label, bytes, mimeType) => {
    const fetchImpl = fakeGemini();

    expect(await codeOf(parseRecipeVideo({ bytes, mimeType }, [], fetchImpl, noSleep))).toBe("empty");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is unavailable when the upload session cannot be opened", async () => {
    const fetchImpl = fakeGemini({
      [UPLOAD_URL]: () => ({ ok: false, headers: new Headers() }) as Response,
    });

    expect(await codeOf(parseRecipeVideo(VIDEO, [], fetchImpl, noSleep))).toBe("unavailable");
  });

  it("is unavailable when Gemini fails to process the file, and still deletes it", async () => {
    const fetchImpl = fakeGemini({}, ["PROCESSING", "FAILED"]);

    expect(await codeOf(parseRecipeVideo(VIDEO, [], fetchImpl, noSleep))).toBe("unavailable");
    const methods = ((fetchImpl as any).mock.calls as Array<[string, RequestInit?]>).map(
      ([, init]) => init?.method
    );
    expect(methods).toContain("DELETE");
  });

  it("deletes the file even when the analysis fails", async () => {
    const fetchImpl = fakeGemini({ [GENERATE_URL]: () => json({}, false) });

    expect(await codeOf(parseRecipeVideo(VIDEO, [], fetchImpl, noSleep))).toBe("unavailable");
    const last = ((fetchImpl as any).mock.calls as Array<[string, RequestInit?]>).at(-1)!;
    expect(last[1]?.method).toBe("DELETE");
  });

  it("reports an empty recipe when the video has no ingredients", async () => {
    const fetchImpl = fakeGemini({
      [GENERATE_URL]: () =>
        json({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ ...RECIPE, ingredients: [] }) }] } },
          ],
        }),
    });

    expect(await codeOf(parseRecipeVideo(VIDEO, [], fetchImpl, noSleep))).toBe("empty");
  });

  it("turns a network error into unavailable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch;

    expect(await codeOf(parseRecipeVideo(VIDEO, [], fetchImpl, noSleep))).toBe("unavailable");
  });
});
