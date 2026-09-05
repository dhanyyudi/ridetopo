import type { GeocodingProvider, GeocodingResult } from "@/providers/contracts";
import { getRuntimeConfig } from "@/config/runtime-config";
import { abortableFetch } from "@/lib/abortable-request";
import { PRODUCT_LIMITS } from "@/domain/route";
import { createRateLimiter } from "@/lib/throttle";

const MAX_CACHED_QUERIES = 20;

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  category?: string;
}

export function createNominatimProvider(): GeocodingProvider {
  const config = getRuntimeConfig();
  if (!config) {
    throw new Error("Runtime config not loaded");
  }

  const baseUrl = config.nominatimBaseUrl.replace(/\/+$/, "");
  /* Small per-session cache for identical queries, and a serialised gate so
     one tab cannot exceed the one-request-per-second usage policy even when
     two searches are submitted in the same second. */
  const cache = new Map<string, readonly GeocodingResult[]>();
  const waitForSlot = createRateLimiter(PRODUCT_LIMITS.nominatimMinIntervalMs);

  return {
    async search(query: string, signal: AbortSignal): Promise<readonly GeocodingResult[]> {
      if (!config.geocodingEnabled) {
        return [];
      }

      const trimmed = query.trim();
      if (!trimmed) return [];

      const key = trimmed.toLowerCase();
      const cached = cache.get(key);
      if (cached) return cached;

      await waitForSlot();
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const url = `${baseUrl}/search?format=jsonv2&countrycodes=id&limit=${PRODUCT_LIMITS.nominatimResultLimit}&accept-language=id&q=${encodeURIComponent(trimmed)}`;

      /* No User-Agent header: browsers forbid setting it, so the request
         identifies itself through the Referer the browser sends. */
      const result = await abortableFetch<NominatimResult[]>(url, { method: "GET" }, signal);

      if (!result.ok) {
        throw new Error(result.error ?? "Pencarian gagal.");
      }

      const normalized: readonly GeocodingResult[] = (result.data ?? []).map(
        (item: NominatimResult) => ({
          id: String(item.place_id),
          label: item.display_name,
          position: [parseFloat(item.lon), parseFloat(item.lat)] as const,
          category: item.category ?? null,
        }),
      );

      cache.set(key, normalized);
      if (cache.size > MAX_CACHED_QUERIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      return normalized;
    },
  };
}
