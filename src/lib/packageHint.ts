import type { Ingredient, Unit } from "./types";

function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

// Rounds away floating point noise (0.3 * 200 = 60.00000000000001) without
// losing the precision a partial package needs (75 g of 200 g = 0.375).
function roundClean(value: number): number {
  return Number(value.toFixed(4));
}

export function packagesToQuantity(packages: number, packageSize: number): number {
  return roundClean(packages * packageSize);
}

// 0 when the package size is unknown, rather than dividing by zero.
export function quantityToPackages(quantity: number, packageSize: number): number {
  if (!(packageSize > 0)) return 0;
  return roundClean(quantity / packageSize);
}

// « 75 g », « 6 pièces » — a quantity with its unit, ready to display.
export function formatQuantity(quantity: number, unit: Unit): string {
  const rounded = Number(quantity.toFixed(2));
  const unitLabel = unit === "pièce" && rounded >= 2 ? "pièces" : unit;
  return `${formatNumber(rounded)} ${unitLabel}`;
}

// « paquet de 200 g » — null when the package size is unknown (0 / missing).
export function packageLabel(ingredient: Pick<Ingredient, "unit" | "packageSize">): string | null {
  const { unit, packageSize } = ingredient;
  if (!(packageSize > 0)) return null;
  const unitLabel = unit === "pièce" && packageSize > 1 ? "pièces" : unit;
  return `paquet de ${formatNumber(packageSize)} ${unitLabel}`;
}

// « = 1 paquet » / « ≈ 0,38 paquet » — how many packages a quantity represents.
// null when there is nothing meaningful to show (no quantity, or no package size).
export function quantityInPackages(quantity: number, packageSize: number): string | null {
  if (!Number.isFinite(quantity) || !(quantity > 0) || !(packageSize > 0)) return null;
  const ratio = quantity / packageSize;
  const rounded = Number(ratio.toFixed(2));
  const sign = Math.abs(ratio - rounded) < 1e-9 ? "=" : "≈";
  const noun = rounded >= 2 ? "paquets" : "paquet";
  return `${sign} ${formatNumber(rounded)} ${noun}`;
}
