import type { Position } from "@/domain/geo";
import { pointToSegmentDistanceMeters } from "@/services/routing/calculate-overlap";

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

export interface AvoidanceValidationOptions {
  /** Crossing tolerance in meters. */
  toleranceMeters?: number;
  /** Terminal contact allowance in meters at either end of the candidate. */
  terminalAllowanceMeters?: number;
}

/**
 * Returns `true` only when the candidate route no longer follows the avoided
 * corridor beyond the permitted terminal contact/tolerance.
 *
 * Compares complete line segments (segment-to-segment distance), not
 * vertex-to-vertex proximity, so a crossing between sparse vertices is still
 * detected.
 */
export function validateAvoidance(
  avoidedGeometry: readonly Position[],
  candidateGeometry: readonly Position[],
  options: AvoidanceValidationOptions = {},
): boolean {
  const tolerance = options.toleranceMeters ?? 20;
  const terminalAllowance = options.terminalAllowanceMeters ?? 40;

  if (avoidedGeometry.length < 2) return true;
  if (candidateGeometry.length < 2) return true;

  /* Candidate traveled distance profile for terminal contact checks */
  const cumulative = [0];
  for (let i = 1; i < candidateGeometry.length; i++) {
    cumulative.push(
      cumulative[i - 1]! + haversineMeters(candidateGeometry[i - 1]!, candidateGeometry[i]!),
    );
  }
  const totalCandidate = cumulative[cumulative.length - 1]!;

  /* Avoided corridor segments */
  const avoidedSegments: { a: Position; b: Position }[] = [];
  for (let i = 0; i < avoidedGeometry.length - 1; i++) {
    avoidedSegments.push({ a: avoidedGeometry[i]!, b: avoidedGeometry[i + 1]! });
  }

  for (const seg of avoidedSegments) {
    for (let j = 0; j < candidateGeometry.length - 1; j++) {
      const candidateStartDist = cumulative[j]!;
      const candidateEndDist = cumulative[j + 1]!;

      const inTerminalZone =
        candidateStartDist < terminalAllowance ||
        totalCandidate - candidateEndDist < terminalAllowance;

      if (inTerminalZone) continue;

      const dist = segmentToSegmentDistanceMeters(
        seg.a,
        seg.b,
        candidateGeometry[j]!,
        candidateGeometry[j + 1]!,
      );

      if (dist <= tolerance) {
        return false;
      }
    }
  }

  return true;
}

function segmentToSegmentDistanceMeters(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position,
): number {
  /* True crossing detection: if the segments intersect, distance is zero. */
  if (segmentsIntersect(a1, a2, b1, b2)) {
    return 0;
  }

  const d1 = pointToSegmentDistanceMeters(a1, b1, b2);
  const d2 = pointToSegmentDistanceMeters(a2, b1, b2);
  const d3 = pointToSegmentDistanceMeters(b1, a1, a2);
  const d4 = pointToSegmentDistanceMeters(b2, a1, a2);
  return Math.min(d1, d2, d3, d4);
}

function cross(o: Position, a: Position, b: Position): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function onSegment(a: Position, b: Position, p: Position): boolean {
  const epsilon = 1e-12;
  return (
    Math.min(a[0], b[0]) - epsilon <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) + epsilon &&
    Math.min(a[1], b[1]) - epsilon <= p[1] &&
    p[1] <= Math.max(a[1], b[1]) + epsilon
  );
}

export function segmentsIntersect(a1: Position, a2: Position, b1: Position, b2: Position): boolean {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  const epsilon = 1e-12;
  if (Math.abs(d1) < epsilon && onSegment(b1, b2, a1)) return true;
  if (Math.abs(d2) < epsilon && onSegment(b1, b2, a2)) return true;
  if (Math.abs(d3) < epsilon && onSegment(a1, a2, b1)) return true;
  if (Math.abs(d4) < epsilon && onSegment(a1, a2, b2)) return true;

  return false;
}
