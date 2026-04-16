/**
 * Generic TTL cache for taxonomy data (categories, brands).
 *
 * D-25 contract: never raises into the MCP transport.
 * - On fresh fetch success: returns { fresh: true, value }
 * - Within TTL: returns cached value as { fresh: true, value }
 * - After TTL, upstream fails, cache exists: returns { stale: true, last_fetched_at, value }
 * - After TTL, upstream fails, no cache: returns { error: { code: "UPSTREAM_UNAVAILABLE", message } }
 */

/** Default TTL: 60 minutes per D-25. */
export const TAXONOMY_TTL_MS = 60 * 60 * 1000;

export type TaxonomyFreshResult<T> = { fresh: true; value: T };
export type TaxonomyStaleResult<T> = {
  stale: true;
  last_fetched_at: string;
  value: T;
};
export type TaxonomyErrorResult = {
  error: { code: "UPSTREAM_UNAVAILABLE"; message: string };
};
export type TaxonomyResult<T> =
  | TaxonomyFreshResult<T>
  | TaxonomyStaleResult<T>
  | TaxonomyErrorResult;

export interface TaxonomyCache {
  get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs?: number,
  ): Promise<TaxonomyResult<T>>;
}

interface CacheEntry {
  value: unknown;
  fetchedAt: number;
}

export function createTaxonomyCache(): TaxonomyCache {
  const store = new Map<string, CacheEntry>();

  return {
    async get<T>(
      key: string,
      fetchFn: () => Promise<T>,
      ttlMs: number = TAXONOMY_TTL_MS,
    ): Promise<TaxonomyResult<T>> {
      const existing = store.get(key);
      const now = Date.now();

      // Within TTL — return cached value as fresh
      if (existing && now - existing.fetchedAt <= ttlMs) {
        return { fresh: true, value: existing.value as T };
      }

      // Cold or expired — attempt fetch
      try {
        const value = await fetchFn();
        store.set(key, { value, fetchedAt: now });
        return { fresh: true, value };
      } catch (err: unknown) {
        // D-25: never re-raise — return stale or error
        if (existing) {
          return {
            stale: true,
            last_fetched_at: new Date(existing.fetchedAt).toISOString(),
            value: existing.value as T,
          };
        }
        return {
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },
  };
}
