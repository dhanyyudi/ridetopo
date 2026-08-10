import type { ElevationSample } from "./route";
import { ELEVATION_CONFIG } from "./route";

export type TerrainClass = "climb" | "flat" | "descent";

export interface TerrainSection {
  startDistanceMeters: number;
  endDistanceMeters: number;
  grade: number | null;
  classification: TerrainClass | null;
}

export interface AnalyzedElevation {
  samples: readonly ElevationSample[];
  gainMeters: number | null;
  lossMeters: number | null;
  complete: boolean;
  terrain: readonly TerrainSection[];
}

export function analyzeElevation(
  samples: readonly ElevationSample[],
  _routeDistanceMeters: number,
): AnalyzedElevation {
  if (samples.length === 0) {
    return { samples, gainMeters: null, lossMeters: null, complete: false, terrain: [] };
  }

  const cleaned = interpolateGaps(samples);
  const smoothed = medianFilter(cleaned, ELEVATION_CONFIG.medianWindowSamples);

  const validCount = smoothed.filter((s) => s.elevationMeters !== null).length;
  const anyNull = smoothed.some((s) => s.elevationMeters === null);
  const complete = !anyNull && validCount > 0;

  let gainMeters: number | null = null;
  let lossMeters: number | null = null;

  if (validCount > 1) {
    const { gain, loss } = computeAccumulatedGainLoss(smoothed);
    gainMeters = gain;
    lossMeters = loss;
  }

  const terrain = classifyTerrain(smoothed);

  return { samples: smoothed, gainMeters, lossMeters, complete, terrain };
}

function interpolateGaps(samples: readonly ElevationSample[]): ElevationSample[] {
  const result: ElevationSample[] = [];
  const maxGapSamples = ELEVATION_CONFIG.maximumInterpolatedGapSamples;
  const maxGapMeters = ELEVATION_CONFIG.maximumInterpolatedGapMeters;

  for (let i = 0; i < samples.length; i++) {
    result.push(samples[i]!);

    if (
      samples[i]!.elevationMeters === null &&
      i > 0 &&
      samples[i - 1]!.elevationMeters !== null
    ) {
      let gapEnd = -1;
      let gapCount = 0;
      let gapDistance = 0;

      for (let j = i; j < samples.length; j++) {
        if (samples[j]!.elevationMeters !== null) {
          gapEnd = j;
          break;
        }
        gapCount++;
        if (j > 0) {
          gapDistance += samples[j]!.distanceMeters - samples[j - 1]!.distanceMeters;
        }
      }

      if (gapEnd > 0 && gapCount <= maxGapSamples && gapDistance <= maxGapMeters) {
        const startVal = samples[i - 1]!.elevationMeters!;
        const endVal = samples[gapEnd]!.elevationMeters!;
        const steps = gapEnd - i + 1;

        for (let k = i; k < gapEnd; k++) {
          const t = (k - i + 1) / steps;
          result[result.length - 1] = {
            ...result[result.length - 1]!,
            elevationMeters: startVal + (endVal - startVal) * t,
          };
        }
        i = gapEnd - 1;
      }
    }
  }

  return result;
}

function medianFilter(samples: readonly ElevationSample[], windowSize: number): ElevationSample[] {
  if (windowSize < 3 || samples.length < windowSize) return [...samples];

  const half = Math.floor(windowSize / 2);
  const result: ElevationSample[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;

    if (sample.elevationMeters === null) {
      result.push({ ...sample });
      continue;
    }

    if (i < half || i >= samples.length - half) {
      result.push({ ...sample });
      continue;
    }

    const window: number[] = [];
    for (let w = i - half; w <= i + half; w++) {
      const val = samples[w]!.elevationMeters;
      if (val !== null) {
        window.push(val);
      }
    }

    if (window.length >= 3) {
      window.sort((a, b) => a - b);
      const median = window[Math.floor(window.length / 2)]!;
      result.push({ ...sample, elevationMeters: median });
    } else {
      result.push({ ...sample });
    }
  }

  return result;
}

