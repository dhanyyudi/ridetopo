import { describe, it, expect } from "vitest";
import { buildValhallaRequest } from "../../src/providers/routing/build-valhalla-request";
import { decodePolyline6 } from "../../src/lib/polyline6";
import {
  normalizeValhallaResponse,
  normalizeValhallaTrip,
  normalizeAlternateTrips,
  buildElevationSamples,
  ValhallaResponseError,
} from "../../src/providers/routing/normalize-valhalla-response";
import type { ProviderRouteRequest } from "../../src/providers/contracts";
import type { Position } from "../../src/domain/geo";
import type { ValhallaRouteResponse } from "../../src/providers/routing/valhalla-types";

const sampleRequest: ProviderRouteRequest = {
  locations: [[106.821, -6.201] as Position, [106.851, -6.181] as Position],
  profile: "road-bike",
  roadPreference: "standard",
  terrainPreference: "standard",
  exclusions: [],
  elevationIntervalMeters: 30,
};

describe("Valhalla request contract", () => {
  describe("standard preferences send no hidden costing overrides", () => {
    it("omits maneuver_penalty, use_roads, and use_hills", () => {
      const req = buildValhallaRequest(sampleRequest);
      expect(req.costing).toBe("bicycle");
      expect(req.costing_options?.bicycle?.maneuver_penalty).toBeUndefined();
      expect(req.costing_options?.bicycle?.use_roads).toBeUndefined();
      expect(req.costing_options?.bicycle?.use_hills).toBeUndefined();
    });

    it("maps Road Bike to road and Commuter Bike to hybrid", () => {
      expect(buildValhallaRequest(sampleRequest).costing_options?.bicycle?.bicycle_type).toBe("road");
      expect(
        buildValhallaRequest({ ...sampleRequest, profile: "commuter-bike" }).costing_options?.bicycle
          ?.bicycle_type,
      ).toBe("hybrid");
    });

    it("sets use_roads only for Jalan Kecil", () => {
      const req = buildValhallaRequest({ ...sampleRequest, roadPreference: "small-roads" });
      expect(req.costing_options?.bicycle?.use_roads).toBe(0.25);
      expect(req.costing_options?.bicycle?.use_hills).toBeUndefined();
    });

    it("sets use_hills only for Lebih Landai", () => {
      const req = buildValhallaRequest({ ...sampleRequest, terrainPreference: "flatter" });
      expect(req.costing_options?.bicycle?.use_hills).toBe(0.25);
      expect(req.costing_options?.bicycle?.use_roads).toBeUndefined();
    });
  });

  describe("exclusions", () => {
    it("caps exclusions at 50", () => {
      const many = Array.from({ length: 60 }, (_, i) => [i * 0.001, i * 0.001] as Position);
      const req = buildValhallaRequest({ ...sampleRequest, exclusions: many });
      expect(req.exclude_locations?.length).toBe(50);
    });
  });

  describe("linear_cost_factors serialization", () => {
    it("sends the exact {shape, factor} schema with the encoded shape string", () => {
      const shape: Position[] = [
        [106.85, -6.18],
        [106.84, -6.185],
        [106.83, -6.19],
      ];
      const req = buildValhallaRequest({
        ...sampleRequest,
        linearCostShape: shape,
        linearCostFactor: 5,
        alternateCount: 2,
      });

      expect(req.linear_cost_factors).toHaveLength(1);
      const factor = req.linear_cost_factors![0]!;
      expect(factor.factor).toBe(5);
      /* The live server contract accepts an encoded polyline6 string */
      expect(typeof factor.shape).toBe("string");
      expect((factor.shape as string).length).toBeGreaterThan(0);
      /* The encoded string decodes back to the exact coordinates */
      const decoded = decodePolyline6(factor.shape as string);
      expect(decoded).toHaveLength(3);
      expect(decoded[0]![0]).toBeCloseTo(106.85, 6);
      expect(decoded[0]![1]).toBeCloseTo(-6.18, 6);
      expect(req.alternates).toBe(2);
    });

    it("omits linear_cost_factors without a shape", () => {
      const req = buildValhallaRequest({ ...sampleRequest, linearCostFactor: 5 });
      expect(req.linear_cost_factors).toBeUndefined();
    });

    it("omits linear_cost_factors for degenerate shapes", () => {
      const req = buildValhallaRequest({
        ...sampleRequest,
        linearCostFactor: 5,
        linearCostShape: [[106.85, -6.18] as Position],
      });
      expect(req.linear_cost_factors).toBeUndefined();
    });
  });

  describe("elevation interval", () => {
    it("always sends elevation_interval 30 and kilometer units", () => {
      const req = buildValhallaRequest(sampleRequest);
      expect(req.elevation_interval).toBe(30);
      expect(req.directions_options?.units).toBe("kilometers");
    });
  });
});

