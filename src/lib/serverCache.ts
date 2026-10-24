// Cache mémoire du processus serveur : évite de relire Notion (≈ 300-600 ms par appel,
// ≈ 3 requêtes/s max) à chaque page. L'état vit sur globalThis car Next peut charger
// ce module plusieurs fois (une fois par route) : sans ça, chaque route aurait son cache
// et une écriture n'invaliderait pas les lectures des autres routes.

interface CacheState {
  entries: Map<string, { value: unknown; expires: number }>;
  inflight: Map<string, Promise<unknown>>;
  generations: Map<string, number>;
}

const holder = globalThis as typeof globalThis & { __planningRepasCache?: CacheState };

function state(): CacheState {
  holder.__planningRepasCache ??= {
    entries: new Map(),
    inflight: new Map(),
    generations: new Map(),
  };
  return holder.__planningRepasCache;
}

export interface CacheOptions {
  /** Ignore la valeur en cache et relit la source (le résultat remplace l'ancienne valeur). */
  fresh?: boolean;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  { fresh = false }: CacheOptions = {}
): Promise<T> {
  const s = state();
  if (!fresh) {
    const hit = s.entries.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    // Deux requêtes simultanées partagent le même chargement.
    const pending = s.inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const generation = s.generations.get(key) ?? 0;
  const promise: Promise<T> = loader()
    .then((value) => {
      // Une écriture survenue pendant le chargement rend la valeur lue potentiellement périmée.
      if ((s.generations.get(key) ?? 0) === generation) {
        s.entries.set(key, { value, expires: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      if (s.inflight.get(key) === promise) s.inflight.delete(key);
    });
  s.inflight.set(key, promise);
  return promise;
}

/** Oublie `name` et toutes les clés `name:…` (ex. « meals » couvre « meals:2026-09-21 »). */
export function invalidate(name: string): void {
  const s = state();
  const matches = (key: string) => key === name || key.startsWith(`${name}:`);
  const keys = new Set([...s.entries.keys(), ...s.inflight.keys(), ...s.generations.keys()]);
  for (const key of keys) {
    if (!matches(key)) continue;
    s.entries.delete(key);
    s.inflight.delete(key);
    // Un chargement déjà en vol garde l'ancienne génération : son résultat ne sera pas stocké.
    s.generations.set(key, (s.generations.get(key) ?? 0) + 1);
  }
}

export function resetServerCache(): void {
  holder.__planningRepasCache = undefined;
}
