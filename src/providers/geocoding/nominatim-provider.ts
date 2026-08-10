import type { GeocodingProvider, GeocodingResult } from "@/providers/contracts";
import { getRuntimeConfig } from "@/config/runtime-config";
import { abortableFetch } from "@/lib/abortable-request";
import { PRODUCT_LIMITS } from "@/domain/route";

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
  let lastCallTime = 0;

  return {
    async search(query: string, signal: AbortSignal): Promise<readonly GeocodingResult[]> {
      if (!config.geocodingEnabled) {
        return [];
      }

      const trimmed = query.trim();
      if (!trimmed) return [];

      const now = Date.now();
      const elapsed = now - lastCallTime;
      if (elapsed < PRODUCT_LIMITS.nominatimMinIntervalMs) {
        await new Promise((r) => setTimeout(r, PRODUCT_LIMITS.nominatimMinIntervalMs - elapsed));
      }
      lastCallTime = Date.now();

      const url = `${baseUrl}/search?format=jsonv2&countrycodes=id&limit=${PRODUCT_LIMITS.nominatimResultLimit}&accept-language=id&q=${encodeURIComponent(trimmed)}`;

      const result = await abortableFetch<NominatimResult[]>(
        url,
        {
          method: "GET",
          headers: { "User-Agent": "RideTopo/0.1" },
        },
        signal,
      );

      if (!result.ok) {
        throw new Error(result.error ?? "Pencarian gagal.");
      }

      return (result.data ?? []).map((item: NominatimResult) => ({
        id: String(item.place_id),
        label: item.display_name,
        position: [parseFloat(item.lon), parseFloat(item.lat)] as const,
        category: item.category ?? null,
      }));
    },
  };
}
