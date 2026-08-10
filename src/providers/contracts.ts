import type { Position } from "@/domain/geo";
import type { RouteLocation } from "@/domain/location";
import type { RouteLeg, RoadSegment, BicycleProfile, RoadPreference, TerrainPreference } from "@/domain/route";
export type { Position, RouteLocation, RouteLeg, RoadSegment, BicycleProfile, RoadPreference, TerrainPreference };

export interface ProviderRouteRequest {
  locations: readonly Position[];
  profile: BicycleProfile;
  roadPreference: RoadPreference;
  terrainPreference: TerrainPreference;
  exclusions: readonly Position[];
  elevationIntervalMeters: 30;
  alternateCount?: 2;
  linearCostShape?: readonly Position[];
  linearCostFactor?: number;
}

export interface GeocodingResult {
  id: string;
  label: string;
  position: Position;
  category: string | null;
}

export interface RoutingProvider {
  route(input: ProviderRouteRequest, signal: AbortSignal): Promise<readonly RouteLeg[]>;
  traceAttributes(encodedShape: string, signal: AbortSignal): Promise<readonly RoadSegment[]>;
}

export interface GeocodingProvider {
  search(query: string, signal: AbortSignal): Promise<readonly GeocodingResult[]>;
}
