import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "@notionhq/client";
import {
  addExtra,
  isMissingExtraProperty,
  isMissingQuantityProperty,
  listChecks, listExtras,
  removeExtra,
  setCheck,
  setExtraQuantity,
} from "./shoppingChecks";

vi.mock("../notionConfig", () => ({
  notionConfig: { shoppingChecksDbId: (household: string) =>
      household === "household-2" ? "db-shopping-checks-2" : "db-shopping-checks" },
}));

function checkPage(id: string, weekStart: string, ingredientId: string, checked: boolean) {
  return {
    id,
    properties: {
      Semaine: { date: { start: weekStart } },
      Ingredient: { relation: [{ id: ingredientId }] },
      Coché: { checkbox: checked },
    },
  };
}

function extraPage(id: string, ingredientId: string, props: { added?: boolean; quantity?: number | null }) {
  const page = checkPage(id, "2026-09-14", ingredientId, false);
  return {
    ...page,
    properties: {
      ...page.properties,
      Ajouté: { checkbox: props.added ?? true },
      ...(props.quantity === undefined ? {} : { Quantité: { number: props.quantity } }),
    },
  };
}

function fakeClient(): Client {
  return {
    databases: { query: vi.fn() },
    pages: { create: vi.fn(), update: vi.fn() },
  } as unknown as Client;
}

