import { describe, it, expect } from "vitest";
import {
  cumulativeDistances,
  resampleByDistance,
  distanceAlongRoute,
} from "../../src/services/routing/calculate-overlap";
import { createElevationInterpolator } from "../../src/domain/elevation";
import type { Position } from "../../src/domain/geo";
import type { ElevationSample } from "../../src/domain/route";

/** A straight east-west line with roughly `spacing` metres between vertices. */
function line(vertexCount: number, spacingDegrees = 0.0003): Position[] {
  return Array.from(
    { length: vertexCount },
    (_, i) => [106.8 + i * spacingDegrees, -6.2] as Position,
  );
}

describe("resampleByDistance", () => {
  it("samples at the requested interval and always ends on the last vertex", () => {
    const geometry = line(50);
    const total = cumulativeDistances(geometry).at(-1)!;
    const samples = resampleByDistance(geometry, 30);

    expect(samples.length).toBeGreaterThan(Math.floor(total / 30));
    expect(samples[0]).toEqual(geometry[0]);
    expect(samples.at(-1)).toEqual(geometry.at(-1));
  });

  it("stays on the line it resamples", () => {
    const geometry = line(30);
    for (const sample of resampleByDistance(geometry, 25)) {
      expect(sample[1]).toBeCloseTo(-6.2, 9);
    }
  });

  it("handles a geometry shorter than one interval", () => {
    const geometry = line(2);
    expect(resampleByDistance(geometry, 10_000)).toHaveLength(2);
  });

  it("resamples a long route without a quadratic scan", () => {
    const geometry = line(50_000);
    const started = Date.now();
    const samples = resampleByDistance(geometry, 30);
    const elapsed = Date.now() - started;

    expect(samples.length).toBeGreaterThan(1_000);
    /* Generous, but a per-sample rescan of 50k vertices cannot fit in it. */
    expect(elapsed).toBeLessThan(5_000);
  });
});

describe("distanceAlongRoute", () => {
  const geometry = line(11);
  const total = cumulativeDistances(geometry).at(-1)!;

  it("returns 0 at the start and the full length at the end", () => {
    expect(distanceAlongRoute(geometry, geometry[0]!)).toBeCloseTo(0, 3);
    expect(distanceAlongRoute(geometry, geometry.at(-1)!)).toBeCloseTo(total, 3);
  });

  it("projects a point beside the route onto the nearest position", () => {
    const midpoint = geometry[5]!;
    const beside: Position = [midpoint[0], midpoint[1] + 0.0001];
    expect(distanceAlongRoute(geometry, beside)).toBeCloseTo(
      cumulativeDistances(geometry)[5]!,
      1,
    );
  });

  it("interpolates inside a segment", () => {
    const cumulative = cumulativeDistances(geometry);
    const between: Position = [
      (geometry[2]![0] + geometry[3]![0]) / 2,
      -6.2,
    ];
    const expected = (cumulative[2]! + cumulative[3]!) / 2;
    expect(distanceAlongRoute(geometry, between)).toBeCloseTo(expected, 1);
  });

  it("is safe on degenerate geometry", () => {
    expect(distanceAlongRoute([], [106.8, -6.2])).toBe(0);
    expect(distanceAlongRoute([[106.8, -6.2]], [106.9, -6.2])).toBe(0);
  });
});

describe("createElevationInterpolator", () => {
  const samples: ElevationSample[] = [
    { distanceMeters: 0, elevationMeters: 10 },
    { distanceMeters: 30, elevationMeters: 20 },
    { distanceMeters: 60, elevationMeters: 30 },
  ];

  it("interpolates between samples as the cursor advances", () => {
    const at = createElevationInterpolator(samples);
    expect(at(0)).toBe(10);
    expect(at(15)).toBe(15);
    expect(at(30)).toBe(20);
    expect(at(45)).toBe(25);
    expect(at(60)).toBe(30);
  });

  it("clamps past the last sample and before the first", () => {
    const at = createElevationInterpolator(samples);
    expect(at(1_000)).toBe(30);
    expect(createElevationInterpolator(samples)(-5)).toBe(10);
  });

  it("returns null across a gap rather than inventing a value", () => {
    const gapped: ElevationSample[] = [
      { distanceMeters: 0, elevationMeters: 10 },
      { distanceMeters: 30, elevationMeters: null },
      { distanceMeters: 60, elevationMeters: 30 },
    ];
    const at = createElevationInterpolator(gapped);
    expect(at(15)).toBeNull();
    expect(at(45)).toBeNull();
  });

  it("recovers when distances are requested out of order", () => {
    const at = createElevationInterpolator(samples);
    expect(at(60)).toBe(30);
    expect(at(15)).toBe(15);
  });

  it("returns null with no samples at all", () => {
    expect(createElevationInterpolator([])(10)).toBeNull();
  });
});
