import type { RoadSegment } from "./route";
import { COPY } from "@/content/id";

export interface RoadSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

/* Wording lives in the central copy module; this only maps class to string. */
const ROAD_CLASS_DESCRIPTIONS: Record<RoadSegment["roadClass"], string> = {
  motorway: COPY.roadClassMotorway,
  trunk: COPY.roadClassTrunk,
  primary: COPY.roadClassPrimary,
  secondary: COPY.roadClassSecondary,
  tertiary: COPY.roadClassTertiary,
  unclassified: COPY.roadClassUnclassified,
  residential: COPY.roadClassResidential,
  service: COPY.roadClassService,
  cycleway: COPY.roadClassCycleway,
  other: COPY.roadClassOther,
};

const SURFACE_LABELS: Record<string, string> = {
  asphalt: "Aspal",
  paved: "Beraspal",
  concrete: "Beton",
  gravel: "Kerikil",
  dirt: "Tanah",
  sand: "Pasir",
  compacted: "Tanah padat",
  unpaved: "Tidak beraspal",
};

export const UNNAMED_ROAD_LABEL = COPY.unnamedRoad;
export const SURFACE_UNKNOWN_LABEL = COPY.surfaceUnknown;
export const LOCAL_ROAD_LABEL = COPY.roadClassLocal;

export function getRoadDisplayName(segment: RoadSegment): string {
  return segment.name ?? UNNAMED_ROAD_LABEL;
}

export function getRoadClassDescription(segment: RoadSegment): string {
  return ROAD_CLASS_DESCRIPTIONS[segment.roadClass];
}

export function getSurfaceLabel(segment: RoadSegment): string | null {
  if (!segment.surface) return SURFACE_UNKNOWN_LABEL;
  return SURFACE_LABELS[segment.surface] ?? segment.surface;
}
