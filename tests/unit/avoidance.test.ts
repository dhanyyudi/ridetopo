import { describe, it, expect } from "vitest";
import { buildExclusionLocations, type RoadSelection } from "../../src/services/avoidance/build-exclusions";
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

  it("returns midpoint of selection", () => {
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

  it("caps at maximum", () => {
    const existing: Position[] = Array.from({ length: 50 }, (_, i) => [i * 0.01, i * 0.01] as Position);
    const sel: RoadSelection = { startShapeIndex: 1, endShapeIndex: 1, segmentIds: ["a"] };
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

describe("validateAvoidance", () => {
  it("returns true for clearly separated routes", () => {
    const avoided: Position[] = [[106.8, -6.2]];
    const candidate: Position[] = [[106.9, -6.3]];
    expect(validateAvoidance(avoided, candidate)).toBe(true);
  });

  it("returns false for overlapping routes", () => {
    const avoided: Position[] = [[106.81, -6.2], [106.82, -6.2]];
    const candidate: Position[] = [[106.81001, -6.20001], [106.812, -6.201]];
    expect(validateAvoidance(avoided, candidate)).toBe(false);
  });

  it("returns true for empty inputs", () => {
    expect(validateAvoidance([], [[106.8, -6.2]])).toBe(true);
    expect(validateAvoidance([[106.8, -6.2]], [])).toBe(true);
  });
});
