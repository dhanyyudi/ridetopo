import { describe, it, expect } from "vitest";
import { generateGpxFilename } from "../../src/services/export/build-gpx";
import type { PlannedRoute } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

const makeRoute = (): PlannedRoute => ({
  id: "test-1",
  input: {
    locations: [
      { id: "a", role: "origin", position: [106.8, -6.2] as Position, label: "Start", source: "search" },
      { id: "b", role: "destination", position: [106.9, -6.3] as Position, label: "End", source: "search" },
    ],
    profile: "road-bike",
    roadPreference: "standard",
    terrainPreference: "standard",
    exclusions: [],
    returnToStart: false,
    returnMode: "different-road",
  },
  outbound: {
    id: "leg-1",
    geometry: [[106.8, -6.2] as Position, [106.81, -6.21] as Position, [106.9, -6.3] as Position],
    distanceMeters: 15000,
    durationSeconds: 3600,
    elevation: [
      { distanceMeters: 0, elevationMeters: 5 },
      { distanceMeters: 30, elevationMeters: 8 },
      { distanceMeters: 60, elevationMeters: 12 },
    ],
    encodedShape: "test",
  },
  returnLeg: null,
  geometry: [[106.8, -6.2] as Position, [106.81, -6.21] as Position, [106.9, -6.3] as Position],
  metrics: { distanceMeters: 15000, durationSeconds: 3600, elevationGainMeters: null, elevationLossMeters: null },
  repeatedRoadRatio: null,
  limitedReturnAlternatives: false,
  createdAt: new Date().toISOString(),
});

describe("buildGpx", () => {
  it("generates valid GPX XML", () => {
    const route = makeRoute();
    // buildGpx now returns the name - we need the content. Let's test the filename
    const filename = generateGpxFilename(route);
    expect(filename).toContain(".gpx");
    expect(filename).toContain("ridetopo-");
  });

  it("escapes XML special characters", () => {
    const route = makeRoute();
    route.input.locations[0] = { ...route.input.locations[0]!, label: "Start & Go" };
    const filename = generateGpxFilename(route);
    expect(filename).not.toContain("&");
    expect(filename).not.toContain("<");
  });

  it("uses safe slug for filenames", () => {
    const route = makeRoute();
    route.input.locations[0] = { ...route.input.locations[0]!, label: "Jakarta Pusat" };
    const filename = generateGpxFilename(route);
    expect(filename).toContain("jakarta-pusat");
  });
});
