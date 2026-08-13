import type { Position } from "@/domain/geo";
import { PRODUCT_LIMITS } from "@/domain/route";

export interface RoadSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

/**
 * Build exclusion candidate locations from the midpoints of the selected
 * edges, deduplicated and deterministically downsampled to the budget.
 */
export function buildExclusionLocations(
  selection: RoadSelection,
  geometry: readonly Position[],
  existing: readonly Position[],
  maximum: number = PRODUCT_LIMITS.maxExclusionLocations,
): readonly Position[] {
  if (geometry.length === 0 || maximum <= 0) return existing;

  const start = Math.max(0, Math.min(selection.startShapeIndex, geometry.length - 1));
  const end = Math.max(start, Math.min(selection.endShapeIndex, geometry.length - 1));

  const slice = geometry.slice(start, end + 1);
  if (slice.length === 0) return existing;

  const midpoint = slice[Math.floor(slice.length / 2)]!;

  const combined = [...existing];
  if (!isNearExisting(midpoint, combined)) {
    combined.push(midpoint);
  }

  if (combined.length <= maximum) {
    return combined;
  }

  /* Deterministic even downsample to fit the remaining budget */
  const step = Math.ceil(combined.length / maximum);
  const sampled = combined.filter((_, i) => i % step === 0);
  return sampled.slice(0, maximum);
}

/**
 * Build exclusion candidates from multiple selected edge midpoints,
 * deduplicated and deterministically downsampled.
 */
export function buildMultiEdgeExclusions(
  edgeRanges: readonly { beginShapeIndex: number; endShapeIndex: number }[],
  geometry: readonly Position[],
  existing: readonly Position[],
  maximum: number = PRODUCT_LIMITS.maxExclusionLocations,
): readonly Position[] {
  if (geometry.length === 0 || maximum <= 0) return existing;

  const combined = [...existing];

  for (const edge of edgeRanges) {
    const start = Math.max(0, Math.min(edge.beginShapeIndex, geometry.length - 1));
    const end = Math.max(start, Math.min(edge.endShapeIndex, geometry.length - 1));
    const slice = geometry.slice(start, end + 1);
    if (slice.length === 0) continue;

    const midpoint = slice[Math.floor(slice.length / 2)]!;
    if (!isNearExisting(midpoint, combined)) {
      combined.push(midpoint);
    }
  }

  if (combined.length <= maximum) {
    return combined;
  }

  const step = Math.ceil(combined.length / maximum);
  const sampled = combined.filter((_, i) => i % step === 0);
  return sampled.slice(0, maximum);
}

function isNearExisting(position: Position, existing: readonly Position[]): boolean {
  return existing.some(
    (p) => Math.abs(p[0] - position[0]) < 1e-5 && Math.abs(p[1] - position[1]) < 1e-5,
  );
}
