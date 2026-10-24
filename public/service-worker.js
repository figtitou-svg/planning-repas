// Hors-ligne en lecture : la dernière liste de courses, les recettes et le stock restent
// consultables sans réseau (au supermarché, par exemple). Les écritures (cocher, ajouter…)
// nécessitent toujours la connexion.

const VERSION = "v3";
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// Au-delà de ce délai sans réponse du serveur, on sert la copie en cache (réseau faible).
const API_TIMEOUT_MS = 4000;
const PAGE_TIMEOUT_MS = 4000;
const MAX_RUNTIME_ENTRIES = 60;
const MAX_STATIC_ENTRIES = 200;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// `?fresh=1` demande une relecture côté serveur : même contenu, on garde une seule copie.
function cacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("fresh");
  return url.toString();
}

async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) {
    await cache.delete(key);
  }
}

// `copy` est un clone : la réponse d'origine part tout de suite vers la page, l'écriture se fait derrière.
async function store(cache, key, copy, maxEntries) {
  if (!copy.ok || copy.redirected) return;
  await cache.put(key, copy);
  await trim(cache, maxEntries);
}

// Réseau d'abord ; si le serveur tarde ou échoue, la copie en cache prend le relais.
// La requête réseau continue en arrière-plan pour rafraîchir le cache.
async function networkFirst(event, cacheName, timeoutMs, maxEntries) {
  const { request } = event;
  const key = cacheKey(request);
  const cache = await caches.open(cacheName);

  const network = fetch(request).then((response) => {
    event.waitUntil(store(cache, key, response.clone(), maxEntries));
    return response;
  });
  // Évite une erreur non gérée si la copie en cache a déjà répondu.
  event.waitUntil(network.catch(() => undefined));

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    return (await cache.match(key)) ?? network;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const home = await cache.match(new URL("/", request.url).toString());
      if (home) return home;
    }
    throw error;
  }
}

// Fichiers /_next/static/ : leur nom contient un hash, ils ne changent jamais.
async function cacheFirst(event, cacheName, maxEntries) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  event.waitUntil(store(cache, request, response.clone(), maxEntries));
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, STATIC_CACHE, MAX_STATIC_ENTRIES));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(event, RUNTIME_CACHE, API_TIMEOUT_MS, MAX_RUNTIME_ENTRIES));
    return;
  }
  // Pages complètes uniquement : les requêtes de navigation interne de Next (RSC) passent telles quelles.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(event, RUNTIME_CACHE, PAGE_TIMEOUT_MS, MAX_RUNTIME_ENTRIES));
  }
});
