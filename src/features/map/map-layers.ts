import type { Position } from "@/domain/geo";
import type { TerrainClass, TerrainSection } from "@/domain/elevation";
import { cumulativeDistances } from "@/services/routing/calculate-overlap";

export const ROUTE_CASING_LAYER = "route-casing";
export const ROUTE_CORE_LAYER = "route-core";
export const ROUTE_HIT_LAYER = "route-hit";
export const ROUTE_SELECTION_LAYER = "route-selection";

/* Mirrors --color-terrain-* in tokens.css. MapLibre paint values cannot read
   CSS variables, so the terrain palette lives here in one place. */
export const TERRAIN_COLORS: Record<TerrainClass, string> = {
  climb: "#D97706",
  flat: "#0F766E",
  descent: "#2563EB",
};

export const ROUTE_NEUTRAL_COLOR = TERRAIN_COLORS.flat;
export const ROUTE_SELECTION_COLOR = "#C2410C";

/** Spans the elevation profile could not classify. */
export const TERRAIN_UNKNOWN = "unknown";

/** Data-driven colour; anything unclassified falls through to neutral. */
export const TERRAIN_COLOR_EXPRESSION = [
  "match",
  ["get", "terrain"],
  "climb",
  TERRAIN_COLORS.climb,
  "descent",
  TERRAIN_COLORS.descent,
  ROUTE_NEUTRAL_COLOR,
];

export type TerrainFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { terrain: string }
>;

function feature(
  coordinates: readonly Position[],
  classification: string,
): GeoJSON.Feature<GeoJSON.LineString, { terrain: string }> {
  return {
    type: "Feature",
    properties: { terrain: classification },
    geometry: {
      type: "LineString",
      coordinates: coordinates.map((p) => [p[0], p[1]]),
    },
  };
}

/**
 * Split the route into one LineString per terrain section so the map can show
 * climbs, flats, and descents.
 *
 * Stretches the profile could not classify — a gap in the elevation data, or
 * the tail of a partial profile — are emitted as their own neutral spans.
 * Extending the last classified section to the end of the route instead would
 * paint an unknown tail as a climb or a descent it was never measured to be.
 */
export function buildTerrainFeatures(
  geometry: readonly Position[],
  terrain: readonly TerrainSection[],
): TerrainFeatureCollection {
  if (geometry.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  const classified = terrain.filter((section) => section.classification !== null);
  if (classified.length === 0) {
    return { type: "FeatureCollection", features: [feature(geometry, TERRAIN_UNKNOWN)] };
  }

  const cumulative = cumulativeDistances(geometry);
  const lastIndex = geometry.length - 1;
  const features: GeoJSON.Feature<GeoJSON.LineString, { terrain: string }>[] = [];

  /* Sections arrive in order, so one walking cursor resolves every bound. */
  let indexCursor = 0;
  const indexAtDistance = (distanceMeters: number): number => {
    while (indexCursor < lastIndex && cumulative[indexCursor + 1]! <= distanceMeters) {
      indexCursor++;
    }
    return indexCursor;
  };

  const pushSpan = (from: number, to: number, classification: string) => {
    if (to <= from) return;
    const coordinates = geometry.slice(from, to + 1);
    if (coordinates.length >= 2) features.push(feature(coordinates, classification));
  };

  let cursor = 0;
  for (const section of classified) {
    const start = indexAtDistance(section.startDistanceMeters);
    const end = indexAtDistance(section.endDistanceMeters);

    /* Anything before this section was never classified. */
    pushSpan(cursor, start, TERRAIN_UNKNOWN);
    pushSpan(Math.max(cursor, start), end, section.classification!);
    cursor = Math.max(cursor, end);
  }

  /* And the tail, when the profile ran out before the route did. */
  pushSpan(cursor, lastIndex, TERRAIN_UNKNOWN);

  if (features.length === 0) {
    return { type: "FeatureCollection", features: [feature(geometry, TERRAIN_UNKNOWN)] };
  }

  return { type: "FeatureCollection", features };
}
