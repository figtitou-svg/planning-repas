import { describe, it, expect } from "vitest";
import {
  badgeText,
  bellLabel,
  expiryStatus,
  formatDay,
  missingText,
} from "./notificationsView";

describe("badgeText", () => {
  it("hides the badge at 0, negative or invalid counts", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-2)).toBeNull();
    expect(badgeText(Number.NaN)).toBeNull();
  });

  it("shows the count up to 9 and caps beyond", () => {
    expect(badgeText(1)).toBe("1");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(9.5)).toBe("9");
    expect(badgeText(10)).toBe("9+");
    expect(badgeText(250)).toBe("9+");
  });
});

describe("bellLabel", () => {
  it("is the plain name when there is nothing to report", () => {
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(Number.NaN)).toBe("Notifications");
  });

  it("includes the real, uncapped count", () => {
    expect(bellLabel(1)).toBe("Notifications, 1 à traiter");
    expect(bellLabel(12)).toBe("Notifications, 12 à traiter");
  });
});

describe("expiryStatus", () => {
  it("words already expired, today and upcoming", () => {
    expect(expiryStatus(-2)).toBe("Périmé depuis 2 j");
    expect(expiryStatus(0)).toBe("Périme aujourd'hui");
    expect(expiryStatus(3)).toBe("Périme dans 3 j");
  });
});

describe("formatDay", () => {
  it("formats a calendar day as dd/mm/yyyy", () => {
    expect(formatDay("2026-09-20")).toBe("20/09/2026");
  });

  it("returns an empty string for malformed input", () => {
    expect(formatDay("")).toBe("");
    expect(formatDay("demain")).toBe("");
    expect(formatDay("2026-13-40")).toBe("");
  });
});

describe("missingText", () => {
  it("lists what is missing in French", () => {
    expect(missingText(["packageSize", "packagePrice", "shelfLifeDays"])).toBe(
      "Manque : taille du paquet, prix, durée de conservation"
    );
    expect(missingText(["shelfLifeDays"])).toBe("Manque : durée de conservation");
  });
});
