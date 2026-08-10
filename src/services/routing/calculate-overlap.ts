import type { Position } from "@/domain/geo";
import { ROUND_TRIP_CONFIG } from "@/domain/route";

interface GridCell {
  segments: { start: Position; end: Position; index: number }[];
}

function buildSpatialGrid(
  segments: { start: Position; end: Position }[],
  cellSize: number,
): Map<string, GridCell> {
  const grid = new Map<string, GridCell>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const [minLng, minLat] = [
      Math.min(seg.start[0], seg.end[0]),
      Math.min(seg.start[1], seg.end[1]),
    ];
    const [maxLng, maxLat] = [
      Math.max(seg.start[0], seg.end[0]),
      Math.max(seg.start[1], seg.end[1]),
    ];

    const startCol = Math.floor(minLng / cellSize);
    const endCol = Math.floor(maxLng / cellSize);
    const startRow = Math.floor(minLat / cellSize);
    const endRow = Math.floor(maxLat / cellSize);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const key = `${col},${row}`;
        if (!grid.has(key)) {
          grid.set(key, { segments: [] });
        }
        grid.get(key)!.segments.push({ ...seg, index: i });
      }
    }
  }

  return grid;
}

function pointToSegmentDistance(
  point: Position,
  segStart: Position,
  segEnd: Position,
): number {
  const dx = segEnd[0] - segStart[0];
  const dy = segEnd[1] - segStart[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-20) {
    const pdx = point[0] - segStart[0];
    const pdy = point[1] - segStart[1];
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  let t = ((point[0] - segStart[0]) * dx + (point[1] - segStart[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLng = segStart[0] + t * dx;
  const projLat = segStart[1] + t * dy;

  const pdx = point[0] - projLng;
  const pdy = point[1] - projLat;
  const degDist = Math.sqrt(pdx * pdx + pdy * pdy);

  return degDist * 111_320;
}

export function calculateOverlapRatio(
  candidateGeometry: readonly Position[],
  outboundGeometry: readonly Position[],
): number {
  const sampleInterval = ROUND_TRIP_CONFIG.sampleIntervalMeters;
  const tolerance = ROUND_TRIP_CONFIG.overlapToleranceMeters;

  const outboundSegments = [];
  for (let i = 0; i < outboundGeometry.length - 1; i++) {
    outboundSegments.push({
      start: outboundGeometry[i]!,
      end: outboundGeometry[i + 1]!,
    });
  }

  const cellSize = 0.01;
  const grid = buildSpatialGrid(outboundSegments, cellSize);

  const candidateLen = candidateGeometry.length;
  let overlapCount = 0;
  let totalSamples = 0;

  for (let i = 0; i < candidateLen; i++) {
    if (i > 0) {
      const prev = candidateGeometry[i - 1]!;
      const curr = candidateGeometry[i]!;
      const segDist = Math.sqrt(
        Math.pow((curr[0] - prev[0]) * 111_320 * Math.cos((curr[1] * Math.PI) / 180), 2) +
        Math.pow((curr[1] - prev[1]) * 111_320, 2),
      );
      const steps = Math.max(1, Math.ceil(segDist / sampleInterval));

      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        const sampleLng = prev[0] + (curr[0] - prev[0]) * t;
        const sampleLat = prev[1] + (curr[1] - prev[1]) * t;
        const samplePt: Position = [sampleLng, sampleLat];
        totalSamples++;

        const col = Math.floor(sampleLng / cellSize);
        const row = Math.floor(sampleLat / cellSize);

        let isOverlapping = false;
        for (let dc = -1; dc <= 1 && !isOverlapping; dc++) {
          for (let dr = -1; dr <= 1 && !isOverlapping; dr++) {
            const key = `${col + dc},${row + dr}`;
            const cell = grid.get(key);
            if (cell) {
              for (const seg of cell.segments) {
                const dist = pointToSegmentDistance(samplePt, seg.start, seg.end);
                if (dist <= tolerance) {
                  isOverlapping = true;
                  break;
                }
              }
            }
          }
        }
        if (isOverlapping) overlapCount++;
      }
    }
  }

  if (totalSamples === 0) return 0;
  return overlapCount / totalSamples;
}

export function scoreReturnCandidate(
  route: { distanceMeters: number; geometry: readonly Position[] },
  outboundGeometry: readonly Position[],
  outboundDistance: number,
): {
  overlapRatio: number;
  detourRatio: number;
  score: number;
  withinDetourCap: boolean;
} {
  const overlapRatio = calculateOverlapRatio(route.geometry, outboundGeometry);

  const reference = Math.min(outboundDistance, route.distanceMeters);
  const detourAllowance = Math.min(
    ROUND_TRIP_CONFIG.detourMaximumAllowanceMeters,
    Math.max(ROUND_TRIP_CONFIG.detourMinimumAllowanceMeters, reference * ROUND_TRIP_CONFIG.detourRatioAllowance),
  );
  const maxDistance = reference + detourAllowance;
  const detourRatio = route.distanceMeters > reference
    ? (route.distanceMeters - reference) / maxDistance
    : 0;

  const normalizedDetour = Math.min(1, detourRatio);
  const withinDetourCap = route.distanceMeters <= maxDistance;

  const score =
    ROUND_TRIP_CONFIG.overlapWeight * overlapRatio +
    ROUND_TRIP_CONFIG.detourWeight * normalizedDetour;

  return { overlapRatio, detourRatio, score, withinDetourCap };
}
