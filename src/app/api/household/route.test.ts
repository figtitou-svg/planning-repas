import { describe, it, expect } from "vitest";
import { GET, POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://x/api/household", { method: "POST", body: JSON.stringify(body) }));

describe("/api/household", () => {
  it("GET renvoie le foyer du cookie et la liste", async () => {
    const res = await GET(new Request("http://x/api/household", { headers: { cookie: "household=household-2" } }));
    const data = await res.json();
    expect(data.household).toBe("household-2");
    expect(data.households).toEqual([
      { id: "household-1", label: "Household 1" },
      { id: "household-2", label: "Household 2" },
    ]);
  });
  it("GET indique si un foyer a déjà été choisi sur l'appareil", async () => {
    const get = async (cookie?: string) =>
      (await GET(new Request("http://x/api/household", { headers: cookie ? { cookie } : {} }))).json();
    expect((await get()).chosen).toBe(false);
    expect((await get("household=hacker")).chosen).toBe(false);
    expect((await get("household=household-1")).chosen).toBe(true);
    expect((await get("household=household-2")).chosen).toBe(true);
  });
  it("POST pose le cookie", async () => {
    const res = await post({ household: "household-2" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/household=household-2/);
  });
  it("POST refuse un foyer inconnu ou un corps invalide", async () => {
    expect((await post({ household: "x" })).status).toBe(400);
    expect((await POST(new Request("http://x/api/household", { method: "POST", body: "pas du json" }))).status).toBe(400);
  });
});
