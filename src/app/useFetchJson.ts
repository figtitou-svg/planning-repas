"use client";

import { useCallback, useEffect, useState } from "react";

export type FetchState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

/** Charge `url` (JSON) ; une réponse d'une adresse abandonnée est ignorée. `reload` relance. */
export function useFetchJson<T>(url: string | null): { state: FetchState<T>; reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("bad status");
        const data: T = await response.json();
        if (!controller.signal.aborted) setState({ status: "ready", data });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [url, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
