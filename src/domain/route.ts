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
  roadClass:
    | "motorway"
    | "trunk"
    | "primary"
    | "secondary"
    | "tertiary"
    | "unclassified"
    | "residential"
    | "service"
    | "cycleway"
    | "other";
  surface: string | null;
  unpaved: boolean | null;
  use: string | null;
  wayId: string | null;
}

export const PRODUCT_LIMITS = {
  maxIntermediateWaypoints: 20,
  maxRouteMeters: 500_000,
  maxExclusionLocations: 50,
  routeDebounceMs: 650,
  nominatimMinIntervalMs: 1_000,
  nominatimResultLimit: 5,
} as const;

export const ROUND_TRIP_CONFIG = {
  linearCostFactor: 5,
  alternateCount: 2,
  sampleIntervalMeters: 30,
  overlapToleranceMeters: 35,
  terminalTrimMinimumMeters: 300,
  terminalTrimMaximumMeters: 1_000,
  terminalTrimRatio: 0.02,
  detourRatioAllowance: 0.35,
  detourMinimumAllowanceMeters: 10_000,
  detourMaximumAllowanceMeters: 50_000,
  highOverlapWarningRatio: 0.6,
  overlapWeight: 0.75,
  detourWeight: 0.25,
} as const;

export const ELEVATION_CONFIG = {
  intervalMeters: 30,
  maximumInterpolatedGapSamples: 3,
  maximumInterpolatedGapMeters: 90,
  medianWindowSamples: 3,
  noiseRunMeters: 3,
  gradeWindowMeters: 90,
  climbThreshold: 0.02,
  descentThreshold: -0.02,
  displayRoundingMeters: 5,
} as const;
