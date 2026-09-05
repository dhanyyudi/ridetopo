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

/** Data-driven colour so one source carries every terrain section. */
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
 * climbs, flats, and descents. Neighbouring sections share their boundary
 * vertex, so the drawn line stays continuous. The classification travels as a
 * feature property; the legend supplies the words.
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
    return { type: "FeatureCollection", features: [feature(geometry, "flat")] };
  }

  const cumulative = cumulativeDistances(geometry);
  const lastIndex = geometry.length - 1;
  const features: GeoJSON.Feature<GeoJSON.LineString, { terrain: string }>[] = [];

  let cursor = 0;
  for (let s = 0; s < classified.length; s++) {
    const section = classified[s]!;
    const isLast = s === classified.length - 1;

    let endIndex = cursor;
    while (endIndex < lastIndex && cumulative[endIndex + 1]! <= section.endDistanceMeters) {
      endIndex++;
    }
    if (isLast) endIndex = lastIndex;
    if (endIndex <= cursor) endIndex = Math.min(cursor + 1, lastIndex);

    const coordinates = geometry.slice(cursor, endIndex + 1);
    if (coordinates.length >= 2) {
      features.push(feature(coordinates, section.classification!));
    }

    cursor = endIndex;
    if (cursor >= lastIndex) break;
  }

  if (features.length === 0) {
    return { type: "FeatureCollection", features: [feature(geometry, "flat")] };
  }

  return { type: "FeatureCollection", features };
}
