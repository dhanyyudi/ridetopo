import type { RoadSegment } from "@/domain/route";

export interface SegmentRange {
  id: string;
  startMeters: number;
  endMeters: number;
  beginShapeIndex: number;
  endShapeIndex: number;
}

function clampIndex(index: number, lastIndex: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.round(index), lastIndex));
}

/**
 * Position each traced ruas along the route by travelled distance.
 *
 * Shape indices are not evenly spaced — Valhalla emits more vertices through
 * curves — so a proportional index-to-distance guess misreports the km range.
 * Read the cumulative profile instead.
 */
export function buildSegmentRanges(
  segments: readonly RoadSegment[],
  cumulativeDistances: readonly number[],
): SegmentRange[] {
  if (cumulativeDistances.length === 0) return [];
  const lastIndex = cumulativeDistances.length - 1;

  return segments.map((segment) => {
    const beginShapeIndex = clampIndex(segment.beginShapeIndex, lastIndex);
    const endShapeIndex = Math.max(
      beginShapeIndex,
      clampIndex(segment.endShapeIndex, lastIndex),
    );
    return {
      id: segment.id,
      beginShapeIndex,
      endShapeIndex,
      startMeters: cumulativeDistances[beginShapeIndex]!,
      endMeters: cumulativeDistances[endShapeIndex]!,
    };
  });
}

/** The ruas covering a travelled distance, or the nearest one to it. */
export function findSegmentAtDistance(
  ranges: readonly SegmentRange[],
  distanceMeters: number,
): SegmentRange | null {
  if (ranges.length === 0) return null;

  for (const range of ranges) {
    if (distanceMeters >= range.startMeters && distanceMeters <= range.endMeters) {
      return range;
    }
  }

  let nearest = ranges[0]!;
  let nearestGap = Number.POSITIVE_INFINITY;
  for (const range of ranges) {
    const gap =
      distanceMeters < range.startMeters
        ? range.startMeters - distanceMeters
        : distanceMeters - range.endMeters;
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = range;
    }
  }
  return nearest;
}

/** Every ruas whose midpoint falls inside the shape-index bounds. */
export function segmentsWithinBounds(
  segments: readonly RoadSegment[],
  startShapeIndex: number,
  endShapeIndex: number,
): RoadSegment[] {
  const start = Math.min(startShapeIndex, endShapeIndex);
  const end = Math.max(startShapeIndex, endShapeIndex);
  return segments.filter((segment) => {
    const midpoint = (segment.beginShapeIndex + segment.endShapeIndex) / 2;
    return midpoint >= start && midpoint <= end;
  });
}

export interface CorridorBounds {
  startShapeIndex: number | null;
  endShapeIndex: number | null;
}

/**
 * Corridor picking is a two-tap gesture: first tap sets the start, second the
 * end, a third starts over. Shared by the segment list and the map so both
 * behave identically.
 */
export function advanceCorridor(
  corridor: CorridorBounds,
  segment: RoadSegment,
): CorridorBounds {
  if (corridor.startShapeIndex == null || corridor.endShapeIndex != null) {
    return { startShapeIndex: segment.beginShapeIndex, endShapeIndex: null };
  }
  return { startShapeIndex: corridor.startShapeIndex, endShapeIndex: segment.endShapeIndex };
}

/** Ordered shape-index bounds once both ends are set. */
export function corridorRange(
  corridor: CorridorBounds,
): { start: number; end: number } | null {
  if (corridor.startShapeIndex == null || corridor.endShapeIndex == null) return null;
  return {
    start: Math.min(corridor.startShapeIndex, corridor.endShapeIndex),
    end: Math.max(corridor.startShapeIndex, corridor.endShapeIndex),
  };
}
