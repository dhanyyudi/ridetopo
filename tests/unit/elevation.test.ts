import { describe, it, expect } from "vitest";
import {
  analyzeElevation,
  interpolateGaps,
  medianFilter,
  computeAccumulatedGainLoss,
  computeWindowGrade,
  classifyTerrain,
  interpolateElevationAtDistance,
} from "../../src/domain/elevation";
import { mergeElevationSamples } from "../../src/services/routing/plan-round-trip";
import type { ElevationSample, RouteLeg } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

function makeSamples(values: (number | null)[], startDist = 0, interval = 30): ElevationSample[] {
  return values.map((v, i) => ({
    distanceMeters: startDist + i * interval,
    elevationMeters: v,
  }));
}

function makeLeg(elevation: ElevationSample[], distanceMeters: number): RouteLeg {
  return {
    id: "leg",
    geometry: [] as Position[],
    distanceMeters,
    durationSeconds: 0,
    elevation,
    encodedShape: "",
  };
}

describe("analyzeElevation validation", () => {
  it("returns incomplete for empty samples", () => {
    const result = analyzeElevation([], 0);
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
    expect(result.lossMeters).toBeNull();
  });

  it("treats unresolved values as gaps (provider converts -500/NaN/infinity to null)", () => {
    const samples = makeSamples([5, null, null, null, null, 9]);
    const result = analyzeElevation(samples, 150);
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
  });

  it("rejects an all-missing route", () => {
    const result = analyzeElevation(makeSamples([null, null, null, null]), 90);
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
  });

  it("keeps leading gaps unresolved", () => {
    const result = analyzeElevation(makeSamples([null, null, 5, 6, 7]), 120);
    expect(result.samples[0]!.elevationMeters).toBeNull();
    expect(result.samples[1]!.elevationMeters).toBeNull();
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
  });

  it("keeps trailing gaps unresolved", () => {
    const result = analyzeElevation(makeSamples([5, 6, 7, null, null]), 120);
    expect(result.samples[3]!.elevationMeters).toBeNull();
    expect(result.complete).toBe(false);
    expect(result.gainMeters).toBeNull();
  });
});

describe("interpolation", () => {
  it("interpolates an exactly three-sample internal gap", () => {
    const samples = makeSamples([5, null, null, null, 9]);
    const result = interpolateGaps(samples);
    expect(result[1]!.elevationMeters).toBeCloseTo(6, 6);
    expect(result[2]!.elevationMeters).toBeCloseTo(7, 6);
    expect(result[3]!.elevationMeters).toBeCloseTo(8, 6);
  });

  it("rejects a four-sample gap", () => {
    const samples = makeSamples([5, null, null, null, null, 9]);
    const result = interpolateGaps(samples);
    expect(result[1]!.elevationMeters).toBeNull();
    expect(result[4]!.elevationMeters).toBeNull();
  });

  it("rejects gaps wider than 90 m", () => {
    /* Four samples at 30m = 120m span over the gap */
    const samples = makeSamples([5, null, null, null, 9], 0, 40);
    const result = interpolateGaps(samples);
    expect(result[1]!.elevationMeters).toBeNull();
  });

  it("interpolates every sample in the gap", () => {
    const samples = makeSamples([0, null, null, 30]);
    const result = interpolateGaps(samples);
    expect(result[1]!.elevationMeters).toBeCloseTo(10, 6);
    expect(result[2]!.elevationMeters).toBeCloseTo(20, 6);
  });
});

describe("median filter and gain/loss", () => {
  it("removes a single-sample spike", () => {
    const samples = makeSamples([10, 10, 40, 10, 10, 10, 10]);
    const filtered = medianFilter(samples, 3);
    expect(filtered[2]!.elevationMeters).toBe(10);
  });

  it("ignores noise runs below 3 m", () => {
    const samples = makeSamples([10, 12, 10.5, 11, 10, 40, 41, 42, 43, 44, 45]);
    const { gain } = computeAccumulatedGainLoss(medianFilter(samples, 3));
    /* Only the big climb counts (~35 m) */
    expect(gain).toBeGreaterThan(30);
    expect(gain).toBeLessThan(36);
  });

  it("counts runs at or above 3 m", () => {
    const samples = makeSamples([10, 13, 16, 19, 22]);
    const { gain } = computeAccumulatedGainLoss(samples);
    expect(gain).toBeCloseTo(12, 6);
  });

  it("computes both ascent and descent", () => {
    const samples = makeSamples([10, 20, 30, 25, 15, 10]);
    const { gain, loss } = computeAccumulatedGainLoss(samples);
    expect(gain).toBeCloseTo(20, 6);
    expect(loss).toBeCloseTo(20, 6);
  });

  it("preserves floating-point totals without display rounding", () => {
    const samples = makeSamples([10.1, 13.9, 17.3, 20.8]);
    const { gain } = computeAccumulatedGainLoss(samples);
    expect(gain).not.toBe(Math.round(gain));
  });
});

