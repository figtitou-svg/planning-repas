"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // En dev, les fichiers /_next/static/ gardent le même nom : une copie en cache servirait du code périmé.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      caches
        .keys()
        .then((names) => names.forEach((name) => caches.delete(name)))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Non critique (ex: HTTP hors localhost) : l'app fonctionne sans hors-ligne.
    });
  }, []);
  return null;
}
