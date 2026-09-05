import { describe, it, expect } from "vitest";
import {
  buildSegmentRanges,
  findSegmentAtDistance,
  segmentsWithinBounds,
  advanceCorridor,
  corridorRange,
} from "../../src/services/road/segment-ranges";
import { buildTerrainFeatures } from "../../src/features/map/map-layers";
import type { RoadSegment } from "../../src/domain/route";
import type { TerrainSection } from "../../src/domain/elevation";
import type { Position } from "../../src/domain/geo";

function segment(id: string, begin: number, end: number): RoadSegment {
  return {
    id,
    beginShapeIndex: begin,
    endShapeIndex: end,
    name: id,
    roadClass: "primary",
    surface: "asphalt",
    unpaved: false,
    use: "road",
    wayId: null,
  };
}

/* Vertices are deliberately unevenly spaced: 0, 100, 150, 1000, 1100 m. */
const CUMULATIVE = [0, 100, 150, 1000, 1100];

describe("buildSegmentRanges", () => {
  it("reads km bounds from the cumulative profile, not from index ratios", () => {
    const ranges = buildSegmentRanges([segment("a", 0, 2), segment("b", 2, 4)], CUMULATIVE);

    expect(ranges[0]).toMatchObject({ startMeters: 0, endMeters: 150 });
    expect(ranges[1]).toMatchObject({ startMeters: 150, endMeters: 1100 });
    /* A proportional guess would have put the first boundary at 550 m. */
    expect(ranges[0]!.endMeters).not.toBe(550);
  });

  it("clamps indices that fall outside the geometry", () => {
    const ranges = buildSegmentRanges([segment("a", -5, 99)], CUMULATIVE);
    expect(ranges[0]).toMatchObject({ startMeters: 0, endMeters: 1100 });
  });

  it("keeps the range ordered when the trace reports it backwards", () => {
    const ranges = buildSegmentRanges([segment("a", 3, 1)], CUMULATIVE);
    expect(ranges[0]!.startMeters).toBeLessThanOrEqual(ranges[0]!.endMeters);
  });

  it("returns nothing without a distance profile", () => {
    expect(buildSegmentRanges([segment("a", 0, 1)], [])).toEqual([]);
  });
});

describe("findSegmentAtDistance", () => {
  const ranges = buildSegmentRanges([segment("a", 0, 2), segment("b", 2, 4)], CUMULATIVE);

  it("finds the ruas covering the distance", () => {
    expect(findSegmentAtDistance(ranges, 50)?.id).toBe("a");
    expect(findSegmentAtDistance(ranges, 900)?.id).toBe("b");
  });

  it("falls back to the nearest ruas past the end", () => {
    expect(findSegmentAtDistance(ranges, 99_999)?.id).toBe("b");
  });

  it("is null with no ranges", () => {
    expect(findSegmentAtDistance([], 10)).toBeNull();
  });
});

