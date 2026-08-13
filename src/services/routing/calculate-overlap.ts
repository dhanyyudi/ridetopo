import type { Position } from "@/domain/geo";
import type { RouteLeg } from "@/domain/route";
import { ROUND_TRIP_CONFIG } from "@/domain/route";

const R_EARTH = 6_371_000;

function haversineMeters(a: Position, b: Position): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * sinDLng * sinDLng;
  return 2 * R_EARTH * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function pointToSegmentDistanceMeters(
  point: Position,
  a: Position,
  b: Position,
): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const lenSq = vx * vx + vy * vy;

  if (lenSq < 1e-24) {
    return haversineMeters(point, a);
  }

  let t = ((point[0] - a[0]) * vx + (point[1] - a[1]) * vy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj: Position = [a[0] + t * vx, a[1] + t * vy];
  return haversineMeters(point, proj);
}

/** Build a cumulative distance profile for a geometry. */
export function cumulativeDistances(geometry: readonly Position[]): number[] {
  const distances: number[] = [0];
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineMeters(geometry[i - 1]!, geometry[i]!);
    distances.push(total);
  }
  return distances;
}

/** Find the geometry index at or before a given traveled distance. */
export function indexAtDistance(cumulative: readonly number[], distance: number): number {
  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i]! > distance) return i - 1;
  }
  return cumulative.length - 1;
}

/** Trim the first/last `meters` of traveled distance off a geometry. */
export function trimGeometryTerminals(
  geometry: readonly Position[],
  trimMeters: number,
): Position[] {
  if (geometry.length < 2 || trimMeters <= 0) return [...geometry] as Position[];

  const cumulative = cumulativeDistances(geometry);
  const total = cumulative[cumulative.length - 1]!;
  if (total <= trimMeters * 2) return [];

  const startIdx = indexAtDistance(cumulative, trimMeters);
  const endDistance = total - trimMeters;
  const endIdx = indexAtDistance(cumulative, endDistance);

  const startPt = interpolateAt(geometry, cumulative, trimMeters);
  const endPt = interpolateAt(geometry, cumulative, endDistance);

  const middle = geometry.slice(startIdx + 1, endIdx + 1) as Position[];
  return [startPt, ...middle, endPt];
}

function interpolateAt(
  geometry: readonly Position[],
  cumulative: readonly number[],
  distance: number,
): Position {
  const idx = indexAtDistance(cumulative, distance);
  if (idx >= geometry.length - 1) return geometry[geometry.length - 1]!;

  const a = geometry[idx]!;
  const b = geometry[idx + 1]!;
  const segStart = cumulative[idx]!;
  const segEnd = cumulative[idx + 1]!;
  const span = segEnd - segStart || 1;
  const t = (distance - segStart) / span;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Resample a geometry at fixed distance intervals. */
export function resampleByDistance(
  geometry: readonly Position[],
  intervalMeters: number,
): Position[] {
  if (geometry.length < 2) return [...geometry] as Position[];

  const cumulative = cumulativeDistances(geometry);
  const total = cumulative[cumulative.length - 1]!;
  const samples: Position[] = [];

  for (let d = 0; d <= total; d += intervalMeters) {
    samples.push(interpolateAt(geometry, cumulative, d));
  }
  if (samples[samples.length - 1] !== geometry[geometry.length - 1]) {
    samples.push(geometry[geometry.length - 1]!);
  }
  return samples;
}

interface GridCell {
  segments: { a: Position; b: Position }[];
}

function buildSpatialGrid(
  segments: readonly { a: Position; b: Position }[],
  cellSize: number,
): Map<string, GridCell> {
  const grid = new Map<string, GridCell>();
  for (const seg of segments) {
    const minLng = Math.min(seg.a[0], seg.b[0]);
    const maxLng = Math.max(seg.a[0], seg.b[0]);
    const minLat = Math.min(seg.a[1], seg.b[1]);
    const maxLat = Math.max(seg.a[1], seg.b[1]);

    const c0 = Math.floor(minLng / cellSize);
    const c1 = Math.floor(maxLng / cellSize);
    const r0 = Math.floor(minLat / cellSize);
    const r1 = Math.floor(maxLat / cellSize);

    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const key = `${c},${r}`;
        let cell = grid.get(key);
        if (!cell) {
          cell = { segments: [] };
          grid.set(key, cell);
        }
        cell.segments.push(seg);
      }
    }
  }
  return grid;
}

