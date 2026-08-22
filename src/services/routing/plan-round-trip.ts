import type { RoutePlanInput, RouteLeg, ElevationSample } from "@/domain/route";
import type { RoutingProvider, ProviderRouteRequest } from "@/providers/contracts";
import { ROUND_TRIP_CONFIG, ELEVATION_CONFIG, PRODUCT_LIMITS } from "@/domain/route";
import type { Position } from "@/domain/geo";
import { isAbortError } from "@/lib/abortable-request";
import {
  trimGeometryTerminals,
  scoreReturnCandidates,
} from "./calculate-overlap";

export interface RoundTripResult {
  returnLeg: RouteLeg;
  repeatedRoadRatio: number;
  limited: boolean;
}

export function computeTerminalTrimMeters(outboundDistance: number): number {
  return Math.min(
    ROUND_TRIP_CONFIG.terminalTrimMaximumMeters,
    Math.max(
      ROUND_TRIP_CONFIG.terminalTrimMinimumMeters,
      outboundDistance * ROUND_TRIP_CONFIG.terminalTrimRatio,
    ),
  );
}

function buildReturnRequest(
  input: RoutePlanInput,
  turnaround: Position,
  origin: Position,
): ProviderRouteRequest {
  return {
    locations: [turnaround, origin],
    profile: input.profile,
    roadPreference: input.roadPreference,
    terrainPreference: input.terrainPreference,
    exclusions: input.exclusions,
    elevationIntervalMeters: ELEVATION_CONFIG.intervalMeters as 30,
  };
}

export async function planRoundTrip(
  input: RoutePlanInput,
  outbound: RouteLeg,
  provider: RoutingProvider,
  signal: AbortSignal,
): Promise<RoundTripResult> {
  const positions = input.locations.map((loc) => loc.position);
  const origin = positions[0]!;
  const turnaround = positions[positions.length - 1]!;

  /* Pulang tercepat: plain B -> A */
  if (input.returnMode === "fastest") {
    const request = buildReturnRequest(input, turnaround, origin);
    const result = await provider.route(request, signal);
    const returnLeg = result[0];
    if (!returnLeg) {
      throw new Error("Tidak ditemukan rute pulang.");
    }
    const { sorted } = scoreReturnCandidates([returnLeg], outbound);
    return {
      returnLeg,
      repeatedRoadRatio: sorted[0]?.score.overlapRatio ?? 0,
      limited: false,
    };
  }

  /* Lewat jalan lain: forward, terminal-trimmed cost-factor shape.
     The shape must keep the outbound travel direction: the live Valhalla
     contract edge-walks the factor line along directed edges, so a reversed
     shape fails with error 233 (Failed to edge walk line feature) whenever
     the corridor contains a one-way edge. */
  const trimMeters = computeTerminalTrimMeters(outbound.distanceMeters);
  const trimmedShape = trimGeometryTerminals(outbound.geometry as Position[], trimMeters);

  const penaltyRequest = buildReturnRequest(input, turnaround, origin);
  if (trimmedShape.length >= 2) {
    penaltyRequest.alternateCount = ROUND_TRIP_CONFIG.alternateCount as 2;
    penaltyRequest.linearCostShape = trimmedShape;
    penaltyRequest.linearCostFactor = ROUND_TRIP_CONFIG.linearCostFactor;
  }

  let candidates: RouteLeg[] = [];
  let penaltyFailed = false;
  let receivedAlternateCount = 0;

  try {
    candidates = [...(await provider.routeCandidates(penaltyRequest, signal))];
    receivedAlternateCount = Math.max(0, candidates.length - 1);
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    penaltyFailed = true;
    /* One unpenalized fallback for a genuine contract/network failure */
    const fallbackRequest = buildReturnRequest(input, turnaround, origin);
    const fallback = await provider.route(fallbackRequest, signal);
    candidates = [...fallback];
  }

  if (candidates.length === 0) {
    throw new Error("Tidak ditemukan rute pulang.");
  }

  const { sorted } = scoreReturnCandidates(candidates, outbound);
  const withinCap = sorted.filter((s) => s.score.withinDetourCap);

  const chosen = withinCap.length > 0 ? withinCap[0]! : sorted[0]!;

  const limited =
    penaltyFailed ||
    (trimmedShape.length >= 2 && receivedAlternateCount < ROUND_TRIP_CONFIG.alternateCount) ||
    chosen.score.overlapRatio >= ROUND_TRIP_CONFIG.highOverlapWarningRatio;

  return {
    returnLeg: chosen.leg,
    repeatedRoadRatio: chosen.score.overlapRatio,
    limited,
  };
}

/** Merge outbound and return legs without duplicating the B join point. */
export function mergeLegGeometry(outbound: RouteLeg, returnLeg: RouteLeg): Position[] {
  const out = outbound.geometry;
  const ret = returnLeg.geometry;

  const outLast = out[out.length - 1];
  const retFirst = ret[0];

  if (
    outLast &&
    retFirst &&
    Math.abs(outLast[0] - retFirst[0]) < 1e-7 &&
    Math.abs(outLast[1] - retFirst[1]) < 1e-7
  ) {
    return [...out, ...ret.slice(1)];
  }
  return [...out, ...ret];
}

/** Merge elevation samples: return samples offset by outbound distance. */
export function mergeElevationSamples(
  outbound: RouteLeg,
  returnLeg: RouteLeg,
): ElevationSample[] {
  const out = outbound.elevation;
  const ret = returnLeg.elevation;

  if (out.length === 0 && ret.length === 0) return [];
  if (out.length === 0) return [...ret];

  const merged: ElevationSample[] = [...out];

  for (const sample of ret) {
    const combinedDistance = outbound.distanceMeters + sample.distanceMeters;
    const last = merged[merged.length - 1]!;
    if (combinedDistance - last.distanceMeters < 0.5) {
      /* deduplicate the B join */
      if (last.elevationMeters === null && sample.elevationMeters !== null) {
        merged[merged.length - 1] = { ...last, elevationMeters: sample.elevationMeters };
      }
      continue;
    }
    merged.push({
      distanceMeters: combinedDistance,
      elevationMeters: sample.elevationMeters,
    });
  }

  return merged;
}

export function checkCombinedRouteLimit(outbound: RouteLeg, returnLeg: RouteLeg): void {
  const combined = outbound.distanceMeters + returnLeg.distanceMeters;
  if (combined > PRODUCT_LIMITS.maxRouteMeters) {
    throw new Error("Maksimal total rute 500 km.");
  }
}
