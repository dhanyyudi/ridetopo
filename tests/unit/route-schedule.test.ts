import { describe, it, expect } from "vitest";
import { buildSchedule } from "../../src/services/routing/route-schedule";
import { buildRouteMarkers } from "../../src/services/routing/route-markers";
import type { PlannedRoute } from "../../src/domain/route";
import type { Position } from "../../src/domain/geo";

const NOW = new Date(2026, 8, 5, 21, 31);

describe("buildSchedule", () => {
  it("assumes now when no departure was chosen, and says so", () => {
    const schedule = buildSchedule(45 * 60, null, NOW)!;
    expect(schedule.departureLabel).toMatch(/21[.:]31/);
    expect(schedule.arrivalLabel).toMatch(/22[.:]16/);
    expect(schedule.assumedNow).toBe(true);
  });

  it("honours a planned departure later today", () => {
    const schedule = buildSchedule(30 * 60, "23:00", NOW)!;
    expect(schedule.departureLabel).toMatch(/23[.:]00/);
    expect(schedule.arrivalLabel).toMatch(/23[.:]30/);
    expect(schedule.assumedNow).toBe(false);
  });

  it("rolls an hour that already passed to tomorrow", () => {
    /* Planning tonight for a 06:00 ride means tomorrow morning. */
    const schedule = buildSchedule(60 * 60, "06:00", NOW)!;
    expect(schedule.departure.getDate()).toBe(NOW.getDate() + 1);
    expect(schedule.arrivalLabel).toMatch(/07[.:]00/);
  });

  it("ignores nonsense rather than inventing a time", () => {
    expect(buildSchedule(600, "25:99", NOW)!.assumedNow).toBe(true);
    expect(buildSchedule(600, "pagi", NOW)!.assumedNow).toBe(true);
    expect(buildSchedule(0, "07:00", NOW)).toBeNull();
  });
});

function route(returnToStart: boolean): PlannedRoute {
  const geometry: Position[] = [
    [106.80, -6.20],
    [106.85, -6.20],
    [106.90, -6.20],
  ];
  const leg = {
    id: "l",
    geometry,
    distanceMeters: 10_000,
    durationSeconds: 2_700,
    elevation: [],
    encodedShape: "x",
  };
  return {
    id: "r",
    input: {
      locations: [
        { id: "a", role: "origin", position: geometry[0]!, label: "A", source: "map" },
        { id: "b", role: "destination", position: geometry[2]!, label: "B", source: "map" },
      ],
      profile: "road-bike",
      roadPreference: "standard",
      terrainPreference: "standard",
      exclusions: [],
      returnToStart,
      returnMode: "different-road",
    },
    outbound: leg,
    returnLeg: null,
    geometry,
    metrics: {
      distanceMeters: 10_000,
      durationSeconds: 2_700,
      elevationGainMeters: null,
      elevationLossMeters: null,
    },
    repeatedRoadRatio: null,
    limitedReturnAlternatives: false,
    createdAt: NOW.toISOString(),
  };
}

describe("marker time labels", () => {
  const times = { departureLabel: "21.31", arrivalLabel: "22.16" };

  it("puts the departure on A and the arrival on B", () => {
    const [a, b] = buildRouteMarkers(route(false), times);
    expect(a!.sublabel).toBe("21.31");
    expect(b!.sublabel).toBe("22.16");
  });

  it("gives a round trip both times on A, and none on the turnaround", () => {
    const [a, b] = buildRouteMarkers(route(true), times);
    expect(a!.sublabel).toBe("21.31 – 22.16");
    /* B is the turnaround, not the end of the ride: no arrival to claim. */
    expect(b!.sublabel).toBeUndefined();
  });

  it("omits times entirely when there is no schedule", () => {
    const [a, b] = buildRouteMarkers(route(false));
    expect(a!.sublabel).toBeUndefined();
    expect(b!.sublabel).toBeUndefined();
  });
});
