import { describe, it, expect } from "vitest";
import {
  mergeRouteLegs,
  mergeGeometries,
  mergeElevationSampleSets,
} from "../../src/services/routing/merge-legs";
import { decodePolyline6 } from "../../src/lib/polyline6";
import type { RouteLeg } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

function leg(
  overrides: Partial<RouteLeg> & Pick<RouteLeg, "geometry" | "distanceMeters">,
): RouteLeg {
  return {
    id: "leg-0",
    durationSeconds: 100,
    elevation: [],
    encodedShape: "",
    ...overrides,
  };
}

const A: Position = [106.8, -6.2];
const B: Position = [106.85, -6.19];
const C: Position = [106.9, -6.18];

describe("mergeGeometries", () => {
  it("drops the shared join vertex", () => {
    expect(mergeGeometries([[A, B], [B, C]])).toEqual([A, B, C]);
  });

  it("keeps both endpoints when the legs do not touch", () => {
    expect(mergeGeometries([[A, B], [C, A]])).toEqual([A, B, C, A]);
  });

  it("ignores empty legs", () => {
    expect(mergeGeometries([[], [A, B], []])).toEqual([A, B]);
  });
});

describe("mergeElevationSampleSets", () => {
  it("offsets every leg onto one monotonic distance axis", () => {
    const merged = mergeElevationSampleSets([
      {
        distanceMeters: 60,
        elevation: [
          { distanceMeters: 0, elevationMeters: 10 },
          { distanceMeters: 30, elevationMeters: 12 },
          { distanceMeters: 60, elevationMeters: 14 },
        ],
      },
      {
        distanceMeters: 60,
        elevation: [
          { distanceMeters: 0, elevationMeters: 14 },
          { distanceMeters: 30, elevationMeters: 16 },
          { distanceMeters: 60, elevationMeters: 18 },
        ],
      },
    ]);

    expect(merged.map((s) => s.distanceMeters)).toEqual([0, 30, 60, 90, 120]);
    expect(merged.map((s) => s.elevationMeters)).toEqual([10, 12, 14, 16, 18]);
  });

  it("prefers a real reading over a gap at the join", () => {
    const merged = mergeElevationSampleSets([
      { distanceMeters: 30, elevation: [{ distanceMeters: 0, elevationMeters: 10 }, { distanceMeters: 30, elevationMeters: null }] },
      { distanceMeters: 30, elevation: [{ distanceMeters: 0, elevationMeters: 15 }, { distanceMeters: 30, elevationMeters: 18 }] },
    ]);

    expect(merged.map((s) => s.distanceMeters)).toEqual([0, 30, 60]);
    expect(merged[1]!.elevationMeters).toBe(15);
  });
});

describe("mergeRouteLegs", () => {
  it("returns the single leg unchanged", () => {
    const only = leg({ geometry: [A, B], distanceMeters: 1000, encodedShape: "abc" });
    expect(mergeRouteLegs([only])).toBe(only);
  });

  it("sums distance and duration across every leg", () => {
    const merged = mergeRouteLegs([
      leg({ geometry: [A, B], distanceMeters: 10_000, durationSeconds: 1200 }),
      leg({ geometry: [B, C], distanceMeters: 8_000, durationSeconds: 900 }),
    ]);

    expect(merged.distanceMeters).toBe(18_000);
    expect(merged.durationSeconds).toBe(2100);
    expect(merged.geometry).toEqual([A, B, C]);
  });

  it("re-encodes the combined shape so trace and export see the whole trip", () => {
    const merged = mergeRouteLegs([
      leg({ geometry: [A, B], distanceMeters: 10_000, encodedShape: "first" }),
      leg({ geometry: [B, C], distanceMeters: 8_000, encodedShape: "second" }),
    ]);

    const decoded = decodePolyline6(merged.encodedShape);
    expect(decoded).toHaveLength(3);
    expect(decoded[2]![0]).toBeCloseTo(C[0], 6);
    expect(decoded[2]![1]).toBeCloseTo(C[1], 6);
  });

  it("throws when there is nothing to merge", () => {
    expect(() => mergeRouteLegs([])).toThrow();
  });
});
