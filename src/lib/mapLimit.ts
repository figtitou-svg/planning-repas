/**
 * Comme `Promise.all(items.map(fn))`, mais avec au plus `limit` appels en même temps
 * (Notion tolère environ 3 requêtes par seconde). Les résultats gardent l'ordre des éléments.
 * Après une erreur, plus aucun nouvel appel n'est lancé ; la première erreur est relancée
 * une fois les appels en cours terminés.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  let firstError: unknown;

  async function worker(): Promise<void> {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  if (failed) throw firstError;
  return results;
}