describe("grade classification", () => {
  it("classifies >= +2% as climb", () => {
    const samples = makeSamples([10, 12.2, 14.4, 16.6, 18.8], 0, 30);
    const grade = computeWindowGrade(samples, 2);
    expect(grade).toBeGreaterThanOrEqual(0.02);
    const terrain = classifyTerrain(samples);
    expect(terrain.some((t) => t.classification === "climb")).toBe(true);
  });

  it("classifies <= -2% as descent", () => {
    const samples = makeSamples([20, 17.8, 15.6, 13.4, 11.2], 0, 30);
    const grade = computeWindowGrade(samples, 2);
    expect(grade).toBeLessThanOrEqual(-0.02);
    const terrain = classifyTerrain(samples);
    expect(terrain.some((t) => t.classification === "descent")).toBe(true);
  });

  it("classifies between thresholds as flat", () => {
    const samples = makeSamples([10, 10.2, 10.1, 10.3, 10.2], 0, 30);
    const terrain = classifyTerrain(samples);
    expect(terrain.some((t) => t.classification === "flat")).toBe(true);
  });

  it("returns null for unresolved windows", () => {
    const samples = makeSamples([10, null, null, null, null, 11], 0, 30);
    expect(computeWindowGrade(samples, 2)).toBeNull();
  });
});

describe("combined round-trip elevation", () => {
  it("offsets return samples by outbound distance and deduplicates the B join", () => {
    const outbound = makeLeg(makeSamples([10, 11, 12], 0, 30), 60);
    const returnLeg = makeLeg(makeSamples([12, 11, 10], 0, 30), 60);

    const merged = mergeElevationSamples(outbound, returnLeg);
    /* B join deduplicated: 3 + 3 - 1 = 5 */
    expect(merged).toHaveLength(5);
    expect(merged[0]!.distanceMeters).toBe(0);
    expect(merged[2]!.distanceMeters).toBe(60);
    expect(merged[3]!.distanceMeters).toBeCloseTo(90, 6);
    expect(merged[4]!.distanceMeters).toBeCloseTo(120, 6);
  });

  it("produces combined analyzed totals", () => {
    const outbound = makeLeg(makeSamples([10, 15, 20, 25, 30, 35, 40], 0, 30), 180);
    const returnLeg = makeLeg(makeSamples([40, 35, 30, 25, 20, 15, 10], 0, 30), 180);

    const merged = mergeElevationSamples(outbound, returnLeg);
    const analyzed = analyzeElevation(merged, 360);
    expect(analyzed.complete).toBe(true);
    expect(analyzed.gainMeters).toBeGreaterThanOrEqual(25);
    expect(analyzed.lossMeters).toBeGreaterThanOrEqual(25);
  });
});

describe("GPX elevation interpolation", () => {
  it("maps arbitrary route distances onto the elevation profile", () => {
    const samples = makeSamples([10, 20, 30], 0, 30);
    expect(interpolateElevationAtDistance(samples, 0)).toBe(10);
    expect(interpolateElevationAtDistance(samples, 15)).toBeCloseTo(15, 6);
    expect(interpolateElevationAtDistance(samples, 30)).toBe(20);
    expect(interpolateElevationAtDistance(samples, 45)).toBeCloseTo(25, 6);
    expect(interpolateElevationAtDistance(samples, 500)).toBe(30);
  });

  it("returns null when the nearest samples are unresolved", () => {
    const samples = makeSamples([10, null, null, 30], 0, 30);
    expect(interpolateElevationAtDistance(samples, 40)).toBeNull();
  });
});
