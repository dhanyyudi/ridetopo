import { describe, it, expect } from "vitest";
import { analyzeElevation } from "../../src/domain/elevation";
import type { ElevationSample } from "../../src/domain/route";

function makeSamples(values: (number | null)[], startDist = 0, interval = 30): ElevationSample[] {
  return values.map((v, i) => ({
    distanceMeters: startDist + i * interval,
    elevationMeters: v,
  }));
}

describe("analyzeElevation", () => {
  it("returns incomplete for empty samples", () => {
    const result = analyzeElevation([], 0);
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
  });

  it("computes gain for uphill route", () => {
    const samples = makeSamples([10, 12, 15, 18, 20, 23, 25, 28, 30, 33]);
    const result = analyzeElevation(samples, 270);
    expect(result.complete).toBe(true);
    expect(result.gainMeters).toBeGreaterThan(10);
    expect(result.lossMeters).toBeLessThanOrEqual(3);
  });

  it("ignores noise runs below 3m", () => {
    const samples = makeSamples([10, 12, 11, 10.5, 10, 40, 41, 42, 43, 44, 45], 0, 30);
    const result = analyzeElevation(samples, 300);
    // Should detect significant gain from 10 to 45 area
    expect(result.gainMeters).toBeGreaterThan(25);
  });

  it("handles null gaps", () => {
    const values: (number | null)[] = [5, 6, null, null, 9, 10];
    const samples = makeSamples(values);
    const result = analyzeElevation(samples, 150);
    // Should interpolate the small gap
    expect(result.complete).toBe(true);
  });

  it("marks unknown for large gaps", () => {
    const values: (number | null)[] = [5, 6, null, null, null, null, 9, 10];
    const samples = makeSamples(values);
    const result = analyzeElevation(samples, 210);
    // 4-sample gap should not be interpolated
    expect(result.complete).toBe(false);
  });

  it("handles all missing elevation", () => {
    const samples = makeSamples([null, null, null, null]);
    const result = analyzeElevation(samples, 90);
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
  });

  it("handles NaN and -500", () => {
    // -500 is filtered as invalid by normalize-valhalla-response
    const samples: ElevationSample[] = [
      { distanceMeters: 0, elevationMeters: 5 },
      { distanceMeters: 30, elevationMeters: 6 },
      { distanceMeters: 60, elevationMeters: null },
    ];
    const result = analyzeElevation(samples, 60);
    expect(result.complete).toBe(false);
  });

  it("classifies climb sections", () => {
    const values: number[] = [];
    for (let i = 0; i < 50; i++) {
      values.push(10 + i * 2);
    }
    const samples = makeSamples(values, 0, 30);
    const result = analyzeElevation(samples, values.length * 30);
    const climbs = result.terrain.filter((t) => t.classification === "climb");
    expect(climbs.length).toBeGreaterThan(0);
  });

  it("classifies flat sections", () => {
    const values: number[] = [];
    for (let i = 0; i < 50; i++) {
      values.push(20 + (i % 3) * 0.1);
    }
    const samples = makeSamples(values, 0, 30);
    const result = analyzeElevation(samples, values.length * 30);
    const flats = result.terrain.filter((t) => t.classification === "flat");
    expect(flats.length).toBeGreaterThan(0);
  });
});
