import { describe, it, expect } from "vitest";
import { ROUND_TRIP_CONFIG } from "../../src/domain/route";

describe("round-trip config", () => {
  it("has expected defaults", () => {
    expect(ROUND_TRIP_CONFIG.linearCostFactor).toBe(5);
    expect(ROUND_TRIP_CONFIG.alternateCount).toBe(2);
    expect(ROUND_TRIP_CONFIG.overlapToleranceMeters).toBe(35);
    expect(ROUND_TRIP_CONFIG.highOverlapWarningRatio).toBe(0.6);
  });

  it("has valid overlap + detour weights summing to 1", () => {
    expect(ROUND_TRIP_CONFIG.overlapWeight + ROUND_TRIP_CONFIG.detourWeight).toBeCloseTo(1);
  });
});
