import type { RouteLeg, RoadSegment, BicycleProfile, RoadPreference, TerrainPreference } from "@/domain/route";
import type { Position } from "@/domain/geo";

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
  routeCandidates(input: ProviderRouteRequest, signal: AbortSignal): Promise<readonly RouteLeg[]>;
  traceAttributes(encodedShape: string, signal: AbortSignal): Promise<readonly RoadSegment[]>;
}

export interface GeocodingProvider {
  search(query: string, signal: AbortSignal): Promise<readonly GeocodingResult[]>;
}

export type { RouteLeg, RoadSegment, BicycleProfile, RoadPreference, TerrainPreference, Position };
