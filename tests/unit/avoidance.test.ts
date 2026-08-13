import { describe, it, expect } from "vitest";
import {
  buildExclusionLocations,
  buildMultiEdgeExclusions,
  type RoadSelection,
} from "../../src/services/avoidance/build-exclusions";
import { validateAvoidance } from "../../src/services/avoidance/validate-avoidance";
import type { Position } from "../../src/domain/geo";

describe("buildExclusionLocations", () => {
  const geometry: Position[] = [
    [106.8, -6.2],
    [106.81, -6.2],
    [106.82, -6.2],
    [106.83, -6.2],
    [106.84, -6.2],
  ];

  it("returns the midpoint of the selection", () => {
    const sel: RoadSelection = { startShapeIndex: 1, endShapeIndex: 3, segmentIds: ["a"] };
    const result = buildExclusionLocations(sel, geometry, [], 50);
    expect(result).toHaveLength(1);
    expect(result[0]![0]).toBeCloseTo(106.82, 4);
  });

  it("appends to existing exclusions", () => {
    const existing: Position[] = [[106.9, -6.3]];
    const sel: RoadSelection = { startShapeIndex: 1, endShapeIndex: 1, segmentIds: ["a"] };
    const result = buildExclusionLocations(sel, geometry, existing, 50);
    expect(result).toHaveLength(2);
  });

  it("caps deterministically at the maximum", () => {
    const existing: Position[] = Array.from({ length: 50 }, (_, i) => [106 + i * 0.001, -6] as Position);
    const sel: RoadSelection = { startShapeIndex: 0, endShapeIndex: 4, segmentIds: ["a"] };
    const result = buildExclusionLocations(sel, geometry, existing, 50);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("deduplicates identical exclusions", () => {
    const existing: Position[] = [[106.81, -6.2]];
    const sel: RoadSelection = { startShapeIndex: 1, endShapeIndex: 1, segmentIds: ["a"] };
    const result = buildExclusionLocations(sel, geometry, existing, 50);
    expect(result).toHaveLength(1);
  });
});

describe("buildMultiEdgeExclusions", () => {
  const geometry: Position[] = [];
  for (let i = 0; i <= 30; i++) {
    geometry.push([106.8 + i * 0.001, -6.2] as Position);
  }

  it("creates one midpoint per selected edge", () => {
    const edges = [
      { beginShapeIndex: 0, endShapeIndex: 9 },
      { beginShapeIndex: 10, endShapeIndex: 19 },
      { beginShapeIndex: 20, endShapeIndex: 29 },
    ];
    const result = buildMultiEdgeExclusions(edges, geometry, [], 50);
    expect(result).toHaveLength(3);
  });

  it("deduplicates overlapping edges deterministically", () => {
    const edges = [
      { beginShapeIndex: 5, endShapeIndex: 6 },
      { beginShapeIndex: 5, endShapeIndex: 6 },
      { beginShapeIndex: 12, endShapeIndex: 13 },
    ];
    const result = buildMultiEdgeExclusions(edges, geometry, [], 50);
    expect(result).toHaveLength(2);
  });

  it("downsamples deterministically beyond the budget", () => {
    const edges = Array.from({ length: 60 }, (_, i) => ({
      beginShapeIndex: i,
      endShapeIndex: i + 1,
    }));
    const geometry60: Position[] = Array.from({ length: 62 }, (_, i) => [106 + i * 0.0001, -6] as Position);
    const first = buildMultiEdgeExclusions(edges, geometry60, [], 50);
    const second = buildMultiEdgeExclusions(edges, geometry60, [], 50);
    expect(first.length).toBeLessThanOrEqual(50);
    expect(first).toEqual(second);
  });
});

describe("validateAvoidance", () => {
  it("returns true for clearly separated routes", () => {
    const avoided: Position[] = [[106.8, -6.2], [106.81, -6.2]];
    const candidate: Position[] = [[106.9, -6.3], [106.91, -6.3]];
    expect(validateAvoidance(avoided, candidate)).toBe(true);
  });

  it("detects vertex-adjacent overlap beyond terminal zones", () => {
    const avoided: Position[] = [[106.8, -6.2], [106.81, -6.2]];
    /* Four points so the middle segment sits beyond both terminal zones */
    const candidate: Position[] = [
      [106.78, -6.2],
      [106.80001, -6.20001],
      [106.81, -6.2],
      [106.85, -6.2],
    ];
    expect(
      validateAvoidance(avoided, candidate, { toleranceMeters: 20, terminalAllowanceMeters: 30 }),
    ).toBe(false);
  });

  it("detects a crossing between sparse vertices", () => {
    /* Candidate crosses the avoided corridor perpendicularly mid-route */
    const avoided: Position[] = [[106.8, -6.2], [106.9, -6.2]];
    const candidate: Position[] = [
      [106.76, -6.19],
      [106.85, -6.19],
      [106.85, -6.21],
      [106.94, -6.21],
    ];
    expect(
      validateAvoidance(avoided, candidate, { toleranceMeters: 20, terminalAllowanceMeters: 40 }),
    ).toBe(false);
  });

  it("allows terminal contact at the candidate start", () => {
    const avoided: Position[] = [[106.9, -6.3], [106.95, -6.3]];
    const candidate: Position[] = [
      [106.9, -6.3],
      [106.92, -6.3],
      [106.93, -6.28],
    ];
    expect(
      validateAvoidance(avoided, candidate, { toleranceMeters: 20, terminalAllowanceMeters: 60 }),
    ).toBe(true);
  });

  it("returns true for empty inputs", () => {
    expect(validateAvoidance([], [[106.8, -6.2]])).toBe(true);
    expect(validateAvoidance([[106.8, -6.2]], [])).toBe(true);
  });
});
