import type { Position } from "./geo";
import type { RouteLocation } from "./location";

export type BicycleProfile = "road-bike" | "commuter-bike";
export type RoadPreference = "standard" | "small-roads";
export type TerrainPreference = "standard" | "flatter";
export type ReturnMode = "different-road" | "fastest";

export interface RoutePlanInput {
  locations: readonly RouteLocation[];
  profile: BicycleProfile;
  roadPreference: RoadPreference;
  terrainPreference: TerrainPreference;
  exclusions: readonly Position[];
  returnToStart: boolean;
  returnMode: ReturnMode;
}

export interface ElevationSample {
  distanceMeters: number;
  elevationMeters: number | null;
}

export interface RouteLeg {
  id: string;
  geometry: readonly Position[];
  distanceMeters: number;
  durationSeconds: number;
  elevation: readonly ElevationSample[];
  encodedShape: string;
}

export interface RouteMetrics {
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
}

export interface PlannedRoute {
  id: string;
  input: RoutePlanInput;
  outbound: RouteLeg;
  returnLeg: RouteLeg | null;
  geometry: readonly Position[];
  metrics: RouteMetrics;
  repeatedRoadRatio: number | null;
  limitedReturnAlternatives: boolean;
  createdAt: string;
}

export interface RoadSegment {
  id: string;
  beginShapeIndex: number;
  endShapeIndex: number;
  name: string | null;
  roadClass: "motorway" | "trunk" | "primary" | "secondary" | "tertiary" | "unclassified" | "residential" | "service" | "cycleway" | "other";
  surface: string | null;
  unpaved: boolean | null;
  use: string | null;
  wayId: string | null;
}
