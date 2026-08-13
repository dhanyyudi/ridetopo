import type { ProviderRouteRequest } from "@/providers/contracts";
import type { ValhallaRouteRequest, ValhallaLinearCostFactor } from "./valhalla-types";
import { PRODUCT_LIMITS } from "@/domain/route";

export const SMALL_ROADS_USE_ROADS = 0.25;
export const FLATTER_USE_HILLS = 0.25;

export function buildValhallaRequest(input: ProviderRouteRequest): ValhallaRouteRequest {
  const locations = input.locations.map((pos) => ({
    lat: pos[1],
    lon: pos[0],
  }));

  const costingOptions: Record<string, Record<string, unknown>> = {
    bicycle: {
      bicycle_type: input.profile === "road-bike" ? "road" : "hybrid",
    },
  };

  if (input.roadPreference === "small-roads") {
    costingOptions.bicycle!.use_roads = SMALL_ROADS_USE_ROADS;
  }

  if (input.terrainPreference === "flatter") {
    costingOptions.bicycle!.use_hills = FLATTER_USE_HILLS;
  }

  const cappedExclusions = input.exclusions.slice(0, PRODUCT_LIMITS.maxExclusionLocations);

  const request: ValhallaRouteRequest = {
    locations,
    costing: "bicycle",
    costing_options: costingOptions,
    directions_options: { units: "kilometers" },
    elevation_interval: input.elevationIntervalMeters,
  };

  if (cappedExclusions.length > 0) {
    request.exclude_locations = cappedExclusions.map((pos) => ({
      lat: pos[1],
      lon: pos[0],
    }));
  }

  if (input.alternateCount) {
    request.alternates = input.alternateCount;
  }

  if (input.linearCostFactor && input.linearCostShape && input.linearCostShape.length >= 2) {
    const shape: ValhallaLinearCostFactor["shape"] = {
      type: "LineString",
      coordinates: input.linearCostShape.map((p) => [p[0], p[1]]),
    };
    request.linear_cost_factors = [{ shape, factor: input.linearCostFactor }];
  }

  return request;
}
