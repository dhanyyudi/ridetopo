import { describe, it, expect } from "vitest";
import {
  formatDistance,
  formatElevation,
  formatDuration,
  formatPercentage,
} from "../../src/content/id";

describe("formatDistance", () => {
  it("formats 0 meters", () => {
    const result = formatDistance(0);
    expect(result).toContain("0,0");
    expect(result).toContain("km");
  });

  it("formats decimal kilometers", () => {
    const result = formatDistance(3500);
    expect(result).toContain("3,5");
    expect(result).toContain("km");
  });

  it("uses Indonesian locale separator", () => {
    const result = formatDistance(12500.3);
    expect(result).toContain("12,5");
    expect(result).toContain("km");
  });
});

describe("formatElevation", () => {
  it("rounds to nearest 5 meters", () => {
    expect(formatElevation(0)).toBe("0 m");
    expect(formatElevation(3)).toBe("5 m");
    expect(formatElevation(7)).toBe("5 m");
    expect(formatElevation(8)).toBe("10 m");
    expect(formatElevation(12)).toBe("10 m");
    expect(formatElevation(13)).toBe("15 m");
  });

  it("uses Indonesian locale format", () => {
    const result = formatElevation(1234);
    expect(result).toContain("1.235"); // 1234 round to 1235
    expect(result).toContain("m");
  });
});

describe("formatDuration", () => {
  it("formats minutes under 1 hour", () => {
    expect(formatDuration(600)).toBe("10 mnt");
    expect(formatDuration(60)).toBe("1 mnt");
    expect(formatDuration(0)).toBe("0 mnt");
  });

  it("formats hours with minutes", () => {
    expect(formatDuration(5400)).toBe("1 jam 30 mnt");
    expect(formatDuration(3660)).toBe("1 jam 1 mnt");
  });

  it("formats exact hours", () => {
    expect(formatDuration(7200)).toBe("2 jam");
    expect(formatDuration(3600)).toBe("1 jam");
  });
});

describe("formatPercentage", () => {
  it("formats ratio as percentage", () => {
    expect(formatPercentage(0.5)).toBe("50%");
    expect(formatPercentage(0.33)).toBe("33%");
    expect(formatPercentage(1)).toBe("100%");
    expect(formatPercentage(0)).toBe("0%");
  });
});