describe("segmentsWithinBounds", () => {
  const segments = [segment("a", 0, 10), segment("b", 10, 20), segment("c", 20, 30)];

  it("selects by midpoint, in either bound order", () => {
    expect(segmentsWithinBounds(segments, 0, 20).map((s) => s.id)).toEqual(["a", "b"]);
    expect(segmentsWithinBounds(segments, 20, 0).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("corridor picking", () => {
  const first = segment("a", 4, 12);
  const second = segment("b", 12, 24);

  it("takes the start, then the end, then starts over", () => {
    const empty = { startShapeIndex: null, endShapeIndex: null };
    const started = advanceCorridor(empty, first);
    expect(started).toEqual({ startShapeIndex: 4, endShapeIndex: null });

    const closed = advanceCorridor(started, second);
    expect(closed).toEqual({ startShapeIndex: 4, endShapeIndex: 24 });

    /* A third tap re-picks the start so a mistake is correctable. */
    expect(advanceCorridor(closed, second)).toEqual({
      startShapeIndex: 12,
      endShapeIndex: null,
    });
  });

  it("orders the range and stays null until both ends exist", () => {
    expect(corridorRange({ startShapeIndex: 4, endShapeIndex: null })).toBeNull();
    expect(corridorRange({ startShapeIndex: 30, endShapeIndex: 10 })).toEqual({
      start: 10,
      end: 30,
    });
  });
});

describe("buildTerrainFeatures", () => {
  const geometry: Position[] = Array.from(
    { length: 11 },
    (_, i) => [106.8 + i * 0.001, -6.2] as Position,
  );

  function section(
    start: number,
    end: number,
    classification: TerrainSection["classification"],
  ): TerrainSection {
    return {
      startDistanceMeters: start,
      endDistanceMeters: end,
      grade: 0.03,
      classification,
    };
  }

  it("emits one feature per classified section, carrying the class", () => {
    const total = 0.01 * 111_320; /* roughly 1113 m of east-west line */
    const features = buildTerrainFeatures(geometry, [
      section(0, total / 2, "climb"),
      section(total / 2, total, "descent"),
    ]).features;

    expect(features).toHaveLength(2);
    expect(features[0]!.properties.terrain).toBe("climb");
    expect(features[1]!.properties.terrain).toBe("descent");
  });

  it("leaves no gap between neighbouring sections", () => {
    const total = 0.01 * 111_320;
    const features = buildTerrainFeatures(geometry, [
      section(0, total / 2, "climb"),
      section(total / 2, total, "descent"),
    ]).features;

    const firstEnd = features[0]!.geometry.coordinates.at(-1);
    const secondStart = features[1]!.geometry.coordinates[0];
    expect(firstEnd).toEqual(secondStart);
  });

  it("covers the route to its last vertex", () => {
    const total = 0.01 * 111_320;
    const features = buildTerrainFeatures(geometry, [section(0, total, "flat")]).features;
    expect(features.at(-1)!.geometry.coordinates.at(-1)).toEqual([
      geometry.at(-1)![0],
      geometry.at(-1)![1],
    ]);
  });

  it("falls back to one neutral line when nothing is classified", () => {
    const features = buildTerrainFeatures(geometry, [section(0, 100, null)]).features;
    expect(features).toHaveLength(1);
    expect(features[0]!.properties.terrain).toBe("unknown");
  });

  it("never paints an unmeasured tail as the section before it", () => {
    const total = 0.01 * 111_320;
    /* The profile ran out at the halfway point: the rest was never classified
       and must not inherit the climb. */
    const features = buildTerrainFeatures(geometry, [
      section(0, total / 2, "climb"),
    ]).features;

    expect(features.map((f) => f.properties.terrain)).toEqual(["climb", "unknown"]);
    expect(features.at(-1)!.geometry.coordinates.at(-1)).toEqual([
      geometry.at(-1)![0],
      geometry.at(-1)![1],
    ]);
  });

  it("marks an unmeasured head as unknown too", () => {
    const total = 0.01 * 111_320;
    const features = buildTerrainFeatures(geometry, [
      section(total / 2, total, "descent"),
    ]).features;

    expect(features.map((f) => f.properties.terrain)).toEqual(["unknown", "descent"]);
    expect(features[0]!.geometry.coordinates[0]).toEqual([geometry[0]![0], geometry[0]![1]]);
  });

  it("still leaves no gap between the spans it draws", () => {
    const total = 0.01 * 111_320;
    const features = buildTerrainFeatures(geometry, [
      section(0, total / 3, "climb"),
      section((total * 2) / 3, total, "descent"),
    ]).features;

    for (let i = 1; i < features.length; i++) {
      expect(features[i]!.geometry.coordinates[0]).toEqual(
        features[i - 1]!.geometry.coordinates.at(-1),
      );
    }
  });

  it("emits nothing for a degenerate route", () => {
    expect(buildTerrainFeatures([[106.8, -6.2]], []).features).toEqual([]);
  });
});