function computeAccumulatedGainLoss(samples: readonly ElevationSample[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let runStart = -1;

  for (let i = 1; i < samples.length; i++) {
    const curr = samples[i]!.elevationMeters;
    const prev = samples[i - 1]!.elevationMeters;

    if (curr === null || prev === null) continue;

    const diff = curr - prev;

    if (runStart === -1) {
      runStart = i - 1;
    }

    const stillSameDirection =
      (diff >= 0 && samples[runStart]!.elevationMeters! <= samples[i]!.elevationMeters!) ||
      (diff < 0 && samples[runStart]!.elevationMeters! >= samples[i]!.elevationMeters!);

    if (!stillSameDirection) {
      const runDelta = Math.abs(
        samples[i - 1]!.elevationMeters! - samples[runStart]!.elevationMeters!,
      );
      if (runDelta >= ELEVATION_CONFIG.noiseRunMeters) {
        if (samples[i - 1]!.elevationMeters! > samples[runStart]!.elevationMeters!) {
          gain += runDelta;
        } else {
          loss += runDelta;
        }
      }
      runStart = i - 1;
    }
  }

  if (runStart >= 0 && runStart < samples.length - 1) {
    const runDelta = Math.abs(
      samples[samples.length - 1]!.elevationMeters! - samples[runStart]!.elevationMeters!,
    );
    if (runDelta >= ELEVATION_CONFIG.noiseRunMeters) {
      if (samples[samples.length - 1]!.elevationMeters! > samples[runStart]!.elevationMeters!) {
        gain += runDelta;
      } else {
        loss += runDelta;
      }
    }
  }

  return { gain: Math.round(gain), loss: Math.round(loss) };
}

function classifyTerrain(samples: readonly ElevationSample[]): TerrainSection[] {
  if (samples.length < 2) return [];

  const windowMeters = ELEVATION_CONFIG.gradeWindowMeters;
  const climbThreshold = ELEVATION_CONFIG.climbThreshold;
  const descentThreshold = ELEVATION_CONFIG.descentThreshold;
  const sections: TerrainSection[] = [];

  let currentStart = samples[0]!.distanceMeters;
  let currentClass: TerrainClass | null = null;

  for (let i = 0; i < samples.length; i++) {
    const grade = computeWindowGrade(samples, i, windowMeters);
    let classification: TerrainClass | null = null;

    if (grade !== null) {
      if (grade >= climbThreshold) classification = "climb";
      else if (grade <= descentThreshold) classification = "descent";
      else classification = "flat";
    }

    if (classification !== currentClass) {
      if (currentClass !== null && currentStart < samples[i]!.distanceMeters) {
        sections.push({
          startDistanceMeters: currentStart,
          endDistanceMeters: samples[i]!.distanceMeters,
          grade: computeWindowGrade(
            samples,
            samples.findIndex((s) => s.distanceMeters >= currentStart),
            windowMeters,
          ),
          classification: currentClass,
        });
      }
      currentStart = samples[i]!.distanceMeters;
      currentClass = classification;
    }
  }

  if (currentClass !== null) {
    sections.push({
      startDistanceMeters: currentStart,
      endDistanceMeters: samples[samples.length - 1]!.distanceMeters,
      grade: computeWindowGrade(
        samples,
        samples.findIndex((s) => s.distanceMeters >= currentStart),
        windowMeters,
      ),
      classification: currentClass,
    });
  }

  return mergeSmallSections(sections);
}

function computeWindowGrade(
  samples: readonly ElevationSample[],
  index: number,
  windowMeters: number,
): number | null {
  const centerDist = samples[index]!.distanceMeters;
  let startIdx = index;
  let endIdx = index;

  while (startIdx > 0 && centerDist - samples[startIdx - 1]!.distanceMeters < windowMeters / 2) {
    startIdx--;
  }
  while (endIdx < samples.length - 1 && samples[endIdx + 1]!.distanceMeters - centerDist < windowMeters / 2) {
    endIdx++;
  }

  if (endIdx - startIdx < 1) return null;

  const startElev = samples[startIdx]!.elevationMeters;
  const endElev = samples[endIdx]!.elevationMeters;

  if (startElev === null || endElev === null) return null;

  const distance = samples[endIdx]!.distanceMeters - samples[startIdx]!.distanceMeters;
  if (distance < 1) return null;

  return (endElev - startElev) / distance;
}

function mergeSmallSections(sections: TerrainSection[]): TerrainSection[] {
  if (sections.length <= 1) return sections;

  const merged: TerrainSection[] = [sections[0]!];

  for (let i = 1; i < sections.length; i++) {
    const last = merged[merged.length - 1]!;
    const curr = sections[i]!;
    const segLen = curr.endDistanceMeters - curr.startDistanceMeters;

    if (segLen < 50 && merged.length > 1) {
      merged[merged.length - 1] = {
        ...last,
        endDistanceMeters: curr.endDistanceMeters,
      };
    } else {
      merged.push(curr);
    }
  }

  return merged;
}
