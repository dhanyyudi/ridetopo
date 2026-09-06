import { test, expect, type Page, type Route } from "@playwright/test";
import {
  mockNominatim,
  mockTiles,
  planJourney,
  outboundResponse,
} from "./helpers";

/**
 * Online plan -> save -> reload -> consent restore -> offline -> GPX
 * download -> PNG preview/download. While offline, no external provider
 * requests may occur.
 */

let offlineRequests: string[] = [];

async function mockOnlineProviders(page: Page) {
  mockNominatim(page);
  await page.route("**/route", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(outboundResponse()),
    }),
  );
  await page.route("**/trace_attributes", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        edges: [
          {
            begin_shape_index: 0,
            end_shape_index: 60,
            names: ["Jalan Sudirman"],
            road_class: "primary",
            surface: "asphalt",
            unpaved: false,
            use: "road",
            way_id: 1,
          },
        ],
      }),
    }),
  );
  mockTiles(page);
}

async function blockExternalProviders(page: Page) {
  await page.route("**/route", (route: Route) => {
    offlineRequests.push("route");
    return route.abort();
  });
  await page.route("**/trace_attributes", (route: Route) => {
    offlineRequests.push("trace");
    return route.abort();
  });
  await page.route("**/nominatim.openstreetmap.org/**", (route: Route) => {
    offlineRequests.push("nominatim");
    return route.abort();
  });
  await page.route("**/tiles.openfreemap.org/**", (route: Route) => {
    offlineRequests.push("tiles");
    return route.abort();
  });
}

test.beforeEach(() => {
  offlineRequests = [];
});

async function waitForDraftSaved(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const req = indexedDB.open("ridetopo-draft", 1);
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction("drafts", "readonly");
                const store = tx.objectStore("drafts");
                const get = store.get("active");
                get.onsuccess = () => resolve(get.result != null);
                get.onerror = () => resolve(false);
              };
              req.onerror = () => resolve(false);
            }),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
}

test("offline journey: plan, save, restore with consent, export offline", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });

  /* Phase 1: online plan and save */
  await mockOnlineProviders(page);
  await page.goto("/");
  await planJourney(page);
  await expect(page.getByText("Hasil rute")).toBeVisible();
  await waitForDraftSaved(page);

  /* Let the service worker activate and take control of the page */
  await page.evaluate(() => navigator.serviceWorker?.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByText("Rute terakhir tersimpan di perangkat ini")).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan rute terakhir" }).click();
  await expect(page.getByText("Hasil rute")).toBeVisible();
  await expect(page.getByText(/14,6 km/).first()).toBeVisible();
  await waitForDraftSaved(page);

  /* Phase 3: go offline — block all non-service-worker network traffic.
     Documents fall through so the controlling service worker can serve the
     shell from its precache. */
  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "document") return route.fallback();
    return route.abort();
  });
  await page.reload();

  /* Draft offered again offline */
  await expect(page.getByText("Rute terakhir tersimpan di perangkat ini")).toBeVisible();

  /* Real devices fire the offline event when connectivity drops; the
     simulated network block cannot always be detected otherwise (some
     engines let the service worker answer a probe with 200). Dispatch it
     after the app has mounted and registered its listener. */
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("Anda sedang offline")).toBeVisible();

  await page.getByRole("button", { name: "Lanjutkan rute terakhir" }).click();
  await expect(page.getByText("Hasil rute")).toBeVisible();
  await expect(page.getByText("Anda sedang offline")).toBeVisible();

  /* GPX download works offline */
  await blockExternalProviders(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh GPX" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ridetopo-.*\.gpx$/);

  /* PNG preview works offline */
  await page.getByRole("button", { name: "Bagikan gambar" }).click();
  await expect(page.getByText(/Gambar rute dapat memperlihatkan lokasi/)).toBeVisible();

  const pngDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh PNG" }).click();
  const pngDownload = await pngDownloadPromise;
  expect(pngDownload.suggestedFilename()).toMatch(/^ridetopo-rencana-.*\.png$/);

  /* Close the preview before continuing */
  await page.getByRole("button", { name: "Tutup" }).click();

  /* No external provider requests while offline */
  expect(offlineRequests).toEqual([]);

  /* Routing and search must be disabled offline */
  await page.getByRole("button", { name: "Ubah rute" }).click();
  await expect(page.getByRole("button", { name: "Rencanakan Rute", exact: true })).toBeDisabled();
});

test("draft deletion requires confirmation and clears the route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockOnlineProviders(page);
  await page.goto("/");
  await planJourney(page);

  await page.reload();
  await expect(page.getByText("Rute terakhir tersimpan di perangkat ini")).toBeVisible();

  /* First click only reveals the confirmation */
  await page.getByRole("button", { name: "Hapus rute" }).click();
  await expect(page.getByText(/Hapus rute yang tersimpan/)).toBeVisible();
  await page.getByRole("button", { name: "Hapus rute", exact: true }).click();

  /* Back to a fresh composer with empty A/B */
  await expect(page.getByText("Rencanakan rute", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Titik mulai", { exact: true })).toHaveValue("");
});
