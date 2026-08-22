import { describe, it, expect } from "vitest";
import { buildGpx, generateGpxFilename } from "../../src/services/export/build-gpx";
import type { PlannedRoute, RouteLeg, ElevationSample } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

function makeLeg(geometry: Position[], elevation: ElevationSample[], distanceMeters: number): RouteLeg {
  return {
    id: "leg",
    geometry,
    distanceMeters,
    durationSeconds: 3600,
    elevation,
    encodedShape: "x",
  };
}

function makeRoute(overrides: Partial<PlannedRoute> = {}): PlannedRoute {
  return {
    id: "test-1",
    input: {
      locations: [
        { id: "a", role: "origin", position: [106.8, -6.2] as Position, label: "Jakarta <Pusat>", source: "search" },
        { id: "b", role: "destination", position: [106.9, -6.3] as Position, label: "Depok & Sekitar", source: "search" },
      ],
      profile: "road-bike",
      roadPreference: "standard",
      terrainPreference: "standard",
      exclusions: [],
      returnToStart: false,
      returnMode: "different-road",
    },
    outbound: makeLeg(
      [
        [106.8, -6.2] as Position,
        [106.82, -6.21] as Position,
        [106.9, -6.3] as Position,
      ],
      [
        { distanceMeters: 0, elevationMeters: 10 },
        { distanceMeters: 300, elevationMeters: 20 },
        { distanceMeters: 600, elevationMeters: 30 },
      ],
      600,
    ),
    returnLeg: null,
    geometry: [
      [106.8, -6.2] as Position,
      [106.82, -6.21] as Position,
      [106.9, -6.3] as Position,
    ],
    metrics: {
      distanceMeters: 600,
      durationSeconds: 3600,
      elevationGainMeters: null,
      elevationLossMeters: null,
    },
    repeatedRoadRatio: null,
    limitedReturnAlternatives: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildGpx", () => {
  it("serializes the full unsimplified geometry", () => {
    const gpx = buildGpx(makeRoute());
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    /* 3 geometry points -> 3 trkpt */
    expect(gpx.match(/<trkpt/g)).toHaveLength(3);
    expect(gpx.match(/<wpt/g)).toHaveLength(2);
  });

  it("maps elevation by cumulative distance, not array index", () => {
    const gpx = buildGpx(makeRoute());
    /* Distance from [106.8,-6.2] to [106.82,-6.21] is ~2.5 km; the profile
       only covers 600 m so the last points map to the final valid sample. */
    const eleValues = [...gpx.matchAll(/<ele>([\d.]+)<\/ele>/g)].map((m) => Number(m[1]));
    expect(eleValues.length).toBeGreaterThanOrEqual(2);
    /* The first point maps to the first sample (10 m) */
    expect(eleValues[0]).toBe(10);
  });

  it("omits ele when no valid mapped value exists", () => {
    const route = makeRoute({
      outbound: makeLeg(
        [[106.8, -6.2] as Position, [106.82, -6.21] as Position],
        [
          { distanceMeters: 0, elevationMeters: null },
          { distanceMeters: 300, elevationMeters: null },
        ],
        300,
      ),
      geometry: [[106.8, -6.2] as Position, [106.82, -6.21] as Position],
      metrics: { distanceMeters: 300, durationSeconds: 600, elevationGainMeters: null, elevationLossMeters: null },
    });
    const gpx = buildGpx(route);
    expect(gpx).not.toContain("<ele>");
  });

  it("escapes XML special characters in names and labels", () => {
    const gpx = buildGpx(makeRoute());
    expect(gpx).not.toContain("Jakarta <Pusat>");
    expect(gpx).toContain("Jakarta &lt;Pusat&gt;");
    expect(gpx).not.toContain("Depok & Sekitar");
    expect(gpx).toContain("Depok &amp; Sekitar");
  });

  it("names round-trip origin Mulai/Selesai without duplicating the waypoint", () => {
    const route = makeRoute({
      input: {
        ...makeRoute().input,
        returnToStart: true,
      },
      returnLeg: makeLeg(
        [[106.9, -6.3] as Position, [106.8, -6.2] as Position],
        [],
        600,
      ),
      geometry: [
        [106.8, -6.2] as Position,
        [106.9, -6.3] as Position,
        [106.8, -6.2] as Position,
      ],
    });
    const gpx = buildGpx(route);
    expect(gpx).toContain("Mulai/Selesai");
    /* A and B only: no duplicated waypoint entry */
    expect(gpx.match(/<wpt/g)).toHaveLength(2);
  });

  it("maps return-leg elevation onto the combined distance axis", () => {
    /* Round trip A->B->A over a 600 m + 600 m geometry. The return leg's
       samples are 0-based relative to the return leg; without the merge
       offset every point past the midpoint would read the wrong sample. */
    const returnGeometry: Position[] = [
      [106.82, -6.21] as Position,
      [106.8, -6.2] as Position,
    ];
    const route = makeRoute({
      input: { ...makeRoute().input, returnToStart: true },
      returnLeg: makeLeg(
        returnGeometry,
        [
          { distanceMeters: 0, elevationMeters: 50 },
          { distanceMeters: 600, elevationMeters: 80 },
        ],
        600,
      ),
      geometry: [
        [106.8, -6.2] as Position,
        [106.82, -6.21] as Position,
        [106.8, -6.2] as Position,
      ],
      metrics: { distanceMeters: 1200, durationSeconds: 7200, elevationGainMeters: null, elevationLossMeters: null },
    });
    const gpx = buildGpx(route);
    const eleValues = [...gpx.matchAll(/<ele>([\d.]+)<\/ele>/g)].map((m) => Number(m[1]));
    /* Last trkpt sits at the end of the combined path (~combined length),
       so it must map to the return leg's final sample (80 m), not to the
       outbound profile which ends at 600 m / 30 m elevation. */
    expect(eleValues[eleValues.length - 1]).toBe(80);
  });

  it("generates safe lowercase slug filenames", () => {
    const filename = generateGpxFilename(makeRoute());
    expect(filename).toMatch(/^ridetopo-jakarta-pusat-depok-sekitar-\d{4}-\d{2}-\d{2}\.gpx$/);
  });
});
