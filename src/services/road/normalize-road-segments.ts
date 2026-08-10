import type { RoadSegment } from "@/domain/route";

export function normalizeRoadSegments(raw: readonly RoadSegment[]): RoadSegment[] {
  return raw.map((seg, idx) => ({
    ...seg,
    id: seg.id || `segment-${idx}`,
  }));
}

export function findSegmentAtDistance(
  segments: readonly RoadSegment[],
  distanceMeters: number,
  routeLength: number,
): RoadSegment | null {
  if (segments.length === 0) return null;

  const ratio = distanceMeters / routeLength;

  for (const seg of segments) {
    const segStart = seg.beginShapeIndex;
    const segEnd = seg.endShapeIndex;
    const maxIdx = Math.max(...segments.map((s) => s.endShapeIndex));
    if (maxIdx === 0) return null;

    const segStartRatio = segStart / maxIdx;
    const segEndRatio = segEnd / maxIdx;

    if (ratio >= segStartRatio && ratio <= segEndRatio) {
      return seg;
    }
  }

  return null;
}
