// File d'attente des coches faites sans réseau (au supermarché, par exemple). Une coche est un
// ÉTAT à poser (coché ou non) : rejouer plusieurs fois donne le même résultat, et seule la
// dernière valeur de chaque article compte.

export interface PendingCheck {
  weekStart: string;
  ingredientId: string;
  checked: boolean;
}

export const CHECK_QUEUE_KEY = "planning-repas:pending-checks";

type CheckKey = Pick<PendingCheck, "weekStart" | "ingredientId">;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

const sameKey = (a: CheckKey, b: CheckKey) =>
  a.weekStart === b.weekStart && a.ingredientId === b.ingredientId;

/** Ajoute la coche ; une coche en attente pour le même article est remplacée. */
export function enqueueCheck(queue: PendingCheck[], entry: PendingCheck): PendingCheck[] {
  return [...queue.filter((e) => !sameKey(e, entry)), entry];
}

/** Oublie la coche en attente de cet article (le serveur a maintenant la valeur la plus récente). */
export function dropCheck(queue: PendingCheck[], key: CheckKey): PendingCheck[] {
  return queue.filter((e) => !sameKey(e, key));
}

/**
 * Retire la coche envoyée, sauf si l'utilisateur l'a changée pendant l'envoi : la nouvelle
 * valeur, elle, doit rester en file.
 */
export function removeSent(queue: PendingCheck[], sent: PendingCheck): PendingCheck[] {
  return queue.filter((e) => !(sameKey(e, sent) && e.checked === sent.checked));
}

/** Coches du serveur pour `weekStart`, avec par-dessus celles qui attendent d'être envoyées. */
export function overlayChecks(
  weekStart: string,
  serverChecks: Record<string, boolean>,
  queue: PendingCheck[]
): Record<string, boolean> {
  const merged = { ...serverChecks };
  for (const entry of queue) {
    if (entry.weekStart === weekStart) merged[entry.ingredientId] = entry.checked;
  }
  return merged;
}

/** Lit la file enregistrée ; un contenu absent ou abîmé donne une file vide. */
export function parseQueue(raw: string | null): PendingCheck[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e): e is PendingCheck =>
        typeof e === "object" &&
        e !== null &&
        typeof e.weekStart === "string" &&
        typeof e.ingredientId === "string" &&
        typeof e.checked === "boolean"
    );
  } catch {
    return [];
  }
}

export function loadQueue(storage: StorageLike): PendingCheck[] {
  try {
    return parseQueue(storage.getItem(CHECK_QUEUE_KEY));
  } catch {
    return [];
  }
}

export function saveQueue(storage: StorageLike, queue: PendingCheck[]): void {
  try {
    storage.setItem(CHECK_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la coche reste affichée mais ne survivra pas à un rechargement.
  }
}
