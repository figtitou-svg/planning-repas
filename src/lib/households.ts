// Un foyer = un planning, un stock et des courses séparés ; recettes et ingrédients sont communs.
export const HOUSEHOLDS = [
  { id: "household-1", label: process.env.HOUSEHOLD_1_LABEL || "Household 1", envSuffix: "" },
  { id: "household-2", label: process.env.HOUSEHOLD_2_LABEL || "Household 2", envSuffix: "_2" },
] as const;

export type HouseholdId = (typeof HOUSEHOLDS)[number]["id"];

export const DEFAULT_HOUSEHOLD: HouseholdId = "household-1";
export const HOUSEHOLD_COOKIE = "household";

export function parseHousehold(value: string | null | undefined): HouseholdId {
  return HOUSEHOLDS.find((h) => h.id === value)?.id ?? DEFAULT_HOUSEHOLD;
}

function householdCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === HOUSEHOLD_COOKIE) return rest.join("=");
  }
  return null;
}

export function householdFromRequest(request: Request): HouseholdId {
  return parseHousehold(householdCookie(request));
}

/** Vrai si cet appareil a déjà choisi un foyer (cookie présent et valide). */
export function hasChosenHousehold(request: Request): boolean {
  return HOUSEHOLDS.some((h) => h.id === householdCookie(request));
}

export function householdEnvSuffix(household: HouseholdId): string {
  return HOUSEHOLDS.find((h) => h.id === household)!.envSuffix;
}
