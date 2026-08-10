import type { RoutePlanInput, RouteLeg } from "@/domain/route";
import type { RoutingProvider, ProviderRouteRequest } from "@/providers/contracts";
import { ROUND_TRIP_CONFIG, ELEVATION_CONFIG, PRODUCT_LIMITS } from "@/domain/route";
import { scoreReturnCandidate } from "./calculate-overlap";
import type { Position } from "@/domain/geo";
import { reverseGeometry } from "@/lib/polyline6";

export async function planRoundTrip(
  input: RoutePlanInput,
  outbound: RouteLeg,
  provider: RoutingProvider,
  signal: AbortSignal,
): Promise<{ returnLeg: RouteLeg; repeatedRoadRatio: number; limited: boolean }> {
  const positions = input.locations.map((loc) => loc.position);
  const origin = positions[0]!;
  const turnaround = positions[positions.length - 1]!;

  if (input.returnMode === "fastest") {
    const request: ProviderRouteRequest = {
      locations: [turnaround, origin],
      profile: input.profile,
      roadPreference: input.roadPreference,
      terrainPreference: input.terrainPreference,
      exclusions: input.exclusions,
      elevationIntervalMeters: ELEVATION_CONFIG.intervalMeters as 30,
    };

    const result = await provider.route(request, signal);
    const returnLeg = result[0]!;
    const overlap = import("./calculate-overlap").then(m =>
      m.calculateOverlapRatio(returnLeg.geometry, outbound.geometry)
    );

    return {
      returnLeg,
      repeatedRoadRatio: await overlap,
      limited: false,
    };
  }

  const reversed = reverseGeometry(outbound.geometry);

  const trimDistance = Math.min(
    ROUND_TRIP_CONFIG.terminalTrimMaximumMeters,
    Math.max(
      ROUND_TRIP_CONFIG.terminalTrimMinimumMeters,
      outbound.distanceMeters * ROUND_TRIP_CONFIG.terminalTrimRatio,
    ),
  );

  let startTrimIndex = 0;
  let accumulated = 0;
  for (let i = 1; i < reversed.length; i++) {
    const dx = (reversed[i]![0] - reversed[i - 1]![0]) * 111_320 * Math.cos((reversed[i]![1] * Math.PI) / 180);
    const dy = (reversed[i]![1] - reversed[i - 1]![1]) * 111_320;
    accumulated += Math.sqrt(dx * dx + dy * dy);
    if (accumulated >= trimDistance) {
      startTrimIndex = i;
      break;
    }
  }

  let endTrimIndex = reversed.length - 1;
  accumulated = 0;
  for (let i = reversed.length - 1; i > 0; i--) {
    const dx = (reversed[i]![0] - reversed[i - 1]![0]) * 111_320 * Math.cos((reversed[i]![1] * Math.PI) / 180);
    const dy = (reversed[i]![1] - reversed[i - 1]![1]) * 111_320;
    accumulated += Math.sqrt(dx * dx + dy * dy);
    if (accumulated >= trimDistance) {
      endTrimIndex = i;
      break;
    }
  }

  const trimmedShape: Position[] = reversed.slice(
    Math.max(0, startTrimIndex),
    Math.min(reversed.length - 1, endTrimIndex + 1),
  );

  const penaltyRequest: Record<string, unknown> = {
    locations: [turnaround, origin],
    profile: input.profile,
    roadPreference: input.roadPreference,
    terrainPreference: input.terrainPreference,
    exclusions: input.exclusions,
    elevationIntervalMeters: ELEVATION_CONFIG.intervalMeters as 30,
    alternateCount: ROUND_TRIP_CONFIG.alternateCount as 2,
    linearCostFactor: ROUND_TRIP_CONFIG.linearCostFactor,
  };

  if (trimmedShape.length >= 2) {
    penaltyRequest.linearCostShape = trimmedShape;
  }

  let candidates: RouteLeg[] = [];
  let penaltyFailed = false;

  try {
    const result = await provider.route(penaltyRequest as unknown as ProviderRouteRequest, signal);
    candidates = [...result];
  } catch {
    penaltyFailed = true;
    try {
      const fallbackRequest: ProviderRouteRequest = {
        locations: [turnaround, origin],
        profile: input.profile,
        roadPreference: input.roadPreference,
        terrainPreference: input.terrainPreference,
        exclusions: input.exclusions,
        elevationIntervalMeters: ELEVATION_CONFIG.intervalMeters as 30,
      };
      const fallback = await provider.route(fallbackRequest, signal);
      candidates = [...fallback];
    } catch {
      throw new Error("Gagal merencanakan rute pulang.");
    }
  }

  if (candidates.length === 0) {
    throw new Error("Tidak ditemukan rute pulang.");
  }

  const scored = candidates
    .filter((c) => c.distanceMeters > 0)
    .map((candidate) => ({
      candidate,
      ...scoreReturnCandidate(candidate, outbound.geometry, outbound.distanceMeters),
    }));

  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-6) return a.score - b.score;
    return a.candidate.distanceMeters - b.candidate.distanceMeters;
  });

  const best = scored[0]!;

  const validCandidates = scored.filter((s) => s.withinDetourCap);
  const selected = validCandidates.length > 0 ? validCandidates[0]! : best;

  const limited = penaltyFailed || selected.overlapRatio >= ROUND_TRIP_CONFIG.highOverlapWarningRatio;

  if (selected.candidate.distanceMeters + outbound.distanceMeters > PRODUCT_LIMITS.maxRouteMeters) {
    throw new Error("Maksimal total rute 500 km.");
  }

  return {
    returnLeg: selected.candidate,
    repeatedRoadRatio: selected.overlapRatio,
    limited,
  };
}
