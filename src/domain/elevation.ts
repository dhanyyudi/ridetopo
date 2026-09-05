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
  routeDistanceMeters: number,
): AnalyzedElevation {
  if (samples.length === 0) {
    return { samples: [], gainMeters: null, lossMeters: null, complete: false, terrain: [] };
  }

  const interpolated = interpolateGaps(samples);
  const smoothed = medianFilter(interpolated, ELEVATION_CONFIG.medianWindowSamples);

  const hasNull = smoothed.some((s) => s.elevationMeters === null);
  const validCount = smoothed.filter((s) => s.elevationMeters !== null).length;

  /* A profile that stops well short of the route describes only part of it,
     so its totals are not route totals. */
  const complete = validCount >= 2 && !hasNull && coversRoute(smoothed, routeDistanceMeters);

  let gainMeters: number | null = null;
  let lossMeters: number | null = null;

  if (complete) {
    const { gain, loss } = computeAccumulatedGainLoss(smoothed);
    gainMeters = gain;
    lossMeters = loss;
  }

  const terrain = classifyTerrain(smoothed);

  return { samples: smoothed, gainMeters, lossMeters, complete, terrain };
}

/** Does the sample series reach the end of the route it describes? */
export function coversRoute(
  samples: readonly ElevationSample[],
  routeDistanceMeters: number,
): boolean {
  if (routeDistanceMeters <= 0) return true;
  const last = samples[samples.length - 1];
  if (!last) return false;
  const tolerance = Math.max(
    ELEVATION_CONFIG.intervalMeters * 2,
    routeDistanceMeters * 0.01,
  );
  return routeDistanceMeters - last.distanceMeters <= tolerance;
}

/**
 * Interpolate only internal gaps with valid values on both sides, at most
 * three samples/90 m. Leading, trailing, and long gaps stay null.
 */
export function interpolateGaps(samples: readonly ElevationSample[]): ElevationSample[] {
  if (samples.length === 0) return [];

  const result: ElevationSample[] = samples.map((s) => ({ ...s }));
  const maxGapSamples = ELEVATION_CONFIG.maximumInterpolatedGapSamples;
  const maxGapMeters = ELEVATION_CONFIG.maximumInterpolatedGapMeters;

  let i = 0;
  while (i < result.length) {
    if (result[i]!.elevationMeters !== null) {
      i++;
      continue;
    }

    /* Only internal gaps (valid value before) are eligible */
    const left = result[i - 1];
    if (!left || left.elevationMeters === null) {
      i++;
      continue;
    }

    let gapEnd = -1;
    for (let j = i; j < result.length; j++) {
      if (result[j]!.elevationMeters !== null) {
        gapEnd = j;
        break;
      }
    }
    if (gapEnd === -1) break;

    const gapSamples = gapEnd - i;
    /* Missing-data meters = span minus one sample interval */
    const stepSize =
      gapEnd + 1 < result.length
        ? result[gapEnd + 1]!.distanceMeters - result[gapEnd]!.distanceMeters
        : result[gapEnd]!.distanceMeters - result[gapEnd - 1]!.distanceMeters;
    const gapMeters = result[gapEnd]!.distanceMeters - left.distanceMeters - stepSize;

    if (gapSamples > maxGapSamples || gapMeters > maxGapMeters) {
      i = gapEnd;
      continue;
    }

    const startVal = left.elevationMeters;
    const endVal = result[gapEnd]!.elevationMeters!;
    const steps = gapSamples + 1;

    for (let k = i; k < gapEnd; k++) {
      const t = (k - i + 1) / steps;
      result[k] = {
        ...result[k]!,
        elevationMeters: startVal + (endVal - startVal) * t,
      };
    }

    i = gapEnd + 1;
  }

  return result;
}

