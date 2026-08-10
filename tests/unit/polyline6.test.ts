import { describe, it, expect } from "vitest";
import { encodePolyline6, decodePolyline6, reverseGeometry } from "../../src/lib/polyline6";

describe("polyline6", () => {
  describe("encodePolyline6", () => {
    it("returns empty string for empty input", () => {
      expect(encodePolyline6([])).toBe("");
    });

    it("encodes a simple path", () => {
      const encoded = encodePolyline6([
        [0, 0],
        [0.00001, 0.00001],
      ]);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    it("encodes negative deltas", () => {
      const encoded = encodePolyline6([
        [0, 0],
        [-0.00001, -0.00001],
      ]);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe("decodePolyline6", () => {
    it("returns empty array for empty input", () => {
      expect(decodePolyline6("")).toEqual([]);
    });

    it("decodes encoded path back", () => {
      const original = [
        [106.821, -6.201] as const,
        [106.831, -6.205] as const,
      ];
      const encoded = encodePolyline6(original);
      const decoded = decodePolyline6(encoded);
      expect(decoded.length).toBe(original.length);
      for (let i = 0; i < decoded.length; i++) {
        expect(decoded[i]![0]).toBeCloseTo(original[i]![0], 5);
        expect(decoded[i]![1]).toBeCloseTo(original[i]![1], 5);
      }
    });

    it("round-trips known fixture", () => {
      const fixture = "kz~fA_ehsWb@w@h@c@";
      const decoded = decodePolyline6(fixture);
      expect(decoded.length).toBeGreaterThan(1);
      const reEncoded = encodePolyline6(decoded as [number, number][]);
      expect(reEncoded).toBe(fixture);
    });

    it("throws on incomplete encoded input", () => {
      expect(() => decodePolyline6("?")).toThrow();
    });
  });

  describe("reverseGeometry", () => {
    it("reverses an array", () => {
      const input = [[0, 0], [1, 1], [2, 2]] as const;
      const result = reverseGeometry(input);
      expect(result[0]).toEqual([2, 2]);
      expect(result[2]).toEqual([0, 0]);
    });
  });
});
