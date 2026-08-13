import { z } from "zod";
import type { DraftV1 } from "@/domain/export";
import type { PlannedRoute, RoadSegment } from "@/domain/route";
import type { Position } from "@/domain/geo";
import type { ExclusionItem } from "@/store/route-planner-store";
import { PRODUCT_LIMITS } from "@/domain/route";

const positionSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);

const routeLocationSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["origin", "waypoint", "destination"]),
  position: positionSchema,
  label: z.string(),
  source: z.enum(["search", "map", "geolocation"]),
});

const elevationSampleSchema = z.object({
  distanceMeters: z.number().finite().min(0),
  elevationMeters: z.number().finite().nullable(),
});

const routeLegSchema = z.object({
  id: z.string().min(1),
  geometry: z.array(positionSchema),
  distanceMeters: z.number().finite().positive(),
  durationSeconds: z.number().finite().min(0),
  elevation: z.array(elevationSampleSchema),
  encodedShape: z.string(),
});

const routeMetricsSchema = z.object({
  distanceMeters: z.number().finite().positive(),
  durationSeconds: z.number().finite().min(0),
  elevationGainMeters: z.number().finite().nullable(),
  elevationLossMeters: z.number().finite().nullable(),
});

const routePlanInputSchema = z.object({
  locations: z.array(routeLocationSchema),
  profile: z.enum(["road-bike", "commuter-bike"]),
  roadPreference: z.enum(["standard", "small-roads"]),
  terrainPreference: z.enum(["standard", "flatter"]),
  exclusions: z.array(positionSchema).max(PRODUCT_LIMITS.maxExclusionLocations),
  returnToStart: z.boolean(),
  returnMode: z.enum(["different-road", "fastest"]),
});

const plannedRouteSchema = z.object({
  id: z.string().min(1),
  input: routePlanInputSchema,
  outbound: routeLegSchema,
  returnLeg: routeLegSchema.nullable(),
  geometry: z.array(positionSchema),
  metrics: routeMetricsSchema,
  repeatedRoadRatio: z.number().finite().nullable(),
  limitedReturnAlternatives: z.boolean(),
  createdAt: z.string().datetime(),
});

const roadSegmentSchema = z.object({
  id: z.string().min(1),
  beginShapeIndex: z.number().int().min(0),
  endShapeIndex: z.number().int().min(0),
  name: z.string().nullable(),
  roadClass: z.enum([
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "service",
    "cycleway",
    "other",
  ]),
  surface: z.string().nullable(),
  unpaved: z.boolean().nullable(),
  use: z.string().nullable(),
  wayId: z.string().nullable(),
});

export const draftV1Schema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  route: plannedRouteSchema,
  roadSegments: z.array(roadSegmentSchema).nullable(),
  activeExclusions: z.array(positionSchema).max(PRODUCT_LIMITS.maxExclusionLocations),
});

export function buildDraftFromRoute(
  route: PlannedRoute,
  roadSegments: RoadSegment[] | null,
  activeExclusions: readonly Position[],
): DraftV1 {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    route,
    roadSegments: roadSegments ?? null,
    activeExclusions: [...activeExclusions],
  };
}

export function parseDraft(raw: unknown): DraftV1 | null {
  const result = draftV1Schema.safeParse(raw);
  return result.success ? result.data : null;
}

export function exclusionsToItems(exclusions: readonly Position[]): ExclusionItem[] {
  return exclusions.map((p, i) => ({
    id: `excl-${i}-${p[0].toFixed(6)}-${p[1].toFixed(6)}`,
    position: p,
    label: "Hindaran",
  }));
}