/** Centered median filter applied only to runs of valid samples. */
export function medianFilter(
  samples: readonly ElevationSample[],
  windowSize: number,
): ElevationSample[] {
  if (windowSize < 3 || samples.length < windowSize) {
    return samples.map((s) => ({ ...s }));
  }

  const half = Math.floor(windowSize / 2);
  const result: ElevationSample[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;
    if (sample.elevationMeters === null || i < half || i >= samples.length - half) {
      result.push({ ...sample });
      continue;
    }

    const window: number[] = [];
    for (let w = i - half; w <= i + half; w++) {
      const val = samples[w]!.elevationMeters;
      if (val !== null) window.push(val);
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

/**
 * Accumulate gain/loss from monotonic runs; ignore runs whose amplitude is
 * below the noise threshold. Preserves floating-point precision.
 */
export function computeAccumulatedGainLoss(
  samples: readonly ElevationSample[],
): { gain: number; loss: number } {
  const noise = ELEVATION_CONFIG.noiseRunMeters;
  let gain = 0;
  let loss = 0;

  let runStart = -1;

  const flushRun = (endIdx: number) => {
    if (runStart < 0) return;
    const startVal = samples[runStart]!.elevationMeters;
    const endVal = samples[endIdx]!.elevationMeters;
    if (startVal === null || endVal === null) return;

    const amplitude = Math.abs(endVal - startVal);
    if (amplitude < noise) return;

    if (endVal > startVal) gain += amplitude;
    else loss += amplitude;
  };

  for (let i = 1; i < samples.length; i++) {
    const curr = samples[i]!.elevationMeters;
    const prev = samples[i - 1]!.elevationMeters;
    if (curr === null || prev === null) {
      flushRun(i - 1);
      runStart = -1;
      continue;
    }

    if (runStart === -1) {
      runStart = i - 1;
      continue;
    }

    const runStartVal = samples[runStart]!.elevationMeters!;
    const stillUp = runStartVal <= prev && prev <= curr;
    const stillDown = runStartVal >= prev && prev >= curr;

    if (!stillUp && !stillDown) {
      flushRun(i - 1);
      runStart = i - 1;
    }
  }

  flushRun(samples.length - 1);

  return { gain, loss };
}

/** Grade over a ~90 m distance window. Returns null for unresolved windows. */
export function computeWindowGrade(
  samples: readonly ElevationSample[],
  index: number,
  windowMeters: number = ELEVATION_CONFIG.gradeWindowMeters,
): number | null {
  const centerDist = samples[index]!.distanceMeters;

  let startIdx = index;
  while (startIdx > 0 && centerDist - samples[startIdx - 1]!.distanceMeters <= windowMeters / 2) {
    startIdx--;
  }

  let endIdx = index;
  while (
    endIdx < samples.length - 1 &&
    samples[endIdx + 1]!.distanceMeters - centerDist <= windowMeters / 2
  ) {
    endIdx++;
  }

  /* Extend the window until both ends have valid elevation */
  let windowStart = startIdx;
  let windowEnd = endIdx;

  while (windowStart < index && samples[windowStart]!.elevationMeters === null) windowStart++;
  while (windowEnd > index && samples[windowEnd]!.elevationMeters === null) windowEnd--;

  if (windowStart >= windowEnd) return null;

  const startElev = samples[windowStart]!.elevationMeters;
  const endElev = samples[windowEnd]!.elevationMeters;
  if (startElev === null || endElev === null) return null;

  const distance = samples[windowEnd]!.distanceMeters - samples[windowStart]!.distanceMeters;
  if (distance < 1) return null;

  return (endElev - startElev) / distance;
}

export function classifyTerrain(samples: readonly ElevationSample[]): TerrainSection[] {
  if (samples.length < 2) return [];

  const climbThreshold = ELEVATION_CONFIG.climbThreshold;
  const descentThreshold = ELEVATION_CONFIG.descentThreshold;
  const sections: TerrainSection[] = [];

  let currentStart = samples[0]!.distanceMeters;
  let currentGrade: number | null = null;
  let currentClass: TerrainClass | null = null;

  const classify = (grade: number | null): TerrainClass | null => {
    if (grade === null) return null;
    if (grade >= climbThreshold) return "climb";
    if (grade <= descentThreshold) return "descent";
    return "flat";
  };

  for (let i = 0; i < samples.length; i++) {
    const grade = computeWindowGrade(samples, i);
    const classification = classify(grade);

    const classChanged = classification !== currentClass;
    const gradeChanged =
      grade !== null && currentGrade !== null && Math.abs(grade - currentGrade) > 0.01;

    if (classChanged || gradeChanged) {
      if (currentClass !== null && samples[i]!.distanceMeters > currentStart) {
        sections.push({
          startDistanceMeters: currentStart,
          endDistanceMeters: samples[i]!.distanceMeters,
          grade: currentGrade,
          classification: currentClass,
        });
      }
      currentStart = samples[i]!.distanceMeters;
      currentGrade = grade;
      currentClass = classification;
    }
  }

  if (currentClass !== null && samples[samples.length - 1]!.distanceMeters > currentStart) {
    sections.push({
      startDistanceMeters: currentStart,
      endDistanceMeters: samples[samples.length - 1]!.distanceMeters,
      grade: currentGrade,
      classification: currentClass,
    });
  }

  return mergeAdjacentSections(sections);
}

function mergeAdjacentSections(sections: TerrainSection[]): TerrainSection[] {
  if (sections.length <= 1) return sections;

  const merged: TerrainSection[] = [];
  for (const section of sections) {
    const last = merged[merged.length - 1];
    if (last && last.classification === section.classification) {
      merged[merged.length - 1] = {
        ...last,
        endDistanceMeters: section.endDistanceMeters,
      };
    } else {
      merged.push(section);
    }
  }
  return merged;
}

/**
 * Distance-based interpolation of elevation for an arbitrary route distance.
 * Used by GPX export to pair elevation with geometry points.
 */
export function interpolateElevationAtDistance(
  samples: readonly ElevationSample[],
  distanceMeters: number,
): number | null {
  if (samples.length === 0) return null;

  let left: ElevationSample | null = null;
  let right: ElevationSample | null = null;

  for (const sample of samples) {
    if (sample.distanceMeters <= distanceMeters) {
      left = sample;
    } else {
      right = sample;
      break;
    }
  }

  if (!left) {
    return samples[0]!.elevationMeters;
  }
  if (!right) {
    return left.elevationMeters;
  }
  if (left.elevationMeters === null || right.elevationMeters === null) {
    return null;
  }

  const span = right.distanceMeters - left.distanceMeters;
  if (span <= 0) return left.elevationMeters;

  const t = (distanceMeters - left.distanceMeters) / span;
  return left.elevationMeters + (right.elevationMeters - left.elevationMeters) * t;
}
