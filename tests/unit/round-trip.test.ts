import { describe, it, expect } from "vitest";
import { planRoundTrip } from "../../src/services/routing/plan-round-trip";
import { planRoute } from "../../src/services/routing/plan-route";
import { calculateOverlapRatio, trimGeometryTerminals } from "../../src/services/routing/calculate-overlap";
import type { RoutingProvider, ProviderRouteRequest } from "../../src/providers/contracts";
import type { RouteLeg, RoutePlanInput } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

function makeGeometry(fromLng: number, toLng: number, latOffset = 0): Position[] {
  const points: Position[] = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    points.push([fromLng + ((toLng - fromLng) * i) / steps, -6.2 + latOffset]);
  }
  return points;
}

function makeLeg(overrides: Partial<RouteLeg> = {}): RouteLeg {
  return {
    id: "leg-1",
    geometry: makeGeometry(106.8, 106.9),
    distanceMeters: 15000,
    durationSeconds: 2700,
    elevation: [],
    encodedShape: "abc",
    ...overrides,
  };
}

function makeInput(overrides: Partial<RoutePlanInput> = {}): RoutePlanInput {
  return {
    locations: [
      { id: "a", role: "origin", position: [106.8, -6.2] as Position, label: "A", source: "search" },
      { id: "b", role: "destination", position: [106.9, -6.2] as Position, label: "B", source: "search" },
    ],
    profile: "road-bike",
    roadPreference: "standard",
    terrainPreference: "standard",
    exclusions: [],
    returnToStart: true,
    returnMode: "different-road",
    ...overrides,
  };
}