/**
 * Direction-insensitive overlap ratio: resample the candidate by distance,
 * exclude terminal zones on both sides, and measure how much of the scored
 * candidate length lies within the overlap tolerance of the outbound
 * corridor (also terminal-trimmed).
 */
export function calculateOverlapRatio(
  candidateGeometry: readonly Position[],
  outboundGeometry: readonly Position[],
): number {
  const cfg = ROUND_TRIP_CONFIG;
  const trim = Math.min(
    cfg.terminalTrimMaximumMeters,
    Math.max(cfg.terminalTrimMinimumMeters, 0),
  );

  const outboundTrimmed = trimGeometryTerminals(outboundGeometry, trim);
  const candidateTrimmed = trimGeometryTerminals(candidateGeometry, trim);

  if (outboundTrimmed.length < 2 || candidateTrimmed.length < 2) return 0;

  const corridorSegments: { a: Position; b: Position }[] = [];
  for (let i = 0; i < outboundTrimmed.length - 1; i++) {
    corridorSegments.push({ a: outboundTrimmed[i]!, b: outboundTrimmed[i + 1]! });
  }

  const grid = buildSpatialGrid(corridorSegments, 0.005);
  const samples = resampleByDistance(candidateTrimmed, cfg.sampleIntervalMeters);

  let overlapMeters = 0;
  let scoredMeters = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!;
    const b = samples[i + 1]!;
    const segLen = haversineMeters(a, b);
    scoredMeters += segLen;

    const mid: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (isNearCorridor(mid, grid, cfg.overlapToleranceMeters)) {
      overlapMeters += segLen;
    }
  }

  if (scoredMeters === 0) return 0;
  return Math.min(1, overlapMeters / scoredMeters);
}

function isNearCorridor(
  point: Position,
  grid: Map<string, GridCell>,
  tolerance: number,
): boolean {
  const col = Math.floor(point[0] / 0.005);
  const row = Math.floor(point[1] / 0.005);

  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const cell = grid.get(`${col + dc},${row + dr}`);
      if (!cell) continue;
      for (const seg of cell.segments) {
        if (pointToSegmentDistanceMeters(point, seg.a, seg.b) <= tolerance) {
          return true;
        }
      }
    }
  }
  return false;
}

export interface ReturnCandidateScore {
  overlapRatio: number;
  detourRatio: number;
  score: number;
  withinDetourCap: boolean;
}

/**
 * Score return candidates using the shortest valid candidate distance as the
 * detour reference together with the outbound distance.
 */
export function scoreReturnCandidates(
  candidates: readonly RouteLeg[],
  outbound: RouteLeg,
): {
  sorted: {
    leg: RouteLeg;
    score: ReturnCandidateScore;
  }[];
  detourReferenceMeters: number;
} {
  const cfg = ROUND_TRIP_CONFIG;

  const valid = candidates.filter((c) => c.distanceMeters > 0);
  if (valid.length === 0) return { sorted: [], detourReferenceMeters: 0 };

  const shortestCandidate = Math.min(...valid.map((c) => c.distanceMeters));
  const detourReference = Math.min(outbound.distanceMeters, shortestCandidate);
  const allowance = Math.min(
    cfg.detourMaximumAllowanceMeters,
    Math.max(cfg.detourMinimumAllowanceMeters, detourReference * cfg.detourRatioAllowance),
  );
  const cap = detourReference + allowance;

  const scored = valid.map((leg) => {
    const overlapRatio = calculateOverlapRatio(leg.geometry, outbound.geometry);
    const detourRatio =
      leg.distanceMeters > detourReference
        ? (leg.distanceMeters - detourReference) / Math.max(1, allowance)
        : 0;
    const normalizedDetour = Math.min(1, detourRatio);
    const score =
      cfg.overlapWeight * overlapRatio + cfg.detourWeight * normalizedDetour;
    return {
      leg,
      score: {
        overlapRatio,
        detourRatio,
        score,
        withinDetourCap: leg.distanceMeters <= cap,
      } satisfies ReturnCandidateScore,
    };
  });

  scored.sort((a, b) => {
    if (Math.abs(a.score.score - b.score.score) > 1e-9) return a.score.score - b.score.score;
    return a.leg.distanceMeters - b.leg.distanceMeters;
  });

  return { sorted: scored, detourReferenceMeters: detourReference };
}
