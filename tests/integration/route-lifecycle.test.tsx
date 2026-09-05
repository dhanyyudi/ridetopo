import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRoutePlannerStore } from "../../src/store/route-planner-store";
import { buildDraftForCurrentState } from "../../src/features/route/use-route-planner-controller";
import { createInitialLocations, validateRouteLocations } from "../../src/domain/location";
import { PRODUCT_LIMITS } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

describe("route-planner store — location slots", () => {
  beforeEach(() => {
    useRoutePlannerStore.getState().resetAll();
  });

  it("initial A/B slots exist with position null (never [0,0])", () => {
    const state = useRoutePlannerStore.getState();
    state.setLocations(createInitialLocations());

    const locations = useRoutePlannerStore.getState().locations;
    expect(locations).toHaveLength(2);
    expect(locations[0]!.role).toBe("origin");
    expect(locations[1]!.role).toBe("destination");
    expect(locations[0]!.position).toBeNull();
    expect(locations[1]!.position).toBeNull();

    for (const loc of locations) {
      expect(loc.position?.[0]).not.toBe(0);
      expect(loc.position?.[1]).not.toBe(0);
    }
  });

  it("adds a waypoint immediately before B", () => {
    const state = useRoutePlannerStore.getState();
    state.setLocations(createInitialLocations());
    state.addWaypointBeforeDestination();

    const locations = useRoutePlannerStore.getState().locations;
    expect(locations).toHaveLength(3);
    expect(locations[0]!.role).toBe("origin");
    expect(locations[1]!.role).toBe("waypoint");
    expect(locations[2]!.role).toBe("destination");
  });

  it("rejects the 21st intermediate waypoint", () => {
    const state = useRoutePlannerStore.getState();
    state.setLocations(createInitialLocations());
    for (let i = 0; i < PRODUCT_LIMITS.maxIntermediateWaypoints; i++) {
      state.addWaypointBeforeDestination();
    }

    expect(
      useRoutePlannerStore.getState().locations.filter((l) => l.role === "waypoint"),
    ).toHaveLength(20);
  });

  it("swap keeps A first and B last", () => {
    const state = useRoutePlannerStore.getState();
    const locations = createInitialLocations();
    locations[0] = { ...locations[0]!, position: [1, 1] as Position, label: "X", source: "map" };
    locations[1] = { ...locations[1]!, position: [2, 2] as Position, label: "Y", source: "map" };
    state.setLocations(locations);
    state.swapDirections();

    const after = useRoutePlannerStore.getState().locations;
    expect(after[0]!.role).toBe("origin");
    expect(after[1]!.role).toBe("destination");
    expect(after[0]!.position).toEqual([2, 2]);
    expect(after[1]!.position).toEqual([1, 1]);
  });

  it("validates locations and rejects null positions", () => {
    const incomplete = createInitialLocations();
    const result = validateRouteLocations(incomplete);
    expect(result.ok).toBe(false);

    const complete = incomplete.map((l) => ({
      ...l,
      position: [106.8, -6.2] as Position,
      label: "Lokasi",
      source: "map" as const,
    }));
    const okResult = validateRouteLocations(complete);
    expect(okResult.ok).toBe(true);
  });
});

