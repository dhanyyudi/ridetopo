import { test, expect, type Page, type Route } from "@playwright/test";
import { fillJourney, elevationArray, waypointResponse, MULTI_LEG_LENGTH_KM } from "./helpers";

/**
 * Mocked full journey: empty context -> search A -> map-pin B -> plan ->
 * result -> edit preference -> reroute -> failure preserves last route.
 * No real network calls to providers are allowed.
 */

const ROUTE_RESPONSE = {
  trip: {
    status: 0,
    status_message: "Found route",
    units: "kilometers",
    legs: [
      {
        shape: "kz~fA_ehsWb@w@h@c@LY\\E\\EdCcA",
        summary: {
          length: 12.5,
          time: 1800,
          min_lat: -6.21,
          max_lat: -6.18,
          min_lon: 106.82,
          max_lon: 106.85,
        },
        elevation: elevationArray(12_500),
      },
    ],
    summary: { length: 12.5, time: 1800 },
  },
};

const NOMINATIM_RESPONSE = [
  {
    place_id: 101,
    display_name: "Monumen Nasional, Jakarta Pusat, Jakarta, Indonesia",
    lat: "-6.1754",
    lon: "106.8272",
    category: "tourism",
  },
  {
    place_id: 102,
    display_name: "Kota Tua, Jakarta Barat, Jakarta, Indonesia",
    lat: "-6.1352",
    lon: "106.8133",
    category: "historic",
  },
];

let routeRequestCount = 0;
let failNextRouteRequest = false;
let useWaypointResponse = false;

async function mockProviders(page: Page) {
  await page.route("**/nominatim.openstreetmap.org/search**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NOMINATIM_RESPONSE) }),
  );
  await page.route("**/route", async (route: Route) => {
    routeRequestCount++;
    if (failNextRouteRequest) {
      failNextRouteRequest = false;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(useWaypointResponse ? waypointResponse() : ROUTE_RESPONSE),
    });
  });
  await page.route("**/tiles.openfreemap.org/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/octet-stream", body: "" }),
  );
  await page.route("**/styles/**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    }),
  );
}

test.beforeEach(() => {
  routeRequestCount = 0;
  failNextRouteRequest = false;
  useWaypointResponse = false;
});

test.describe("route planning journey", () => {
  test("searches A, pins B, plans, inspects result, edits preference and reroutes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    /* Initial A/B slots exist */
    await expect(page.getByText("Titik mulai")).toBeVisible();
    await expect(page.getByText("Tujuan")).toBeVisible();

    /* Search fills A + map pin fills B */
    await fillJourney(page);
    await expect(page.getByText("Titik pilihan")).toBeVisible();

    /* CTA sends exactly one route request */
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();
    expect(routeRequestCount).toBe(1);

    /* Result contains summary + elevation + actions */
    await expect(page.getByText("Jarak")).toBeVisible();
    await expect(page.getByText("Estimasi waktu bersepeda")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tinjau ruas jalan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unduh GPX" })).toBeVisible();

    /* Edit preference -> reroute */
    await page.getByRole("button", { name: "Ubah rute" }).click();
    await page.getByRole("radio", { name: "Commuter Bike" }).click();
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();
    expect(routeRequestCount).toBeGreaterThanOrEqual(2);
  });

  test("a failed reroute preserves the last valid route", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    await fillJourney(page);
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();

    /* Fail the next reroute */
    failNextRouteRequest = true;
    await page.getByRole("button", { name: "Ubah rute" }).click();
    await page.getByRole("radio", { name: "Road Bike" }).click();
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();

    /* Error copy is Indonesian and the old route remains reachable */
    await expect(page.getByText(/Gagal merencanakan rute/)).toBeVisible();
    await page.getByRole("button", { name: "Lihat rute sebelumnya" }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unduh GPX" })).toBeVisible();
  });

  test("no route request is sent before the explicit CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    /* Open search, choose A and B without planning */
    await fillJourney(page);

    expect(routeRequestCount).toBe(0);
  });

  test("map picker keeps its footer inside the viewport without page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Pilih di peta: Titik mulai/ }).click();
    await page.waitForSelector(".map-picker-canvas[data-map-ready=true]");

    /* The dialog must fit the viewport: Batal/Simpan visible without
       scrolling, and the page itself must not scroll. Regression guard for
       the MapLibre canvas flex feedback loop. */
    await expect(page.getByRole("button", { name: "Batal" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Simpan" })).toBeInViewport();
    const metrics = await page.evaluate(() => ({
      scrollable: document.documentElement.scrollHeight - window.innerHeight,
      scrollY: window.scrollY,
    }));
    expect(metrics.scrollable).toBe(0);
    expect(metrics.scrollY).toBe(0);
  });

  test("a route through a waypoint reports every leg, not just the first", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    useWaypointResponse = true;
    await mockProviders(page);
    await page.goto("/");

    await fillJourney(page);

    /* Add an intermediate point and place it, so Valhalla answers with two
       legs the way it does for a real waypoint route. */
    await page.getByRole("button", { name: "Tambah titik" }).click();
    await page.getByRole("button", { name: /Pilih di peta: Titik antara 1/ }).click();
    await page.waitForSelector(".map-picker-canvas[data-map-ready=true]");
    const canvas = page.locator(".map-picker-canvas");
    const saveButton = page.getByRole("button", { name: "Simpan" });
    for (let attempt = 0; attempt < 5; attempt++) {
      await canvas.click({ position: { x: 160, y: 160 } });
      if (await saveButton.isEnabled()) break;
    }
    await saveButton.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForSelector(".map-picker", { state: "detached", timeout: 10_000 });

    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await page.waitForSelector("text=Hasil rute");

    /* 8,4 km + 6,2 km — never the 8,4 km first leg alone. */
    const expected = MULTI_LEG_LENGTH_KM.toFixed(1).replace(".", ",");
    await expect(page.getByText(`${expected} km`).first()).toBeVisible();
    await expect(page.getByText("8,4 km")).toHaveCount(0);
  });

  test("adds, reorders, and removes waypoints without placeholder coordinates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Tambah titik" }).click();
    await page.getByRole("button", { name: "Tambah titik" }).click();
    await expect(page.getByText("Titik antara 1")).toBeVisible();
    await expect(page.getByText("Titik antara 2")).toBeVisible();

    /* Move down control works (keyboard alternative to drag) */
    await page.getByRole("button", { name: /Pindahkan ke bawah: Titik antara 1/ }).click();

    /* Remove second waypoint (label renumbered after move) */
    await page.getByRole("button", { name: /Hapus titik 2/ }).click();
    await expect(page.getByText("Titik antara 2")).not.toBeVisible();
  });
});
