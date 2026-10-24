"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dropCheck,
  enqueueCheck,
  loadQueue,
  removeSent,
  saveQueue,
  type PendingCheck,
} from "@/lib/checkQueue";

export type PutResult = "saved" | "rejected" | "retry" | "offline";

/**
 * Envoie une coche. « offline » : pas de réseau, à remettre en file. « retry » : erreur
 * serveur passagère. « rejected » : le serveur refuse cette coche, inutile de la renvoyer.
 */
export async function putCheck(entry: PendingCheck): Promise<PutResult> {
  try {
    const response = await fetch("/api/shopping-checks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (response.ok) return "saved";
    return response.status >= 500 ? "retry" : "rejected";
  } catch {
    return "offline";
  }
}

/**
 * Coches faites sans réseau, gardées dans le navigateur (elles survivent à la fermeture de
 * l'app) et envoyées dès que possible. Le stockage fait foi ; `pendingCount` sert à l'affichage.
 */
export function useCheckQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const flushing = useRef(false);

  const read = useCallback((): PendingCheck[] => {
    try {
      return loadQueue(window.localStorage);
    } catch {
      return [];
    }
  }, []);

  const write = useCallback((queue: PendingCheck[]) => {
    try {
      saveQueue(window.localStorage, queue);
    } catch {}
    setPendingCount(queue.length);
  }, []);

  // Après l'hydratation : le serveur ne connaît pas le stockage du navigateur.
  useEffect(() => {
    setPendingCount(read().length);
  }, [read]);

  const record = useCallback((entry: PendingCheck) => write(enqueueCheck(read(), entry)), [read, write]);

  const forget = useCallback(
    (key: Pick<PendingCheck, "weekStart" | "ingredientId">) => write(dropCheck(read(), key)),
    [read, write]
  );

  /** Envoie la file dans l'ordre ; s'arrête au premier échec réseau ou serveur. Vrai si quelque chose est parti. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (flushing.current) return false;
    const queue = read();
    if (queue.length === 0) return false;
    flushing.current = true;
    let sentAny = false;
    try {
      for (const entry of queue) {
        const result = await putCheck(entry);
        if (result === "offline" || result === "retry") break;
        // « saved » ou « rejected » : dans les deux cas, la coche quitte la file.
        write(removeSent(read(), entry));
        sentAny = true;
      }
    } finally {
      flushing.current = false;
    }
    return sentAny;
  }, [read, write]);

  return { pendingCount, read, record, forget, flush };
}
