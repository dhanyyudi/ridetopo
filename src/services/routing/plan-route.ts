import type { RoutePlanInput, PlannedRoute } from "@/domain/route";
import type { RoutingProvider, ProviderRouteRequest } from "@/providers/contracts";
import { PRODUCT_LIMITS, ELEVATION_CONFIG } from "@/domain/route";
import { hashRoute } from "@/lib/hash-route";
import { straightLineDistance, distanceBetween } from "@/domain/geo";
import { analyzeElevation } from "@/domain/elevation";
import {
  planRoundTrip,
  mergeLegGeometry,
  mergeElevationSamples,
  checkCombinedRouteLimit,
} from "./plan-round-trip";

export class RouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteError";
  }
}

/**
 * Plan a point-to-point or round-trip route. Round trips always use two
 * provider calls (outbound, then return) and the combined 500 km gate.
 */
export async function planRoute(
  input: RoutePlanInput,
  provider: RoutingProvider,
  signal: AbortSignal,
): Promise<PlannedRoute> {
  const orderedPositions = input.locations.map((loc) => loc.position);

  /* Straight-line length is a lower bound on the ride, so anything over the
     cap here cannot possibly fit. Reject before spending a route request. */
  if (straightLineLowerBound(input) > PRODUCT_LIMITS.maxRouteMeters) {
    throw new RouteError("Maksimal total rute 500 km.");
  }

  const request: ProviderRouteRequest = {
    locations: orderedPositions,
    profile: input.profile,
    roadPreference: input.roadPreference,
    terrainPreference: input.terrainPreference,
    exclusions: input.exclusions,
    elevationIntervalMeters: ELEVATION_CONFIG.intervalMeters as 30,
  };

  const legs = await provider.route(request, signal);
  const outbound = legs[0];

  if (!outbound) {
    throw new RouteError("Tidak ditemukan rute yang dapat digunakan.");
  }

  if (outbound.distanceMeters > PRODUCT_LIMITS.maxRouteMeters) {
    throw new RouteError("Maksimal total rute 500 km.");
  }

  if (!input.returnToStart) {
    const elevation = analyzeElevation(outbound.elevation, outbound.distanceMeters);
    const id = await hashRoute([outbound.encodedShape]);

    return {
      id,
      input,
      outbound,
      returnLeg: null,
      geometry: outbound.geometry,
      metrics: {
        distanceMeters: outbound.distanceMeters,
        durationSeconds: outbound.durationSeconds,
        elevationGainMeters: elevation.gainMeters,
        elevationLossMeters: elevation.lossMeters,
      },
      repeatedRoadRatio: null,
      limitedReturnAlternatives: false,
      createdAt: new Date().toISOString(),
    };
  }

  /* Round trip: outbound first, then the return leg */
  const { returnLeg, repeatedRoadRatio, limited } = await planRoundTrip(
    input,
    outbound,
    provider,
    signal,
  );

  checkCombinedRouteLimit(outbound, returnLeg);

  const combinedGeometry = mergeLegGeometry(outbound, returnLeg);
  const combinedElevation = mergeElevationSamples(outbound, returnLeg);
  const combinedDistance = outbound.distanceMeters + returnLeg.distanceMeters;
  const combinedDuration = outbound.durationSeconds + returnLeg.durationSeconds;
  const elevation = analyzeElevation(combinedElevation, combinedDistance);

  const id = await hashRoute([outbound.encodedShape, returnLeg.encodedShape]);

  return {
    id,
    input,
    outbound,
    returnLeg,
    geometry: combinedGeometry,
    metrics: {
      distanceMeters: combinedDistance,
      durationSeconds: combinedDuration,
      elevationGainMeters: elevation.gainMeters,
      elevationLossMeters: elevation.lossMeters,
    },
    repeatedRoadRatio,
    limitedReturnAlternatives: limited,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Shortest conceivable length of the requested ride: the straight lines
 * between its points, plus the way back when the round trip is on.
 */
export function straightLineLowerBound(input: RoutePlanInput): number {
  const positions = input.locations.map((loc) => loc.position);
  if (positions.length < 2) return 0;

  let total = straightLineDistance(positions);
  if (input.returnToStart) {
    total += distanceBetween(positions[positions.length - 1]!, positions[0]!);
  }
  return total;
}