describe("shoppingChecks repository", () => {
  let client: Client;

  beforeEach(() => {
    client = fakeClient();
  });

  it("interroge la base du foyer 2", async () => {
    (client.databases.query as any).mockResolvedValue({ results: [], has_more: false, next_cursor: null });

    await listChecks(client, "household-2", "2026-09-14");

    expect(client.databases.query).toHaveBeenCalledWith(
      expect.objectContaining({ database_id: "db-shopping-checks-2" })
    );
  });

  it("lists checks for a week as an ingredientId -> checked map", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [
        checkPage("c-1", "2026-09-14", "ing-flour", true),
        checkPage("c-2", "2026-09-14", "ing-milk", false),
      ],
    });

    const result = await listChecks(client, "household-1", "2026-09-14");

    expect(result).toEqual({ "ing-flour": true, "ing-milk": false });
    expect(client.databases.query).toHaveBeenCalledWith({
      database_id: "db-shopping-checks",
      filter: { property: "Semaine", date: { equals: "2026-09-14" } },
    });
  });

  it("updates the existing row when one exists for (week, ingredient)", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [checkPage("c-1", "2026-09-14", "ing-flour", false)],
    });
    (client.pages.update as any).mockResolvedValue(
      checkPage("c-1", "2026-09-14", "ing-flour", true)
    );

    await setCheck(client, "household-1", "2026-09-14", "ing-flour", true);

    expect(client.pages.update).toHaveBeenCalledWith({
      page_id: "c-1",
      properties: { Coché: { checkbox: true } },
    });
    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it("looks up the existing row by week AND ingredient in a single filtered query", async () => {
    (client.databases.query as any).mockResolvedValue({
      results: [checkPage("c-1", "2026-09-14", "ing-flour", false)],
    });

    await setCheck(client, "household-1", "2026-09-14", "ing-flour", true);

    expect(client.databases.query).toHaveBeenCalledTimes(1);
    expect(client.databases.query).toHaveBeenCalledWith({
      database_id: "db-shopping-checks",
      filter: {
        and: [
          { property: "Semaine", date: { equals: "2026-09-14" } },
          { property: "Ingredient", relation: { contains: "ing-flour" } },
        ],
      },
      start_cursor: undefined,
    });
  });

  it("creates a new row when none exists yet for (week, ingredient)", async () => {
    (client.databases.query as any).mockResolvedValue({ results: [] });
    (client.pages.create as any).mockResolvedValue(
      checkPage("new-c", "2026-09-21", "ing-eggs", true)
    );

    await setCheck(client, "household-1", "2026-09-21", "ing-eggs", true);

    expect(client.pages.create).toHaveBeenCalledWith({
      parent: { database_id: "db-shopping-checks" },
      properties: {
        Semaine: { date: { start: "2026-09-21" } },
        Ingredient: { relation: [{ id: "ing-eggs" }] },
        Coché: { checkbox: true },
      },
    });
  });

  describe("articles ajoutés à la main", () => {
    it("lists only the ingredients flagged « Ajouté » for the week", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [
          checkPage("c-1", "2026-09-14", "ing-milk", false),
          checkPage("c-2", "2026-09-14", "ing-eggs", true),
        ],
      });

      const result = await listExtras(client, "household-1", "2026-09-14");

      expect(result).toEqual([
        { ingredientId: "ing-milk", quantity: null },
        { ingredientId: "ing-eggs", quantity: null },
      ]);
      expect(client.databases.query).toHaveBeenCalledWith({
        database_id: "db-shopping-checks",
        filter: {
          and: [
            { property: "Semaine", date: { equals: "2026-09-14" } },
            { property: "Ajouté", checkbox: { equals: true } },
          ],
        },
        start_cursor: undefined,
      });
    });

    it("returns no extras when the « Ajouté » property does not exist yet in Notion", async () => {
      (client.databases.query as any).mockRejectedValue({
        code: "validation_error",
        message: "Could not find property with name or id: Ajouté",
      });

      await expect(listExtras(client, "household-1", "2026-09-14")).resolves.toEqual([]);
    });

    it("still throws on any other Notion error", async () => {
      (client.databases.query as any).mockRejectedValue({ code: "rate_limited", message: "slow down" });

      await expect(listExtras(client, "household-1", "2026-09-14")).rejects.toMatchObject({ code: "rate_limited" });
    });

    it("recognises only the missing-property error", () => {
      expect(
        isMissingExtraProperty({ code: "validation_error", message: "Could not find property with name or id: Ajouté" })
      ).toBe(true);
      expect(isMissingExtraProperty({ code: "validation_error", message: "Could not find property: Semaine" })).toBe(false);
      expect(isMissingExtraProperty(new Error("boom"))).toBe(false);
      expect(isMissingExtraProperty(undefined)).toBe(false);
    });

    it("creates a flagged, unchecked row when the ingredient has no row yet", async () => {
      (client.databases.query as any).mockResolvedValue({ results: [] });

      await addExtra(client, "household-1", "2026-09-14", "ing-milk");

      expect(client.pages.create).toHaveBeenCalledWith({
        parent: { database_id: "db-shopping-checks" },
        properties: {
          Semaine: { date: { start: "2026-09-14" } },
          Ingredient: { relation: [{ id: "ing-milk" }] },
          Coché: { checkbox: false },
          Ajouté: { checkbox: true },
        },
      });
    });

    it("flags the existing row and unchecks it instead of creating a duplicate", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [checkPage("c-1", "2026-09-14", "ing-milk", true)],
      });

      await addExtra(client, "household-1", "2026-09-14", "ing-milk");

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: true }, Coché: { checkbox: false } },
      });
      expect(client.pages.create).not.toHaveBeenCalled();
    });

    it("reads the typed quantity of an extra, null when absent or empty", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [
          extraPage("c-1", "ing-flour", { quantity: 500 }),
          extraPage("c-2", "ing-milk", { quantity: null }),
          extraPage("c-3", "ing-eggs", {}),
        ],
      });

      await expect(listExtras(client, "household-1", "2026-09-14")).resolves.toEqual([
        { ingredientId: "ing-flour", quantity: 500 },
        { ingredientId: "ing-milk", quantity: null },
        { ingredientId: "ing-eggs", quantity: null },
      ]);
    });

    it("recognises only the missing « Quantité » property error", () => {
      expect(
        isMissingQuantityProperty({ code: "validation_error", message: "Quantité is not a property that exists." })
      ).toBe(true);
      expect(isMissingQuantityProperty({ code: "validation_error", message: "Ajouté is not a property" })).toBe(false);
      expect(isMissingQuantityProperty(undefined)).toBe(false);
    });

    it("stores the typed quantity on a new row", async () => {
      (client.databases.query as any).mockResolvedValue({ results: [] });

      await addExtra(client, "household-1", "2026-09-14", "ing-flour", 500);

      expect(client.pages.create).toHaveBeenCalledWith({
        parent: { database_id: "db-shopping-checks" },
        properties: {
          Semaine: { date: { start: "2026-09-14" } },
          Ingredient: { relation: [{ id: "ing-flour" }] },
          Coché: { checkbox: false },
          Ajouté: { checkbox: true },
          Quantité: { number: 500 },
        },
      });
    });

    it("adds the new quantity to the one already typed for the week", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { quantity: 500 })],
      });

      await addExtra(client, "household-1", "2026-09-14", "ing-flour", 250);

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: true }, Coché: { checkbox: false }, Quantité: { number: 750 } },
      });
    });

    it("starts again from the new quantity when the row was not an extra any more", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { added: false, quantity: 500 })],
      });

      await addExtra(client, "household-1", "2026-09-14", "ing-flour", 250);

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: true }, Coché: { checkbox: false }, Quantité: { number: 250 } },
      });
    });

    it("clears a stale quantity when an extra comes back without one", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { added: false, quantity: 500 })],
      });

      await addExtra(client, "household-1", "2026-09-14", "ing-flour");

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: true }, Coché: { checkbox: false }, Quantité: { number: null } },
      });
    });

    it("keeps the quantity of a row that is still an extra when re-added without one", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { quantity: 500 })],
      });

      await addExtra(client, "household-1", "2026-09-14", "ing-flour");

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: true }, Coché: { checkbox: false } },
      });
    });

    it("replaces the typed quantity of an extra (no accumulation)", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { quantity: 500 })],
      });

      await expect(setExtraQuantity(client, "household-1", "2026-09-14", "ing-flour", 200)).resolves.toBe(true);

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Quantité: { number: 200 } },
      });
    });

    it("clears the typed quantity with null", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { quantity: 500 })],
      });

      await expect(setExtraQuantity(client, "household-1", "2026-09-14", "ing-flour", null)).resolves.toBe(true);

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Quantité: { number: null } },
      });
    });

    it("does nothing for an item that is not an extra of that week", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { added: false, quantity: 500 })],
      });

      await expect(setExtraQuantity(client, "household-1", "2026-09-14", "ing-flour", 200)).resolves.toBe(false);
      (client.databases.query as any).mockResolvedValue({ results: [] });
      await expect(setExtraQuantity(client, "household-1", "2026-09-14", "ing-flour", 200)).resolves.toBe(false);

      expect(client.pages.update).not.toHaveBeenCalled();
    });

    it("clears the quantity on removal when the property exists", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [extraPage("c-1", "ing-flour", { quantity: 500 })],
      });

      await removeExtra(client, "household-1", "2026-09-14", "ing-flour");

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: false }, Coché: { checkbox: false }, Quantité: { number: null } },
      });
    });

    it("unflags and unchecks the row on removal", async () => {
      (client.databases.query as any).mockResolvedValue({
        results: [checkPage("c-1", "2026-09-14", "ing-milk", true)],
      });

      await removeExtra(client, "household-1", "2026-09-14", "ing-milk");

      expect(client.pages.update).toHaveBeenCalledWith({
        page_id: "c-1",
        properties: { Ajouté: { checkbox: false }, Coché: { checkbox: false } },
      });
    });

    it("does nothing when removing an item that has no row", async () => {
      (client.databases.query as any).mockResolvedValue({ results: [] });

      await removeExtra(client, "household-1", "2026-09-14", "ing-milk");

      expect(client.pages.update).not.toHaveBeenCalled();
      expect(client.pages.create).not.toHaveBeenCalled();
    });
  });
});
