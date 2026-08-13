import { describe, it, expect } from "vitest";
import { parseDraft, buildDraftFromRoute } from "../../src/services/persistence/draft-serialization";
import type { PlannedRoute } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

function makeRoute(): PlannedRoute {
  return {
    id: "route-1",
    input: {
      locations: [
        { id: "a", role: "origin", position: [106.8, -6.2] as Position, label: "A", source: "search" },
        { id: "b", role: "destination", position: [106.9, -6.3] as Position, label: "B", source: "search" },
      ],
      profile: "road-bike",
      roadPreference: "standard",
      terrainPreference: "standard",
      exclusions: [],
      returnToStart: false,
      returnMode: "different-road",
    },
    outbound: {
      id: "leg",
      geometry: [[106.8, -6.2] as Position, [106.9, -6.3] as Position],
      distanceMeters: 15000,
      durationSeconds: 1800,
      elevation: [{ distanceMeters: 0, elevationMeters: 5 }],
      encodedShape: "x",
    },
    returnLeg: null,
    geometry: [[106.8, -6.2] as Position, [106.9, -6.3] as Position],
    metrics: {
      distanceMeters: 15000,
      durationSeconds: 1800,
      elevationGainMeters: null,
      elevationLossMeters: null,
    },
    repeatedRoadRatio: null,
    limitedReturnAlternatives: false,
    createdAt: new Date().toISOString(),
  };
}

describe("draft serialization", () => {
  it("accepts a valid draft", () => {
    const draft = buildDraftFromRoute(makeRoute(), null, []);
    const parsed = parseDraft(draft);
    expect(parsed).not.toBeNull();
    expect(parsed!.route.id).toBe("route-1");
  });

  it("rejects a wrong schema version", () => {
    const draft = { ...buildDraftFromRoute(makeRoute(), null, []), version: 2 as const };
    expect(parseDraft(draft)).toBeNull();
  });

  it("rejects missing route identity", () => {
    const draft = buildDraftFromRoute(makeRoute(), null, []);
    const broken = { ...draft, route: { ...draft.route, id: "" } };
    expect(parseDraft(broken)).toBeNull();
  });

  it("rejects non-finite coordinates", () => {
    const draft = buildDraftFromRoute(makeRoute(), null, []);
    const broken = {
      ...draft,
      route: {
        ...draft.route,
        geometry: [[Number.NaN, -6.2] as Position, [106.9, -6.3] as Position],
      },
    };
    expect(parseDraft(broken)).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    const draft = buildDraftFromRoute(makeRoute(), null, []);
    const broken = {
      ...draft,
      route: {
        ...draft.route,
        geometry: [[200, -6.2] as Position, [106.9, -6.3] as Position],
      },
    };
    expect(parseDraft(broken)).toBeNull();
  });

  it("rejects exclusions above the product cap", () => {
    const draft = buildDraftFromRoute(makeRoute(), null, []);
    const manyExclusions = Array.from({ length: 51 }, (_, i) => [106 + i * 0.001, -6] as Position);
    const broken = { ...draft, activeExclusions: manyExclusions };
    expect(parseDraft(broken)).toBeNull();
  });

  it("rejects garbage structures", () => {
    expect(parseDraft({ hello: "world" })).toBeNull();
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("not-an-object")).toBeNull();
    expect(parseDraft([])).toBeNull();
  });
});
