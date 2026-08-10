import { describe, it, expect } from "vitest";
import { buildValhallaRequest } from "../../src/providers/routing/build-valhalla-request";
import { normalizeValhallaResponse } from "../../src/providers/routing/normalize-valhalla-response";
import type { ProviderRouteRequest } from "../../src/providers/contracts";
import type { Position } from "../../src/domain/geo";

const sampleRequest: ProviderRouteRequest = {
  locations: [[106.821, -6.201] as Position, [106.851, -6.181] as Position],
  profile: "road-bike",
  roadPreference: "standard",
  terrainPreference: "standard",
  exclusions: [],
  elevationIntervalMeters: 30,
};

describe("Valhalla contract", () => {
  describe("buildValhallaRequest", () => {
    it("builds road bike request", () => {
      const req = buildValhallaRequest(sampleRequest);
      expect(req.costing).toBe("bicycle");
      expect(req.costing_options?.bicycle?.bicycle_type).toBe("road");
    });

    it("builds commuter bike request", () => {
      const req = buildValhallaRequest({ ...sampleRequest, profile: "commuter-bike" });
      expect(req.costing_options?.bicycle?.bicycle_type).toBe("hybrid");
    });

    it("omits use_roads for standard preference", () => {
      const req = buildValhallaRequest(sampleRequest);
      expect(req.costing_options?.bicycle?.use_roads).toBeUndefined();
    });

    it("sets use_roads for small-roads preference", () => {
      const req = buildValhallaRequest({ ...sampleRequest, roadPreference: "small-roads" });
      expect(req.costing_options?.bicycle?.use_roads).toBe(0.25);
    });

    it("omits use_hills for standard preference", () => {
      const req = buildValhallaRequest(sampleRequest);
      expect(req.costing_options?.bicycle?.use_hills).toBeUndefined();
    });

    it("sets use_hills for flatter preference", () => {
      const req = buildValhallaRequest({ ...sampleRequest, terrainPreference: "flatter" });
      expect(req.costing_options?.bicycle?.use_hills).toBe(0.25);
    });

    it("caps exclusions at 50", () => {
      const manyExclusions = Array.from({ length: 60 }, (_, i) => [i * 0.001, i * 0.001] as Position);
      const req = buildValhallaRequest({ ...sampleRequest, exclusions: manyExclusions });
      expect(req.exclude_locations?.length).toBeLessThanOrEqual(50);
    });

    it("includes exclude_locations when provided", () => {
      const req = buildValhallaRequest({
        ...sampleRequest,
        exclusions: [[106.8, -6.2] as Position],
      });
      expect(req.exclude_locations).toHaveLength(1);
    });
  });

  describe("normalizeValhallaResponse", () => {
    it("normalizes a valid response", () => {
      const raw = {
        trip: {
          status: 0,
          status_message: "Found route",
          legs: [{
            shape: "kz~fA_ehsWb@w@h@c@LY\\E\\EdCcA",
            summary: { length: 12.5, time: 1800 },
            elevation: [5, 6, 7, 8, 9, 8, 7, 6, 5],
          }],
          summary: { length: 12.5, time: 1800 },
        },
      };
      const result = normalizeValhallaResponse(raw);
      expect(result).toHaveLength(1);
      expect(result[0]!.distanceMeters).toBe(12500);
      expect(result[0]!.durationSeconds).toBe(1800);
      expect(result[0]!.geometry.length).toBeGreaterThan(1);
    });

    it("throws on missing trip", () => {
      expect(() => normalizeValhallaResponse({})).toThrow();
    });

    it("throws on empty legs", () => {
      expect(() =>
        normalizeValhallaResponse({
          trip: { status: 0, status_message: "", legs: [] },
        }),
      ).toThrow();
    });
  });
});
