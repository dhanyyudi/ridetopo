import { test, expect, type Page, type Route } from "@playwright/test";
import {
  mockNominatim,
  mockTiles,
  planJourney,
  outboundResponse,
  RETURN_SHAPE,
  ROUTE_LENGTH_KM,
  trackRouteCalls,
  type RouteCallLog,
} from "./helpers";

/**
 * Mocked road-review journeys: open review, select a segment from the list,
 * apply avoidance with reroute, remove exclusion, and verify the previous
 * route survives a failed reroute.
 */

const TRACE_RESPONSE = {
  edges: [
    {
      begin_shape_index: 0,
      end_shape_index: 30,
      names: ["Jalan Sudirman"],
      road_class: "primary",
      surface: "asphalt",
      unpaved: false,
      use: "road",
      way_id: 12345,
    },
    {
      begin_shape_index: 30,
      end_shape_index: 60,
      names: ["Jalan Thamrin"],
      road_class: "primary",
      surface: "asphalt",
      unpaved: false,
      use: "road",
      way_id: 12346,
    },
    {
      begin_shape_index: 60,
      end_shape_index: 90,
      names: [],
      road_class: "residential",
      surface: null,
      unpaved: false,
      use: null,
      way_id: 12347,
    },
    {
      begin_shape_index: 90,
      end_shape_index: 120,
      names: ["Jalan Kecil Raya"],
      road_class: "residential",
      surface: "gravel",
      unpaved: true,
      use: "road",
      way_id: 12348,
    },
  ],
};

let requestLog: RouteCallLog[] = [];
let failNextReroute = false;

async function mockProviders(
  page: Page,
  options: { segments?: number; segmentNames?: (i: number) => string[] } = {},
) {
  mockNominatim(page);
  await page.route("**/route", trackRouteCalls(requestLog, (body) => {
    if (failNextReroute) {
      failNextReroute = false;
      return { fail: true };
    }
    /* Reroutes with exclusions return a shifted corridor so avoidance
       validation succeeds. */
    if (Array.isArray(body.exclude_locations) && body.exclude_locations.length > 0) {
      return {
        trip: {
          status: 0,
          status_message: "Found route",
          units: "kilometers",
          legs: [
            {
              shape: RETURN_SHAPE,
              summary: { length: ROUTE_LENGTH_KM, time: 1900 },
            },
          ],
          summary: { length: ROUTE_LENGTH_KM, time: 1900 },
        },
      };
    }
    return outboundResponse();
  }));
  await page.route("**/trace_attributes", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        options.segments
          ? { edges: manySegments(options.segments, options.segmentNames) }
          : TRACE_RESPONSE,
      ),
    }),
  );
  mockTiles(page);
}

/**
 * A trace long enough that the list cannot fit on one screen.
 *
 * Each edge is a different street on purpose: consecutive edges of the same
 * road collapse into one row, so identical names would produce a list of one
 * and quietly retire the scrolling this file is here to check.
 */
function manySegments(count: number, name: (i: number) => string[] = (i) => [`Jalan ${i}`]) {
  return Array.from({ length: count }, (_, i) => ({
    begin_shape_index: i,
    end_shape_index: i + 1,
    names: name(i),
    road_class: "residential",
    surface: "paved_smooth",
    unpaved: false,
    use: "road",
    way_id: 1000 + i,
  }));
}

test.beforeEach(() => {
  requestLog = [];
  failNextReroute = false;
});

