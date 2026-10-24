/** « 1,5 » ou « 1.5 » → 1.5 ; vide → null ; texte ou nombre ≤ 0 → undefined (saisie invalide). */
export function parseQuantityInput(text: string): number | null | undefined {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
