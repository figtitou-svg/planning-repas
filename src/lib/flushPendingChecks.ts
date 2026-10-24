import { loadQueue, removeSent, saveQueue, type PendingCheck } from "./checkQueue";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type PutResult = "saved" | "rejected" | "retry" | "offline";

/**
 * Envoie la file des coches en attente, dans l'ordre ; s'arrête au premier échec réseau ou
 * serveur. Renvoie le nombre de coches encore en attente (0 = file vide).
 */
export async function flushPendingChecks(
  storage: StorageLike,
  put: (entry: PendingCheck) => Promise<PutResult>
): Promise<number> {
  for (const entry of loadQueue(storage)) {
    const result = await put(entry);
    if (result === "offline" || result === "retry") break;
    // « saved » ou « rejected » : dans les deux cas, la coche quitte la file.
    saveQueue(storage, removeSent(loadQueue(storage), entry));
  }
  return loadQueue(storage).length;
}
