import type { RoutePlanInput, PlannedRoute } from "@/domain/route";
import type { RoutingProvider, ProviderRouteRequest } from "@/providers/contracts";
import { PRODUCT_LIMITS, ELEVATION_CONFIG } from "@/domain/route";
import { hashRoute } from "@/lib/hash-route";

export class RouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteError";
  }
}

export async function planRoute(
  input: RoutePlanInput,
  provider: RoutingProvider,
  signal: AbortSignal,
): Promise<PlannedRoute> {
  const orderedPositions = input.locations.map((loc) => loc.position);

  if (!input.returnToStart && orderedPositions.length < 2) {
    throw new RouteError("Minimal 2 lokasi diperlukan.");
  }

  const request: ProviderRouteRequest = {
    locations: orderedPositions,
    profile: input.profile,
    roadPreference: input.roadPreference,
    terrainPreference: input.terrainPreference,
    exclusions: input.exclusions,
    elevationIntervalMeters: ELEVATION_CONFIG.intervalMeters as 30,
  };

  const route = await provider.route(request, signal);

  if (route.length === 0) {
    throw new RouteError("Tidak ditemukan rute yang dapat digunakan.");
  }

  const outbound = route[0]!;

  if (outbound.distanceMeters > PRODUCT_LIMITS.maxRouteMeters) {
    throw new RouteError("Maksimal total rute 500 km.");
  }

  const combinedGeometry = outbound.geometry;
  const totalDistance = outbound.distanceMeters;
  const totalDuration = outbound.durationSeconds;

  const id = await hashRoute([outbound.encodedShape]);

  return {
    id,
    input,
    outbound,
    returnLeg: null,
    geometry: combinedGeometry,
    metrics: {
      distanceMeters: totalDistance,
      durationSeconds: totalDuration,
      elevationGainMeters: null,
      elevationLossMeters: null,
    },
    repeatedRoadRatio: null,
    limitedReturnAlternatives: false,
    createdAt: new Date().toISOString(),
  };
}
