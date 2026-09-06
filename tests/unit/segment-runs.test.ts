import { describe, it, expect } from "vitest";
import { buildSegmentRuns, findRunBySegmentId } from "@/services/road/segment-runs";
import { buildSegmentRanges } from "@/services/road/segment-ranges";
import type { RoadSegment } from "@/domain/route";

function segment(
  id: string,
  begin: number,
  end: number,
  name: string | null,
  roadClass = "residential",
  surface: string | null = "asphalt",
): RoadSegment {
  return {
    id,
    beginShapeIndex: begin,
    endShapeIndex: end,
    name,
    roadClass,
    surface,
    unpaved: false,
    use: "road",
    wayId: null,
  };
}

const CUMULATIVE = [0, 100, 250, 400, 900, 1500, 2000];

function runsFor(segments: readonly RoadSegment[]) {
  const ranges = buildSegmentRanges(segments, CUMULATIVE);
  return buildSegmentRuns(segments, new Map(ranges.map((r) => [r.id, r])));
}

describe("buildSegmentRuns", () => {
  it("collapses consecutive edges of the same road into one row", () => {
    const runs = runsFor([
      segment("a", 0, 1, "Jalan Bisma Raya"),
      segment("b", 1, 2, "Jalan Bisma Raya"),
      segment("c", 2, 3, "Jalan Bisma Raya"),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]!.segments.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("spans the run from the first edge's start to the last edge's end", () => {
    const runs = runsFor([
      segment("a", 0, 1, "Jalan Bisma Raya"),
      segment("b", 1, 3, "Jalan Bisma Raya"),
    ]);

    expect(runs[0]).toMatchObject({
      startMeters: 0,
      endMeters: 400,
      startShapeIndex: 0,
      endShapeIndex: 3,
    });
  });

  it("keeps roads apart when the name differs", () => {
    const runs = runsFor([
      segment("a", 0, 1, "Jalan Bisma Raya"),
      segment("b", 1, 2, "Jalan Nusantara"),
    ]);

    expect(runs.map((r) => r.name)).toEqual(["Jalan Bisma Raya", "Jalan Nusantara"]);
  });

  it("keeps them apart when only the surface differs", () => {
    /* Same street, but one stretch is unpaved — that is exactly the thing
       someone is reviewing the route to find, so it must stay its own row. */
    const runs = runsFor([
      segment("a", 0, 1, "Jalan Kajen", "residential", "asphalt"),
      segment("b", 1, 2, "Jalan Kajen", "residential", "gravel"),
    ]);

    expect(runs).toHaveLength(2);
  });

  it("does not merge the same road when something else comes between", () => {
    const runs = runsFor([
      segment("a", 0, 1, "Jalan Bisma Raya"),
      segment("b", 1, 2, "Jalan Nusantara"),
      segment("c", 2, 3, "Jalan Bisma Raya"),
    ]);

    /* Merging these would claim one stretch of road where there are two,
       and avoiding it would exclude a street the rider never named. */
    expect(runs).toHaveLength(3);
  });

  it("groups unnamed stretches that sit next to each other", () => {
    const runs = runsFor([segment("a", 0, 1, null), segment("b", 1, 2, null)]);

    expect(runs).toHaveLength(1);
    expect(runs[0]!.segments).toHaveLength(2);
  });

  it("returns nothing for no segments", () => {
    expect(runsFor([])).toEqual([]);
  });
});

describe("findRunBySegmentId", () => {
  it("finds the run holding an edge that is not the first", () => {
    const runs = runsFor([
      segment("a", 0, 1, "Jalan Bisma Raya"),
      segment("b", 1, 2, "Jalan Bisma Raya"),
    ]);

    expect(findRunBySegmentId(runs, "b")?.id).toBe("a");
  });

  it("returns null for an id it does not hold", () => {
    expect(findRunBySegmentId(runsFor([segment("a", 0, 1, "X")]), "zzz")).toBeNull();
  });
});