describe("Valhalla response normalization", () => {
  it("normalizes a valid response with distance-mapped elevation", () => {
    /* 417 samples at 30 m spans 12.48 km, which matches the 12.5 km leg. */
    const elevation = Array.from({ length: 417 }, (_, i) => 5 + (i % 4));
    const raw: ValhallaRouteResponse = {
      trip: {
        status: 0,
        status_message: "Found route",
        legs: [
          {
            shape: "kz~fA_ehsWb@w@h@c@LY\\E\\EdCcA",
            summary: { length: 12.5, time: 1800 },
            elevation,
          },
        ],
        summary: { length: 12.5, time: 1800 },
      },
    };
    const result = normalizeValhallaResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.distanceMeters).toBe(12500);
    expect(result[0]!.durationSeconds).toBe(1800);
    expect(result[0]!.geometry.length).toBeGreaterThan(1);
    /* Distance-interval mapping: sample i -> i*30 */
    expect(result[0]!.elevation[1]!.distanceMeters).toBe(30);
    expect(result[0]!.elevation[4]!.distanceMeters).toBe(120);
  });

  it("maps 299 samples over a 8.937 km leg (370 vertices)", () => {
    const elevation = Array.from({ length: 299 }, (_, i) => 100 + i * 0.5);

    const samples = buildElevationSamples(elevation, 30, 8937);
    expect(samples).toHaveLength(299);
    /* Sample count stays 299 — never extended to the 370 geometry vertices */
    expect(samples[samples.length - 1]!.distanceMeters).toBeLessThanOrEqual(8937);
    expect(samples[samples.length - 1]!.distanceMeters).toBe(8937);
  });

  it("drops an elevation array that is far too long for the leg", () => {
    const elevation = Array.from({ length: 1000 }, () => 10);
    /* Unmappable elevation must not destroy the route: the samples are
       dropped so the UI shows the unavailable state instead. */
    expect(buildElevationSamples(elevation, 30, 5000)).toEqual([]);
  });

  it("drops an elevation array that is far too short for the leg", () => {
    const elevation = Array.from({ length: 40 }, () => 10);
    expect(buildElevationSamples(elevation, 30, 14_600)).toEqual([]);
  });

  it("drops a long-route profile that stops short, however small the share", () => {
    /* 500 km at 30 m, but the profile ends five kilometres early. A
       percentage tolerance would have waved this through. */
    const covered = 495_000;
    const elevation = Array.from({ length: covered / 30 + 1 }, () => 10);
    expect(buildElevationSamples(elevation, 30, 500_000)).toEqual([]);
  });

  it("keeps an array whose span matches the leg within tolerance", () => {
    const elevation = Array.from({ length: 299 }, () => 10);
    expect(buildElevationSamples(elevation, 30, 8937)).toHaveLength(299);
  });

  it("treats -500 and non-finite values as null", () => {
    const samples = buildElevationSamples([5, -500, Number.NaN, Number.POSITIVE_INFINITY, 9], 30, 120);
    expect(samples[0]!.elevationMeters).toBe(5);
    expect(samples[1]!.elevationMeters).toBeNull();
    expect(samples[2]!.elevationMeters).toBeNull();
    expect(samples[3]!.elevationMeters).toBeNull();
    expect(samples[4]!.elevationMeters).toBe(9);
  });

  it("throws on missing trip and empty legs", () => {
    expect(() => normalizeValhallaResponse({})).toThrow(ValhallaResponseError);
    expect(() =>
      normalizeValhallaResponse({ trip: { status: 0, status_message: "", legs: [] } }),
    ).toThrow(ValhallaResponseError);
  });

  it("throws on invalid distance", () => {
    expect(() =>
      normalizeValhallaResponse({
        trip: {
          status: 0,
          legs: [{ shape: "kz~fA_ehsWb@w@h@c@", summary: { length: 0, time: 100 } }],
        },
      }),
    ).toThrow(ValhallaResponseError);
  });

  describe("primary versus alternate normalization", () => {
    const rawWithAlternates: ValhallaRouteResponse = {
      trip: {
        status: 0,
        status_message: "Found route with alternatives",
        legs: [
          {
            shape: "kz~fA_ehsWb@w@h@c@",
            summary: { length: 8.2, time: 1200 },
          },
        ],
        summary: { length: 8.2, time: 1200 },
        alternates: [
          {
            legs: [
              {
                shape: "kz~fA_iisWb@o@f@a@",
                summary: { length: 9.8, time: 1500 },
              },
            ],
            summary: { length: 9.8, time: 1500 },
          },
          {
            legs: [
              {
                shape: "kz~fA_iesW`@u@d@c@",
                summary: { length: 11.0, time: 1650 },
              },
            ],
            summary: { length: 11.0, time: 1650 },
          },
        ],
      },
    };

    it("normalizes the primary trip only", () => {
      const result = normalizeValhallaResponse(rawWithAlternates);
      expect(result).toHaveLength(1);
      expect(result[0]!.distanceMeters).toBe(8200);
    });

    it("normalizes alternates separately", () => {
      const alternates = normalizeAlternateTrips(rawWithAlternates);
      expect(alternates).toHaveLength(2);
      expect(alternates[0]!.distanceMeters).toBe(9800);
      expect(alternates[1]!.distanceMeters).toBe(11000);
    });

    it("also reads alternates from the top-level trip wrappers", () => {
      const topLevel: ValhallaRouteResponse = {
        trip: {
          status: 0,
          legs: [{ shape: "kz~fA_ehsWb@w@h@c@", summary: { length: 8.2, time: 1200 } }],
          summary: { length: 8.2, time: 1200 },
        },
        alternates: [
          {
            trip: {
              status: 0,
              legs: [{ shape: "kz~fA_iisWb@o@f@a@", summary: { length: 9.8, time: 1500 } }],
              summary: { length: 9.8, time: 1500 },
            },
          },
        ],
      };
      const alternates = normalizeAlternateTrips(topLevel);
      expect(alternates).toHaveLength(1);
      expect(alternates[0]!.distanceMeters).toBe(9800);
    });
  });

  describe("multi-leg trips", () => {
    const twoLegTrip: ValhallaRouteResponse = {
      trip: {
        status: 0,
        legs: [
          {
            shape: "kz~fA_ehsWb@w@h@c@",
            summary: { length: 10, time: 1200 },
            /* 334 samples at 30 m spans 9.99 km, matching the 10 km leg. */
            elevation: Array.from({ length: 334 }, (_, i) => 10 + (i % 3)),
          },
          {
            shape: "kz~fA_iisWb@o@f@a@",
            summary: { length: 8, time: 900 },
            elevation: Array.from({ length: 267 }, (_, i) => 12 + (i % 3)),
          },
        ],
        summary: { length: 18, time: 2100 },
      },
    };

    it("normalizes every leg of a waypoint route", () => {
      expect(normalizeValhallaResponse(twoLegTrip)).toHaveLength(2);
    });

    it("collapses the legs into one trip with the full distance and duration", () => {
      const trip = normalizeValhallaTrip(twoLegTrip);
      expect(trip.distanceMeters).toBe(18_000);
      expect(trip.durationSeconds).toBe(2100);
    });

    it("keeps every geometry vertex and re-encodes the combined shape", () => {
      const legs = normalizeValhallaResponse(twoLegTrip);
      const trip = normalizeValhallaTrip(twoLegTrip);
      const vertexCount = legs.reduce((n, leg) => n + leg.geometry.length, 0);
      /* The legs do not share a vertex here, so nothing is dropped. */
      expect(trip.geometry).toHaveLength(vertexCount);
      expect(decodePolyline6(trip.encodedShape)).toHaveLength(vertexCount);
    });

    it("puts the second leg's elevation on the combined distance axis", () => {
      const trip = normalizeValhallaTrip(twoLegTrip);
      expect(trip.elevation).toHaveLength(334 + 267);
      expect(trip.elevation[0]!.distanceMeters).toBe(0);
      expect(trip.elevation[333]!.distanceMeters).toBe(9_990);
      /* The return leg restarts at 0 and must be shifted by the first leg. */
      expect(trip.elevation[334]!.distanceMeters).toBe(10_000);
      expect(trip.elevation[335]!.distanceMeters).toBe(10_030);
      const distances = trip.elevation.map((sample) => sample.distanceMeters);
      expect(distances.every((d, i) => i === 0 || d > distances[i - 1]!)).toBe(true);
    });

    it("never borrows the trip summary for one leg of many", () => {
      const missingSummary: ValhallaRouteResponse = {
        trip: {
          status: 0,
          legs: [
            { shape: "kz~fA_ehsWb@w@h@c@", summary: { length: 10, time: 1200 } },
            { shape: "kz~fA_iisWb@o@f@a@" },
          ],
          summary: { length: 18, time: 2100 },
        },
      };
      expect(() => normalizeValhallaResponse(missingSummary)).toThrow(ValhallaResponseError);
    });
  });
});
