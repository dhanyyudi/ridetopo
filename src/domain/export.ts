import type { PlannedRoute, RoadSegment } from "./route";
import type { Position } from "./geo";

export interface DraftV1 {
  version: 1;
  savedAt: string;
  route: PlannedRoute;
  roadSegments: readonly RoadSegment[] | null;
  activeExclusions: readonly Position[];
}

export interface RouteCardData {
  distanceLabel: string;
  elevationGainLabel: string | null;
  estimatedTimeLabel: string;
  geometry: readonly Position[];
}

export interface RouteCardAssets {
  logo: HTMLImageElement | ImageBitmap;
  fontFamily: "Plus Jakarta Sans";
}
