import { describe, it, expect, beforeEach } from "vitest";
import { useRoutePlannerStore } from "../../src/store/route-planner-store";
import type { Position, RouteLocation } from "../../src/domain/location";

function makeLocation(role: "origin" | "destination" | "waypoint", lng: number, lat: number): RouteLocation {
  return {
    id: crypto.randomUUID(),
    role,
    position: [lng, lat] as Position,
    label: role === "origin" ? "Start" : role === "destination" ? "End" : "WP",
    source: "search",
  };
}

describe("route-planner store", () => {
  beforeEach(() => {
    useRoutePlannerStore.getState().reset();
  });

  it("initializes with default state", () => {
    const s = useRoutePlannerStore.getState();
    expect(s.locations).toEqual([]);
    expect(s.profile).toBe("road-bike");
    expect(s.returnToStart).toBe(false);
    expect(s.isCalculating).toBe(false);
  });

  it("adds and removes locations", () => {
    const store = useRoutePlannerStore.getState();
    const loc = makeLocation("origin", 106.8, -6.2);
    store.addLocation(loc);
    expect(useRoutePlannerStore.getState().locations).toHaveLength(1);

    store.removeLocation(loc.id);
    expect(useRoutePlannerStore.getState().locations).toHaveLength(0);
  });

  it("swaps directions", () => {
    const store = useRoutePlannerStore.getState();
    store.addLocation(makeLocation("origin", 106.8, -6.2));
    store.addLocation(makeLocation("destination", 106.9, -6.3));
    store.swapDirections();

    const locs = useRoutePlannerStore.getState().locations;
    expect(locs[0]!.role).toBe("origin");
    expect(locs[1]!.role).toBe("destination");
  });

  it("toggles return mode", () => {
    const store = useRoutePlannerStore.getState();
    store.setReturnToStart(true);
    expect(useRoutePlannerStore.getState().returnToStart).toBe(true);

    store.setReturnMode("fastest");
    expect(useRoutePlannerStore.getState().returnMode).toBe("fastest");
  });

  it("preserves last valid route on error", () => {
    const store = useRoutePlannerStore.getState();
    const route = {
      id: "test-route",
      input: {} as never,
      outbound: {} as never,
      returnLeg: null,
      geometry: [],
      metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: null, elevationLossMeters: null },
      repeatedRoadRatio: null,
      limitedReturnAlternatives: false,
      createdAt: new Date().toISOString(),
    };

    store.setLastValidRoute(route);
    expect(useRoutePlannerStore.getState().lastValidRoute).toBe(route);

    store.setRouteError("Some error");
    expect(useRoutePlannerStore.getState().lastValidRoute).toBe(route);
    expect(useRoutePlannerStore.getState().routeError).toBe("Some error");
  });

  it("resets to initial state", () => {
    const store = useRoutePlannerStore.getState();
    store.addLocation(makeLocation("origin", 106.8, -6.2));
    store.setProfile("commuter-bike");
    store.reset();

    const s = useRoutePlannerStore.getState();
    expect(s.locations).toEqual([]);
    expect(s.profile).toBe("road-bike");
  });
});
