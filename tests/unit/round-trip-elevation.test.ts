import { describe, it, expect } from "vitest";
import { getRouteElevation } from "../../src/services/routing/route-elevation";
import { formatSpeed, formatClockTime } from "../../src/content/id";
import type { PlannedRoute, RouteLeg } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

function leg(distanceMeters: number, base: number): RouteLeg {
  const count = Math.floor(distanceMeters / 30) + 1;
  return {
    id: `leg-${base}`,
    geometry: [
      [106.8, -6.2],
      [106.9, -6.2],
    ] as Position[],
    distanceMeters,
    durationSeconds: distanceMeters / 5,
    elevation: Array.from({ length: count }, (_, i) => ({
      distanceMeters: i * 30,
      elevationMeters: base + Math.sin(i / 20) * 40,
    })),
    encodedShape: "x",
  };
}

function roundTrip(outboundMeters: number, returnMeters: number): PlannedRoute {
  const outbound = leg(outboundMeters, 10);
  const returnLeg = leg(returnMeters, 50);
  return {
    id: "rt",
    input: {
      locations: [],
      profile: "road-bike",
      roadPreference: "standard",
      terrainPreference: "standard",
      exclusions: [],
      returnToStart: true,
      returnMode: "different-road",
    },
    outbound,
    returnLeg,
    geometry: [...outbound.geometry, ...returnLeg.geometry],
    metrics: {
      distanceMeters: outboundMeters + returnMeters,
      durationSeconds: outbound.durationSeconds + returnLeg.durationSeconds,
      elevationGainMeters: null,
      elevationLossMeters: null,
    },
    repeatedRoadRatio: 0.2,
    limitedReturnAlternatives: true,
    createdAt: new Date().toISOString(),
  };
}

describe("round-trip elevation covers the whole ride", () => {
  it("spans the combined distance, not one leg", () => {
    const route = roundTrip(44_500, 44_500);
    const { samples, complete } = getRouteElevation(route);
    const last = samples[samples.length - 1]!;

    /* The chart scales its axis from the final sample. Half the ride here
       would put the axis at ~44,5 km for an 89 km round trip. */
    expect(last.distanceMeters).toBeGreaterThan(88_000);
    expect(complete).toBe(true);
  });

  it("keeps the distance axis strictly increasing across the join", () => {
    const { samples } = getRouteElevation(roundTrip(30_000, 26_000));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.distanceMeters).toBeGreaterThan(samples[i - 1]!.distanceMeters);
    }
  });
});

describe("pace and arrival", () => {
  it("derives average speed from distance and duration", () => {
    expect(formatSpeed(20_000, 3600)).toBe("20,0 km/jam");
    expect(formatSpeed(46_400, 7_380)).toBe("22,6 km/jam");
  });

  it("refuses to invent a speed without a duration", () => {
    expect(formatSpeed(10_000, 0)).toBeNull();
    expect(formatSpeed(10_000, Number.NaN)).toBeNull();
  });

  it("formats a clock time in Indonesian", () => {
    const at = new Date(2026, 8, 5, 7, 5);
    expect(formatClockTime(at)).toMatch(/07[.:]05/);
  });
});
