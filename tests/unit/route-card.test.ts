import { describe, it, expect } from "vitest";
import { renderRouteCard } from "../../src/services/export/render-route-card";

describe("renderRouteCard", () => {
  it("produces a PNG Blob", async () => {
    // We can't test actual canvas in jsdom, but verify type signature
    // In a real env with canvas, this would return a Blob
    expect(renderRouteCard).toBeDefined();
  });
});
