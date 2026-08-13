import { describe, it, expect } from "vitest";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  normalizeRouteSilhouette,
  simplifyForDisplay,
} from "../../src/services/export/render-route-card";
import type { Position } from "../../src/domain/geo";

const AREA = { x: 96, y: 900, width: CARD_WIDTH - 192, height: 400 };

describe("normalizeRouteSilhouette", () => {
  it("projects and centers an east-west route inside the area", () => {
    const geometry: Position[] = [
      [106.8, -6.2],
      [106.9, -6.2],
    ];
    const points = normalizeRouteSilhouette(geometry, AREA);
    expect(points).toHaveLength(2);
    /* Wide route -> width fills the area */
    const spanX = Math.abs(points[1]!.x - points[0]!.x);
    expect(spanX).toBeCloseTo(AREA.width, 0);
    /* Vertically centered */
    const midY = (points[0]!.y + points[1]!.y) / 2;
    expect(midY).toBeCloseTo(AREA.y + AREA.height / 2, 0);
  });

  it("preserves aspect ratio for a square-ish route", () => {
    const geometry: Position[] = [
      [106.8, -6.2],
      [106.8, -6.15],
      [106.85, -6.15],
    ];
    const points = normalizeRouteSilhouette(geometry, AREA);
    const spanX = Math.abs(points[2]!.x - points[0]!.x);
    const spanY = Math.abs(points[2]!.y - points[0]!.y);
    /* The drawn box keeps the projected aspect ratio, never stretched */
    const projectedRatio = Math.abs((106.85 - 106.8) / (-6.15 + 6.2));
    const drawnRatio = spanX / spanY;
    expect(drawnRatio).toBeCloseTo(projectedRatio, 1);
    /* Bounded by the area */
    expect(spanX).toBeLessThanOrEqual(AREA.width + 0.5);
    expect(spanY).toBeLessThanOrEqual(AREA.height + 0.5);
  });

  it("handles a zero-width (vertical) route without clipping", () => {
    const geometry: Position[] = [
      [106.8, -6.2],
      [106.8, -6.3],
    ];
    const points = normalizeRouteSilhouette(geometry, AREA);
    expect(points).toHaveLength(2);
    const spanY = Math.abs(points[1]!.y - points[0]!.y);
    expect(spanY).toBeLessThanOrEqual(AREA.height + 0.5);
    expect(spanY).toBeGreaterThan(0);
  });

  it("handles a single-point degenerate geometry", () => {
    const points = normalizeRouteSilhouette([[106.8, -6.2]], AREA);
    expect(points).toEqual([]);
  });

  it("handles a closed loop without rotation surprises", () => {
    const geometry: Position[] = [
      [106.8, -6.2],
      [106.85, -6.2],
      [106.85, -6.25],
      [106.8, -6.25],
      [106.8, -6.2],
    ];
    const points = normalizeRouteSilhouette(geometry, AREA);
    expect(points).toHaveLength(5);
    /* The loop closes back near its start */
    expect(Math.abs(points[4]!.x - points[0]!.x)).toBeLessThan(0.5);
    expect(Math.abs(points[4]!.y - points[0]!.y)).toBeLessThan(0.5);
  });

  it("does not modify the source geometry", () => {
    const geometry: Position[] = [
      [106.8, -6.2],
      [106.9, -6.2],
    ];
    const snapshot = JSON.stringify(geometry);
    normalizeRouteSilhouette(geometry, AREA);
    expect(JSON.stringify(geometry)).toBe(snapshot);
  });
});

describe("simplifyForDisplay", () => {
  it("keeps short paths intact", () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
    expect(simplifyForDisplay(points, 400)).toHaveLength(10);
  });

  it("decimates long paths but keeps the last point", () => {
    const points = Array.from({ length: 5000 }, (_, i) => ({ x: i, y: 0 }));
    const simplified = simplifyForDisplay(points, 400);
    expect(simplified.length).toBeLessThanOrEqual(400);
    expect(simplified[simplified.length - 1]!.x).toBe(4999);
  });
});

describe("render card dimensions", () => {
  it("uses the exact 1080x1920 Story dimensions", () => {
    expect(CARD_WIDTH).toBe(1080);
    expect(CARD_HEIGHT).toBe(1920);
  });
});
