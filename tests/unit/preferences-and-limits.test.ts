import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPreferences,
  savePreferences,
  clearPreferences,
} from "../../src/services/persistence/preference-storage";
import { straightLineLowerBound, planRoute, RouteError } from "../../src/services/routing/plan-route";
import type { RoutePlanInput } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";
import type { RoutingProvider } from "../../src/providers/contracts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe("preference storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("round-trips the three UI preferences", () => {
    savePreferences(
      { profile: "commuter-bike", roadPreference: "small-roads", terrainPreference: "flatter" },
      storage,
    );

    expect(loadPreferences(storage)).toEqual({
      profile: "commuter-bike",
      roadPreference: "small-roads",
      terrainPreference: "flatter",
    });
  });

  it("stores nothing that could reveal where someone rides", () => {
    savePreferences(
      { profile: "road-bike", roadPreference: "standard", terrainPreference: "standard" },
      storage,
    );

    const raw = storage.getItem("ridetopo:preferences:v1")!;
    expect(raw).not.toMatch(/location|position|geometry|exclusion|lat|lon/i);
  });

  it("ignores corrupt, foreign, and outdated values", () => {
    storage.setItem("ridetopo:preferences:v1", "{not json");
    expect(loadPreferences(storage)).toBeNull();

    storage.setItem("ridetopo:preferences:v1", JSON.stringify({ version: 1, profile: "gravel" }));
    expect(loadPreferences(storage)).toBeNull();

    storage.setItem(
      "ridetopo:preferences:v1",
      JSON.stringify({
        version: 2,
        profile: "road-bike",
        roadPreference: "standard",
        terrainPreference: "standard",
      }),
    );
    expect(loadPreferences(storage)).toBeNull();
  });

  it("returns null after clearing and survives storage being unavailable", () => {
    savePreferences(
      { profile: "road-bike", roadPreference: "standard", terrainPreference: "standard" },
      storage,
    );
    clearPreferences(storage);
    expect(loadPreferences(storage)).toBeNull();

    expect(() =>
      savePreferences(
        { profile: "road-bike", roadPreference: "standard", terrainPreference: "standard" },
        undefined,
      ),
    ).not.toThrow();
    expect(loadPreferences(undefined)).toBeNull();
  });
});

function input(positions: Position[], returnToStart = false): RoutePlanInput {
  return {
    locations: positions.map((position, i) => ({
      id: `l${i}`,
      role: i === 0 ? "origin" : i === positions.length - 1 ? "destination" : "waypoint",
      position,
      label: `L${i}`,
      source: "map" as const,
    })),
    profile: "road-bike",
    roadPreference: "standard",
    terrainPreference: "standard",
    exclusions: [],
    returnToStart,
    returnMode: "different-road",
  };
}

describe("straight-line 500 km precheck", () => {
  /* Jakarta to a point roughly 800 km east. */
  const JAKARTA: Position = [106.827, -6.175];
  const FAR_EAST: Position = [114.0, -6.175];
  const BOGOR: Position = [106.8, -6.6];

  it("measures the ride, including the way home", () => {
    expect(straightLineLowerBound(input([JAKARTA, BOGOR]))).toBeGreaterThan(40_000);
    expect(straightLineLowerBound(input([JAKARTA, BOGOR], true))).toBeCloseTo(
      straightLineLowerBound(input([JAKARTA, BOGOR])) * 2,
      -2,
    );
  });

  it("rejects an impossible route without asking the router", async () => {
    let called = false;
    const provider: RoutingProvider = {
      route: async () => {
        called = true;
        return [];
      },
      routeCandidates: async () => [],
      traceAttributes: async () => [],
    };

    await expect(
      planRoute(input([JAKARTA, FAR_EAST]), provider, new AbortController().signal),
    ).rejects.toThrow(RouteError);
    expect(called).toBe(false);
  });

  it("lets a plausible route through to the router", async () => {
    let called = false;
    const provider: RoutingProvider = {
      route: async () => {
        called = true;
        throw new Error("reached the provider");
      },
      routeCandidates: async () => [],
      traceAttributes: async () => [],
    };

    await expect(
      planRoute(input([JAKARTA, BOGOR]), provider, new AbortController().signal),
    ).rejects.toThrow("reached the provider");
    expect(called).toBe(true);
  });
});
