import type { Position } from "@/domain/geo";

export interface RoadSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

export function buildExclusionLocations(
  selection: RoadSelection,
  geometry: readonly Position[],
  existing: readonly Position[],
  maximum: number,
): readonly Position[] {
  const start = Math.max(0, selection.startShapeIndex);
  const end = Math.min(geometry.length - 1, selection.endShapeIndex);
  const slice = geometry.slice(start, end + 1);

  if (slice.length === 0) return existing;

  const midpoint = slice[Math.floor(slice.length / 2)]!;

  const deduped = existing.filter(
    (p) =>
      Math.abs(p[0] - midpoint[0]) > 0.0001 || Math.abs(p[1] - midpoint[1]) > 0.0001,
  );

  const combined = [...deduped, midpoint];

  if (combined.length > maximum) {
    const step = Math.ceil(combined.length / maximum);
    return combined.filter((_, i) => i % step === 0).slice(0, maximum);
  }

  return combined;
}
