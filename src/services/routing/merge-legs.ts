import type { RouteLeg, ElevationSample, PlannedRoute } from "@/domain/route";
import type { Position } from "@/domain/geo";
import { encodePolyline6 } from "@/lib/polyline6";

const JOIN_TOLERANCE_DEGREES = 1e-7;
const JOIN_TOLERANCE_METERS = 0.5;

function isSamePoint(a: Position | undefined, b: Position | undefined): boolean {
  if (!a || !b) return false;
  return (
    Math.abs(a[0] - b[0]) < JOIN_TOLERANCE_DEGREES &&
    Math.abs(a[1] - b[1]) < JOIN_TOLERANCE_DEGREES
  );
}

/** Concatenate leg geometries without duplicating shared join vertices. */
export function mergeGeometries(geometries: readonly (readonly Position[])[]): Position[] {
  const merged: Position[] = [];
  for (const geometry of geometries) {
    if (geometry.length === 0) continue;
    if (merged.length > 0 && isSamePoint(merged[merged.length - 1], geometry[0])) {
      merged.push(...(geometry.slice(1) as Position[]));
    } else {
      merged.push(...(geometry as Position[]));
    }
  }
  return merged;
}

/**
 * Shift each leg's elevation samples onto a shared cumulative distance axis.
 * Leg samples restart at 0, so every leg after the first is offset by the
 * distance travelled before it; the shared join sample is not duplicated.
 */
export function mergeElevationSampleSets(
  legs: readonly { distanceMeters: number; elevation: readonly ElevationSample[] }[],
): ElevationSample[] {
  const merged: ElevationSample[] = [];
  let offset = 0;

  for (const leg of legs) {
    for (const sample of leg.elevation) {
      const distanceMeters = offset + sample.distanceMeters;
      const last = merged[merged.length - 1];

      if (last && distanceMeters - last.distanceMeters < JOIN_TOLERANCE_METERS) {
        /* Deduplicate the join sample; prefer a real reading over a gap. */
        if (last.elevationMeters === null && sample.elevationMeters !== null) {
          merged[merged.length - 1] = { ...last, elevationMeters: sample.elevationMeters };
        }
        continue;
      }

      merged.push({ distanceMeters, elevationMeters: sample.elevationMeters });
    }
    offset += leg.distanceMeters;
  }

  return merged;
}

/**
 * Collapse the legs of one Valhalla trip into a single RouteLeg.
 *
 * Valhalla returns one leg per consecutive location pair, so a route with
 * intermediate waypoints arrives as several legs. The product model treats a
 * whole trip as one leg, so distance, duration, geometry, and elevation must
 * be joined before anything downstream reads them.
 */
export function mergeRouteLegs(legs: readonly RouteLeg[]): RouteLeg {
  if (legs.length === 0) {
    throw new Error("Tidak ada leg rute untuk digabungkan.");
  }
  const first = legs[0]!;
  if (legs.length === 1) return first;

  const geometry = mergeGeometries(legs.map((leg) => leg.geometry));
  const elevation = mergeElevationSampleSets(legs);

  return {
    id: first.id,
    geometry,
    distanceMeters: legs.reduce((total, leg) => total + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((total, leg) => total + leg.durationSeconds, 0),
    elevation,
    /* Re-encoded so trace_attributes and exports see the whole trip. */
    encodedShape: encodePolyline6(geometry),
  };
}

/**
 * Elevation for the whole planned route on one cumulative distance axis.
 * Return-leg samples restart at zero, so they must be shifted before any
 * chart, summary, or export reads them.
 */
export function combinedElevationSamples(route: PlannedRoute): ElevationSample[] {
  const legs = route.returnLeg ? [route.outbound, route.returnLeg] : [route.outbound];
  return mergeElevationSampleSets(legs);
}