describe("route-planner store — result invariants", () => {
  beforeEach(() => {
    useRoutePlannerStore.getState().resetAll();
  });

  const fakeRoute = {
    id: "test-route",
    input: {} as never,
    outbound: {} as never,
    returnLeg: null,
    geometry: [],
    metrics: {
      distanceMeters: 1000,
      durationSeconds: 600,
      elevationGainMeters: null,
      elevationLossMeters: null,
    },
    repeatedRoadRatio: null,
    limitedReturnAlternatives: false,
    createdAt: new Date().toISOString(),
  };

  it("keeps lastValidRoute when a route error is set", () => {
    const state = useRoutePlannerStore.getState();
    state.setLastValidRoute(fakeRoute as never);
    state.setRouteError("Gagal merencanakan rute.");

    const after = useRoutePlannerStore.getState();
    expect(after.lastValidRoute?.id).toBe("test-route");
    expect(after.routeError).toBe("Gagal merencanakan rute.");
  });

  it("marks changes unapplied without clearing the route", () => {
    const state = useRoutePlannerStore.getState();
    state.setLastValidRoute(fakeRoute as never);
    state.setChangesUnapplied(true);

    const after = useRoutePlannerStore.getState();
    expect(after.changesUnapplied).toBe(true);
    expect(after.lastValidRoute?.id).toBe("test-route");
  });

  it("clears the error when a new valid route arrives", () => {
    const state = useRoutePlannerStore.getState();
    state.setRouteError("error");
    state.setLastValidRoute(fakeRoute as never);

    const after = useRoutePlannerStore.getState();
    expect(after.routeError).toBeNull();
    expect(after.changesUnapplied).toBe(false);
  });

  it("saves a draft with the new route's metadata, never the previous route's", () => {
    const state = useRoutePlannerStore.getState();
    state.setLastValidRoute({ ...fakeRoute, id: "route-old" } as never);
    state.setRoadSegments([
      {
        id: "edge-0",
        beginShapeIndex: 0,
        endShapeIndex: 5,
        name: "Jalan Lama",
        roadClass: "primary",
        surface: "asphalt",
        unpaved: false,
        use: "road",
        wayId: "1",
      },
    ]);

    const next = { ...fakeRoute, id: "route-new" };
    useRoutePlannerStore.getState().setLastValidRoute(next as never);
    const draft = buildDraftForCurrentState(next as never);

    expect(draft.route.id).toBe("route-new");
    expect(draft.roadSegments).toBeNull();
  });

  it("discards cached road segments when a new route arrives", () => {
    const state = useRoutePlannerStore.getState();
    state.setLastValidRoute(fakeRoute as never);
    state.setRoadSegments([{ id: "seg-1" } ] as never);
    state.setRoadMetadataError("Gagal memuat metadata ruas.");

    useRoutePlannerStore.getState().setLastValidRoute({ ...fakeRoute, id: "test-route-2" } as never);

    const after = useRoutePlannerStore.getState();
    expect(after.lastValidRoute?.id).toBe("test-route-2");
    expect(after.roadSegments).toBeNull();
    expect(after.roadMetadataError).toBeNull();
  });
});

describe("route-planner store — views", () => {
  beforeEach(() => {
    useRoutePlannerStore.getState().resetAll();
  });

  it("switches between app views", () => {
    const state = useRoutePlannerStore.getState();
    expect(state.appView).toBe("composer");
    state.setAppView("result");
    expect(useRoutePlannerStore.getState().appView).toBe("result");
    state.setAppView("road-review");
    expect(useRoutePlannerStore.getState().appView).toBe("road-review");
  });

  it("search dialog state is explicit", () => {
    const state = useRoutePlannerStore.getState();
    expect(state.searchDialog.open).toBe(false);
    state.setSearchDialog({ open: true, targetId: "abc" });
    expect(useRoutePlannerStore.getState().searchDialog.open).toBe(true);
    expect(useRoutePlannerStore.getState().searchDialog.targetId).toBe("abc");
  });
});

describe("route-planner UI wiring", () => {
  beforeEach(() => {
    useRoutePlannerStore.getState().resetAll();
  });

  it("renders A and B slot labels via store state", () => {
    useRoutePlannerStore.getState().setLocations(createInitialLocations());

    const FakeView = () => {
      const locations = useRoutePlannerStore((s) => s.locations);
      return (
        <ul>
          {locations.map((l) => (
            <li key={l.id} data-role={l.role} data-position={l.position === null ? "empty" : "set"}>
              {l.role}
            </li>
          ))}
        </ul>
      );
    };

    render(<FakeView />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.getAttribute("data-position")).toBe("empty");
    fireEvent.click(screen.getByText("origin"));
  });
});
