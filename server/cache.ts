interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * In-memory TTL cache with concurrent in-flight request deduplication
 * and stale-on-error resilience.
 */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  forceRefresh = false
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (!forceRefresh && existing && existing.expiresAt > now) {
    return existing.value;
  }

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) {
    return running;
  }

  const promise = (async () => {
    try {
      const value = await fetcher();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } catch (err) {
      if (existing) {
        return existing.value;
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function clearCache() {
  store.clear();
}
