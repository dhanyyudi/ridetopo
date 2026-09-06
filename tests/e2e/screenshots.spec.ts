import { test, expect, type Page, type Route } from "@playwright/test";
import { mockNominatim, mockTiles, planJourney, outboundResponse } from "./helpers";

/**
 * Public evidence screenshots against the production build.
 * Outputs to audit/screenshots/.
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
  ],
};

async function mockProviders(page: Page) {
  mockNominatim(page);
  await page.route("**/route", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(outboundResponse()) }),
  );
  await page.route("**/trace_attributes", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TRACE_RESPONSE) }),
  );
  mockTiles(page);
}

/** The highlight is drawn by MapLibre, so give it a frame before capturing. */
async function waitForSelectionOnMap(page: Page) {
  await expect
    .poll(async () =>
      Number((await page.locator(".map-host").getAttribute("data-selection-points")) ?? 0),
    )
    .toBeGreaterThan(1);
  await page.waitForTimeout(400);
}

test.describe("evidence screenshots", () => {
  test("composer 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await expect(page.getByText("Titik mulai")).toBeVisible();
    await page.screenshot({ path: "audit/screenshots/composer-390.png" });
  });

  test("composer 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockProviders(page);
    await page.goto("/");
    await expect(page.getByText("Titik mulai")).toBeVisible();
    await page.screenshot({ path: "audit/screenshots/composer-1440.png" });
  });

  test("result 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: "audit/screenshots/result-390.png" });
  });

  test("result 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: "audit/screenshots/result-1440.png" });
  });

  test("road review 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);
    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.getByText("Jalan Sudirman").first()).toBeVisible();
    await page.getByText("Jalan Sudirman").first().click();
    await waitForSelectionOnMap(page);
    await page.screenshot({ path: "audit/screenshots/road-review-390.png" });
  });

  test("road review 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);
    await page.getByRole("button", { name: "Tinjau ruas jalan" }).click();
    await expect(page.getByText("Jalan Sudirman").first()).toBeVisible();
    await page.getByText("Jalan Sudirman").first().click();
    await waitForSelectionOnMap(page);
    await page.screenshot({ path: "audit/screenshots/road-review-1440.png" });
  });

  test("image preview 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");
    await planJourney(page);
    await page.getByRole("button", { name: "Ekspor rute" }).click();
    await page.getByRole("button", { name: "Bagikan gambar" }).click();
    await expect(page.getByText(/Gambar rute dapat memperlihatkan lokasi/)).toBeVisible();
    await page.screenshot({ path: "audit/screenshots/image-preview-390.png" });
  });
});
