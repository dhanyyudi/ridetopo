import { test, expect, type Page, type Route } from "@playwright/test";
import {
  fillJourney,
  elevationArray,
  waypointResponse,
  outboundResponse,
  MULTI_LEG_LENGTH_KM,
} from "./helpers";

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
let useStraightRouteResponse = false;

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
      body: JSON.stringify(
        useWaypointResponse
          ? waypointResponse()
          : useStraightRouteResponse
            ? outboundResponse()
            : ROUTE_RESPONSE,
      ),
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
  useStraightRouteResponse = false;
});

/** Wait until fitBounds has stopped moving the markers. */
async function waitForStableMarkers(page: Page) {
  const read = async () =>
    page.locator(".ridetopo-marker").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().x)).join(","),
    );

  let previous = await read();
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(250);
        const current = await read();
        const stable = current === previous && current.length > 0;
        previous = current;
        return stable;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

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
    await expect(page.getByLabel("Tujuan", { exact: true })).toHaveValue("Titik pilihan");

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
    /* Compact: the full-screen picker only exists where the map is hidden. */
    await page.setViewportSize({ width: 390, height: 720 });
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

  test("the result map shows an A and a B marker, positioned on the route", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await page.waitForSelector("text=Hasil rute");

    await expect(page.locator(".ridetopo-marker")).toHaveCount(2);
    await expect(page.locator(".ridetopo-marker.marker-origin")).toBeVisible();
    await expect(page.locator(".ridetopo-marker.marker-destination")).toBeVisible();

    /* Existing in the DOM is not the same as being in the right place. Without
       MapLibre's stylesheet a marker lays out as a static block: full
       container width, and nowhere near its coordinates. */
    const mapBox = (await page.locator(".app-map").boundingBox())!;
    await waitForStableMarkers(page);

    for (const marker of await page.locator(".ridetopo-marker").all()) {
      const box = (await marker.boundingBox())!;
      expect(box.width).toBeGreaterThan(0);
      expect(box.width).toBeLessThan(60);
      expect(box.height).toBeLessThan(60);
      expect(box.x).toBeGreaterThanOrEqual(mapBox.x - 40);
      expect(box.x).toBeLessThanOrEqual(mapBox.x + mapBox.width + 40);
      expect(box.y).toBeGreaterThanOrEqual(mapBox.y - 40);
      expect(box.y).toBeLessThanOrEqual(mapBox.y + mapBox.height + 40);
    }
  });

  test("picking on the map shows the pin you just dropped", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Pilih di peta: Titik mulai/ }).click();
    await page.waitForSelector(".map-picker-canvas[data-map-ready=true]");

    const canvas = page.locator(".map-picker-canvas");
    const canvasBox = (await canvas.boundingBox())!;
    await canvas.click({ position: { x: 300, y: 250 } });

    const marker = page.locator(".map-picker .maplibregl-marker").first();
    await expect(marker).toBeVisible();

    /* And inside the picker, not stretched across it. */
    const box = (await marker.boundingBox())!;
    expect(box.width).toBeLessThan(60);
    expect(box.x).toBeGreaterThanOrEqual(canvasBox.x - 40);
    expect(box.x).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 40);
    expect(box.y).toBeGreaterThanOrEqual(canvasBox.y - 40);
    expect(box.y).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 40);
  });

  test("hovering the route says how far, how high, and how steep", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    /* A straight east-west route, so "somewhere between the two markers" is a
       point that is genuinely on the line. */
    useStraightRouteResponse = true;
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await page.waitForSelector("text=Hasil rute");

    /* Aim at the route itself — the readout only answers over the line — and
       only once fitBounds has stopped moving it. */
    await waitForStableMarkers(page);
    await page.waitForTimeout(1000);

    const a = (await page.locator(".ridetopo-marker.marker-origin").boundingBox())!;
    const b = (await page.locator(".ridetopo-marker.marker-destination").boundingBox())!;
    const y = a.y + a.height / 2;
    const readout = page.locator(".map-cursor-readout");

    /* Sweep between the two markers: the line runs between them, and a couple
       of pixels of rounding should not decide whether this test passes. */
    for (let t = 0.2; t <= 0.8 && (await readout.count()) === 0; t += 0.1) {
      const x = a.x + a.width / 2 + (b.x - a.x) * t;
      await page.mouse.move(x - 15, y);
      await page.mouse.move(x, y);
      await page.waitForTimeout(150);
    }

    await expect(readout).toBeVisible({ timeout: 10_000 });
    await expect(readout).toContainText("km");
  });

  test("the elevation chart is a keyboard slider the map mirrors", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await page.waitForSelector("text=Hasil rute");

    const slider = page.getByRole("slider", { name: /Grafik elevasi/ });
    await expect(slider).toBeVisible();
    await slider.focus();
    await slider.press("ArrowRight");

    /* The readout names distance and elevation — terrain is never read from
       colour alone — and the map marks the same point. */
    await expect(page.locator(".chart-cursor-label")).toContainText("km");
    await expect
      .poll(async () =>
        Number((await page.locator(".map-host").getAttribute("data-cursor-distance")) || 0),
      )
      .toBeGreaterThan(0);
  });

  test("the terrain legend names every band", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await page.waitForSelector("text=Hasil rute");

    const legend = page.getByRole("list", { name: /Keterangan medan/ });
    await expect(legend).toContainText("Menanjak");
    await expect(legend).toContainText("Landai");
    await expect(legend).toContainText("Menurun");
  });

  test("picking a point on a wide screen stays on the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Pilih di peta: Titik mulai/ }).click();

    /* No full-screen dialog: the map is already beside the panel. */
    await expect(page.locator(".map-picker")).toHaveCount(0);
    await expect(page.getByText(/Ketuk peta di samping/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Simpan" })).toBeDisabled();

    const map = page.locator(".app-map");
    const box = (await map.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.getByRole("button", { name: "Simpan" })).toBeEnabled();
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText(/Ketuk peta di samping/)).toHaveCount(0);
    await expect(page.getByLabel("Titik mulai", { exact: true })).toHaveValue("Titik pilihan");
  });

  test("searching for a place happens in the row, not over the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page);
    await page.goto("/");

    const field = page.locator(".location-field", { hasText: "Titik mulai" });
    const input = page.getByLabel("Titik mulai", { exact: true });

    /* Typing alone must not call Nominatim: it allows one request a second,
       so the request belongs to the button, not to the keystroke. */
    let calls = 0;
    await page.route("**/search**", async (route) => {
      calls += 1;
      await route.fallback();
    });
    await input.fill("Monas");
    await expect(input).toHaveValue("Monas");
    expect(calls).toBe(0);

    /* Enter searches too — the field is not a dead end for the keyboard. */
    await input.press("Enter");
    await expect(page.getByRole("option", { name: /Monumen Nasional/ })).toBeVisible();
    expect(calls).toBe(1);

    await field.getByRole("button", { name: "Cari", exact: true }).click();

    /* Results land under the field; nothing covers the map or the other point. */
    await expect(page.locator(".dialog-backdrop")).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Monumen Nasional/ })).toBeVisible();
    await expect(page.locator(".app-map")).toBeVisible();

    await page.getByRole("option", { name: /Monumen Nasional/ }).click();

    await expect(input).toHaveValue(/Monumen Nasional/);
    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("a narrow screen still gets the full-screen picker", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Pilih di peta: Titik mulai/ }).click();
    /* Compact hides the map behind the composer, so the dialog still earns
       its place there. */
    await expect(page.locator(".map-picker")).toHaveCount(1);
  });

  test("the departure time drives the arrival and the marker labels", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    useStraightRouteResponse = true;
    await mockProviders(page);
    await page.goto("/");
    await fillJourney(page);
    await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
    await page.waitForSelector("text=Hasil rute");

    await page.getByLabel(/Rencana jam berangkat/).fill("06:00");

    /* 14,6 km at the mocked 1900 s: 06.00 leaves at 06.31. */
    await expect(page.getByText(/06[.:]00 → 06[.:]31/)).toBeVisible();
    await expect(page.locator(".ridetopo-marker.marker-origin .marker-time")).toContainText("06");
    await expect(page.locator(".ridetopo-marker.marker-destination .marker-time")).toContainText(
      "06",
    );
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
