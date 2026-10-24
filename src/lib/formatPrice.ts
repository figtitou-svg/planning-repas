const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** « 3,20 € » : virgule décimale et espace insécable, comme en français. */
export function formatPrice(value: number): string {
  return euros.format(Number.isFinite(value) ? value : 0);
}