test.describe("road review", () => {
  test("a long segment list scrolls inside the panel, not the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page, { segments: 220 });
    await page.goto("/");
    await planJourney(page);
    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.locator(".segment-item").first()).toBeVisible();

    /* The panel owns the scrollbar. If it does not, the whole layout grows and
       the map is dragged down the page with it. */
    const scroller = page.locator(".review-scroll");
    const metrics = await scroller.evaluate((el) => ({
      scrollable: el.scrollHeight - el.clientHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollable).toBeGreaterThan(0);
    expect(metrics.clientHeight).toBeLessThanOrEqual(900);

    const page_ = await page.evaluate(() => ({
      overflow: document.documentElement.scrollHeight - window.innerHeight,
      mapHeight: document.querySelector(".app-map")?.getBoundingClientRect().height ?? 0,
    }));
    expect(page_.overflow).toBeLessThanOrEqual(1);
    expect(page_.mapHeight).toBeLessThanOrEqual(900);
  });

  test("opens review lazily, selects a segment from the list, and applies avoidance", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);

    /* No trace request before entering review */
    expect(requestLog).toHaveLength(1);

    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.getByRole("heading", { name: "Tinjau ruas jalan" })).toBeVisible();

    /* Segment list shows real Valhalla edges */
    await expect(page.getByText("Jalan Sudirman")).toBeVisible();
    await expect(page.getByText("Ruas tanpa nama")).toBeVisible();

    /* Select a segment and see its metadata */
    await page.getByText("Jalan Sudirman").click();
    await expect(page.locator(".segment-detail-panel")).toContainText("Jalan utama penghubung kota");
    await expect(page.locator(".segment-detail-panel")).toContainText("Aspal");

    /* Apply avoidance -> reroute with exclude_locations */
    const before = requestLog.length;
    await page.getByRole("button", { name: "Hindari ruas ini" }).click();

    await expect
      .poll(async () => requestLog.length, { timeout: 8000 })
      .toBeGreaterThan(before);

    const reroute = requestLog[requestLog.length - 1]!;
    expect(reroute.excludeLocations?.length).toBeGreaterThan(0);

    /* Exclusion appears in the removable list */
    await expect(page.getByText("Jalan yang dihindari")).toBeVisible();

    /* Removing the exclusion triggers another reroute */
    const beforeRemove = requestLog.length;
    await page.getByRole("button", { name: /Hapus hindaran/ }).click();
    await expect
      .poll(async () => requestLog.length, { timeout: 8000 })
      .toBeGreaterThan(beforeRemove);

    /* Exiting review restores export controls */
    await page.getByRole("button", { name: "Selesai tinjau" }).click();
    await page.getByRole("button", { name: "Ekspor rute" }).click();
    await expect(page.getByRole("button", { name: "Unduh GPX" })).toBeVisible();
  });

  test("one street is one row, however many edges the router split it into", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    /* What Valhalla actually returns: a street arrives as many graph edges. */
    await mockProviders(page, { segments: 40, segmentNames: () => ["Jalan Panjang"] });
    await page.goto("/");
    await planJourney(page);
    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.locator(".segment-item").first()).toBeVisible();

    /* Forty edges, one road, one row — otherwise avoiding this street means
       scrolling past thirty-nine copies of its name to find the end of it. */
    await expect(page.locator(".segment-item")).toHaveCount(1);
    await expect(page.locator(".segment-item").first()).toContainText("Jalan Panjang");
  });

  test("supports corridor extension with two boundaries", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);

    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.getByText("Jalan Sudirman")).toBeVisible();

    /* Select the first edge then extend it into a corridor */
    await page.getByText("Jalan Sudirman").click();
    await page.getByRole("button", { name: "Perpanjang area" }).click();
    await expect(page.locator(".segment-detail-panel")).toContainText("batas awal");

    /* Mark start boundary then end boundary on two edges */
    await page.getByText("Jalan Sudirman").click();
    await page.getByText("Ruas tanpa nama").click();

    await page.getByRole("button", { name: "Terapkan" }).click();

    await expect
      .poll(async () => requestLog.length, { timeout: 8000 })
      .toBeGreaterThan(1);

    const reroute = requestLog[requestLog.length - 1]!;
    /* Corridor of 3 edges -> multiple midpoints */
    expect(reroute.excludeLocations!.length).toBeGreaterThanOrEqual(2);
  });

  test("a failed avoidance reroute keeps the previous route and exclusions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);

    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.getByText("Jalan Sudirman")).toBeVisible();

    await page.getByText("Jalan Sudirman").click();
    failNextReroute = true;
    await page.getByRole("button", { name: "Hindari ruas ini" }).click();

    /* Reroute failed: error copy shown in review */
    await expect(page.getByText(/Gagal merencanakan rute/)).toBeVisible();

    /* Failed transaction rolled back: no committed exclusions */
    await expect(page.getByText("Jalan yang dihindari")).not.toBeVisible();

    /* Exit review: previous route and export remain available */
    await page.getByRole("button", { name: "Selesai tinjau" }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();
    await page.getByRole("button", { name: "Ekspor rute" }).click();
    await expect(page.getByRole("button", { name: "Unduh GPX" })).toBeVisible();
  });

  test("metadata failure degrades without forcing back to composer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);

    /* Trace endpoint fails */
    await page.unroute("**/trace_attributes");
    await page.route("**/trace_attributes", (route: Route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) }),
    );

    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.getByText(/Data jalan belum tersedia/)).toBeVisible();

    /* Route remains and exit is possible */
    await page.getByRole("button", { name: "Selesai tinjau" }).click();
    await expect(page.getByText("Hasil rute")).toBeVisible();
  });
});
