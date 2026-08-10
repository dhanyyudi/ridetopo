import type { ProviderRouteRequest } from "@/providers/contracts";
import type { ValhallaRouteRequest } from "./valhalla-types";
import { PRODUCT_LIMITS } from "@/domain/route";

export function buildValhallaRequest(input: ProviderRouteRequest): ValhallaRouteRequest {
  const locations = input.locations.map((pos) => ({
    lat: pos[1],
    lon: pos[0],
  }));

  const costingOptions: Record<string, Record<string, unknown>> = {
    bicycle: {
      bicycle_type: input.profile === "road-bike" ? "road" : "hybrid",
      maneuver_penalty: 30,
    },
  };

  if (input.roadPreference === "small-roads") {
    costingOptions.bicycle!.use_roads = 0.25;
  }

  if (input.terrainPreference === "flatter") {
    costingOptions.bicycle!.use_hills = 0.25;
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

  if (input.linearCostFactor && input.linearCostShape?.length) {
    const factor = input.linearCostFactor;
    const shapeLen = input.linearCostShape.length;
    request.linear_cost_factors = new Array(shapeLen).fill(factor) as number[];
  }

  return request;
}