describe("planRoundTrip orchestration", () => {
  it("requests B->A with forward terminal-trimmed shape and alternates", async () => {
    const outbound = makeLeg({ distanceMeters: 15000 });

    let captured: ProviderRouteRequest | null = null;
    const provider: RoutingProvider = {
      async route() {
        return [makeLeg({ geometry: makeGeometry(106.9, 106.8, 0.01), distanceMeters: 16000 })];
      },
      async routeCandidates(request) {
        captured = request;
        return [
          makeLeg({ geometry: makeGeometry(106.9, 106.8, 0.01), distanceMeters: 16000 }),
          makeLeg({ geometry: makeGeometry(106.9, 106.8, 0.02), distanceMeters: 17000 }),
          makeLeg({ geometry: makeGeometry(106.9, 106.8, 0.03), distanceMeters: 18000 }),
        ];
      },
      async traceAttributes() {
        return [];
      },
    };

    const result = await planRoundTrip(makeInput(), outbound, provider, new AbortController().signal);

    expect(captured).not.toBeNull();
    expect(captured!.locations.map((p) => p[0])).toEqual([106.9, 106.8]);
    expect(captured!.alternateCount).toBe(2);
    expect(captured!.linearCostFactor).toBe(5);
    expect(captured!.linearCostShape).toBeDefined();
    expect(captured!.linearCostShape!.length).toBeGreaterThanOrEqual(2);

    /* Forward: first point of penalty shape is near A (Valhalla edge-walks
       the factor line along directed edges; a reversed shape fails the live
       contract with error 233 on one-way corridors) */
    const shape = captured!.linearCostShape!;
    expect(shape[0]![0]).toBeLessThan(shape[shape.length - 1]![0]);

    /* Terminal-trimmed: shape shorter than the full outbound */
    expect(shape.length).toBeLessThan(outbound.geometry.length);

    /* Best scoring (shortest within cap) candidate selected */
    expect(result.returnLeg.distanceMeters).toBe(16000);
    expect(result.limited).toBe(false);
  });

  it("does not start a fallback on AbortError", async () => {
    const outbound = makeLeg();
    let secondCallMade = false;

    const provider: RoutingProvider = {
      async route() {
        secondCallMade = true;
        return [makeLeg()];
      },
      async routeCandidates() {
        throw new DOMException("aborted", "AbortError");
      },
      async traceAttributes() {
        return [];
      },
    };

    await expect(
      planRoundTrip(makeInput(), outbound, provider, new AbortController().signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(secondCallMade).toBe(false);
  });

  it("makes exactly one unpenalized fallback on a genuine penalty failure", async () => {
    const outbound = makeLeg();
    const calls: ProviderRouteRequest[] = [];

    const provider: RoutingProvider = {
      async route(request) {
        calls.push(request);
        return [makeLeg({ geometry: makeGeometry(106.9, 106.8, 0.005), distanceMeters: 15500 })];
      },
      async routeCandidates(request) {
        calls.push(request);
        throw new Error("500 internal");
      },
      async traceAttributes() {
        return [];
      },
    };

    const result = await planRoundTrip(makeInput(), outbound, provider, new AbortController().signal);

    expect(calls).toHaveLength(2);
    /* Fallback request must not carry a repeat penalty */
    expect(calls[1]!.linearCostFactor).toBeUndefined();
    expect(calls[1]!.linearCostShape).toBeUndefined();
    expect(calls[1]!.alternateCount).toBeUndefined();
    expect(result.limited).toBe(true);
  });

  it("flags limited return when overlap is at least the warning ratio", async () => {
    const outbound = makeLeg({ distanceMeters: 15000 });

    const provider: RoutingProvider = {
      async route() {
        return [makeLeg()];
      },
      async routeCandidates() {
        /* Return leg nearly identical to outbound */
        return [makeLeg({ geometry: makeGeometry(106.8, 106.9), distanceMeters: 15100 })];
      },
      async traceAttributes() {
        return [];
      },
    };

    const result = await planRoundTrip(makeInput(), outbound, provider, new AbortController().signal);
    expect(result.repeatedRoadRatio).toBeGreaterThanOrEqual(0.6);
    expect(result.limited).toBe(true);
  });

  it("fastest mode sends no penalty and no alternates", async () => {
    const outbound = makeLeg();
    let captured: ProviderRouteRequest | null = null;

    const provider: RoutingProvider = {
      async route(request) {
        captured = request;
        return [makeLeg({ distanceMeters: 14000 })];
      },
      async routeCandidates(request) {
        captured = request;
        return [makeLeg({ distanceMeters: 14000 })];
      },
      async traceAttributes() {
        return [];
      },
    };

    const result = await planRoundTrip(
      makeInput({ returnMode: "fastest" }),
      outbound,
      provider,
      new AbortController().signal,
    );

    expect(captured!.linearCostFactor).toBeUndefined();
    expect(captured!.alternateCount).toBeUndefined();
    expect(result.limited).toBe(false);
  });
});

describe("planRoute round-trip integration", () => {
  it("merges legs, applies the combined 500 km gate, and computes metrics", async () => {
    const outbound = makeLeg({ distanceMeters: 480000, durationSeconds: 36000 });
    const returnLeg = makeLeg({ distanceMeters: 25000, durationSeconds: 4000 });

    const provider: RoutingProvider = {
      async route() {
        return [outbound];
      },
      async routeCandidates() {
        return [returnLeg];
      },
      async traceAttributes() {
        return [];
      },
    };

    await expect(
      planRoute(makeInput(), provider, new AbortController().signal),
    ).rejects.toThrow("Maksimal total rute 500 km.");
  });

  it("produces a combined round-trip route with distinct legs", async () => {
    const outbound = makeLeg({ distanceMeters: 15000, durationSeconds: 2700 });
    const returnLeg = makeLeg({
      id: "leg-return",
      geometry: makeGeometry(106.9, 106.8, 0.01),
      distanceMeters: 16000,
      durationSeconds: 2900,
    });

    const provider: RoutingProvider = {
      async route() {
        return [outbound];
      },
      async routeCandidates() {
        return [returnLeg];
      },
      async traceAttributes() {
        return [];
      },
    };

    const route = await planRoute(makeInput(), provider, new AbortController().signal);
    expect(route.returnLeg).not.toBeNull();
    expect(route.outbound.id).not.toBe(route.returnLeg!.id);
    expect(route.metrics.distanceMeters).toBe(31000);
    expect(route.metrics.durationSeconds).toBe(5600);
    expect(route.geometry.length).toBeGreaterThan(route.outbound.geometry.length);
  });
});

describe("calculateOverlapRatio", () => {
  it("is direction-insensitive for the same corridor", () => {
    const geometry = makeGeometry(106.8, 106.9);
    const reversed = [...geometry].reverse() as Position[];
    expect(calculateOverlapRatio(reversed, geometry)).toBeGreaterThanOrEqual(0.9);
  });

  it("is near zero for a far-apart corridor", () => {
    const a = makeGeometry(106.8, 106.9);
    const b = makeGeometry(107.0, 107.1);
    expect(calculateOverlapRatio(b, a)).toBeLessThan(0.05);
  });

  it("excludes terminal zones from the comparison", () => {
    const a = makeGeometry(106.8, 106.9);
    /* Same corridor in the middle, diverging terminals */
    const b: Position[] = [
      ...a.slice(0, 5).map((p) => [p[0], p[1] + 0.01] as Position),
      ...a.slice(5, 45),
      ...a.slice(45).map((p) => [p[0], p[1] - 0.01] as Position),
    ];
    const ratio = calculateOverlapRatio(b, a);
    expect(ratio).toBeGreaterThan(0.6);
  });

  it("trims geometry terminals by traveled distance", () => {
    const geometry = makeGeometry(106.8, 106.9);
    const trimmed = trimGeometryTerminals(geometry, 1000);
    expect(trimmed.length).toBeLessThan(geometry.length);
    /* First trimmed point is at least ~1km away from the original start */
    expect(Math.abs(trimmed[0]![0] - geometry[0]![0])).toBeGreaterThan(0.005);
  });
});
