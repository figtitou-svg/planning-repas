/** Quantité arrondie à 2 décimales, virgule décimale : « 833,33 ». */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

/** « 6 pièces », « 1 pièce », « 250 g » : seule l'unité « pièce » prend un pluriel. */
export function formatAmount(value: number, unit: string): string {
  const plural = unit === "pièce" && Math.abs(value) >= 2 ? "pièces" : unit;
  return `${formatQuantity(value)} ${plural}`;
}
