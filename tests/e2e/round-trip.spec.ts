import { test, expect, type Page, type Route } from "@playwright/test";
import {
  mockNominatim,
  mockTiles,
  fillJourney,
  outboundResponse,
  returnResponseWithAlternates,
  returnResponseLimited,
  trackRouteCalls,
  type RouteCallLog,
} from "./helpers";

/**
 * Mocked round-trip journeys exercising both return modes and the honest
 * limited-alternative fallback.
 */

let calls: RouteCallLog[] = [];
let limitedReturn = false;

async function mockProviders(page: Page) {
  mockNominatim(page);
  await page.route("**/route", trackRouteCalls(calls, (body) => {
    const isPenalizedReturn = body.linear_cost_factors !== undefined;
    if (!isPenalizedReturn) {
      return outboundResponse();
    }
    if (limitedReturn) {
      return returnResponseLimited();
    }
    return returnResponseWithAlternates();
  }));
  mockTiles(page);
}

test.beforeEach(() => {
  calls = [];
  limitedReturn = false;
});

test.describe("round trip", () => {
  test("Lewat jalan lain sends two calls with the penalty shape and returns distinct legs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);

    /* Enable round trip — Lewat jalan lain is the default */
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("radio", { name: "Lewat jalan lain" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/RideTopo mencari jalan pulang yang berbeda/)).toBeVisible();

    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();

    /* Two provider calls: outbound then penalized return */
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const returnCall = calls[calls.length - 1]!;
    expect(returnCall.linearCostFactor).toBe(5);
    expect(returnCall.hasShape).toBe(true);
    expect(returnCall.alternates).toBe(2);

    /* Combined distance: 14.6 + 15.1 = 29.7 km */
    await expect(page.getByText(/29,7 km/)).toBeVisible();

    /* No limited-return warning when alternates exist */
    await expect(page.getByText(/Pilihan jalan pulang alternatif terbatas/)).not.toBeVisible();
  });

  test("Pulang tercepat sends a plain B->A request without penalty", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);

    await page.getByRole("checkbox").check();
    await page.getByRole("radio", { name: "Pulang tercepat" }).click();

    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();

    expect(calls.length).toBeGreaterThanOrEqual(2);
    const returnCall = calls[calls.length - 1]!;
    expect(returnCall.linearCostFactor).toBeUndefined();
    expect(returnCall.hasShape).toBe(false);
    expect(returnCall.alternates).toBeUndefined();
  });

  test("shows the honest limited-return warning when alternatives are scarce", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    limitedReturn = true;
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();

    await expect(page.getByText(/Pilihan jalan pulang alternatif terbatas/)).toBeVisible();
  });

  test("a failed round-trip recalculation keeps the previous route", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();

    /* Next outbound call succeeds but the penalized return fails */
    let phase = 0;
    await page.unroute("**/route");
    await page.route("**/route", async (route: Route) => {
      phase++;
      if (phase === 1) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(outboundResponse()) });
        return;
      }
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) });
    });

    /* Change preference to trigger a reroute */
    await page.getByRole("button", { name: "Ubah rute" }).click();
    await page.getByRole("radio", { name: "Commuter Bike" }).click();
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();

    await expect(page.getByText(/Gagal merencanakan rute|Tidak ditemukan rute pulang/)).toBeVisible();
    await page.getByRole("button", { name: "Lihat rute sebelumnya" }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();
    await page.getByRole("button", { name: "Ekspor rute" }).click();
    await expect(page.getByRole("button", { name: "Unduh GPX" })).toBeVisible();
  });
});
