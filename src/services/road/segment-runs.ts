import type { RoadSegment } from "@/domain/route";
import { getRoadDisplayName, getRoadDescriptor } from "@/domain/road";
import type { SegmentRange } from "./segment-ranges";

export interface SegmentRun {
  /** The first segment's id — stable enough to key a list row. */
  id: string;
  segments: RoadSegment[];
  name: string;
  descriptor: string;
  startMeters: number;
  endMeters: number;
  startShapeIndex: number;
  endShapeIndex: number;
}

/**
 * Collapse a run of consecutive ruas that are all the same road.
 *
 * Valhalla returns one entry per graph edge, so a single street arrives as
 * dozens of rows that say the same thing — a 12 km ride produced 205 of them,
 * eight of which were "Jalan Bisma Raya" one after another. On a phone that
 * turns "avoid this street" into a very long scroll past repeats of the row
 * you already found.
 *
 * Rows that read identically are therefore one row. Avoiding it avoids every
 * edge underneath, which is what someone pointing at a street name means.
 */
export function buildSegmentRuns(
  segments: readonly RoadSegment[],
  rangeById: ReadonlyMap<string, SegmentRange>,
): SegmentRun[] {
  const runs: SegmentRun[] = [];

  for (const segment of segments) {
    const range = rangeById.get(segment.id);
    const name = getRoadDisplayName(segment);
    const descriptor = getRoadDescriptor(segment);
    const previous = runs[runs.length - 1];

    if (previous && previous.name === name && previous.descriptor === descriptor) {
      previous.segments.push(segment);
      previous.endMeters = range?.endMeters ?? previous.endMeters;
      previous.endShapeIndex = Math.max(
        previous.endShapeIndex,
        range?.endShapeIndex ?? segment.endShapeIndex,
      );
      continue;
    }

    runs.push({
      id: segment.id,
      segments: [segment],
      name,
      descriptor,
      startMeters: range?.startMeters ?? 0,
      endMeters: range?.endMeters ?? 0,
      startShapeIndex: range?.beginShapeIndex ?? segment.beginShapeIndex,
      endShapeIndex: range?.endShapeIndex ?? segment.endShapeIndex,
    });
  }

  return runs;
}

/** The run holding a given segment id, or null. */
export function findRunBySegmentId(
  runs: readonly SegmentRun[],
  segmentId: string,
): SegmentRun | null {
  return runs.find((run) => run.segments.some((s) => s.id === segmentId)) ?? null;
}
