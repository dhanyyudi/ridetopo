import { test, expect, type Page, type Route } from "@playwright/test";
import { mockNominatim, mockTiles, outboundResponse } from "./helpers";

/**
 * Runs only in the `firefox-no-webgl` project. MapLibre cannot start without
 * WebGL — an old device, or a driver on the blocklist — and the app has to
 * stay usable rather than stall on a map that will never arrive.
 */

async function mockProviders(page: Page) {
  mockNominatim(page);
  await page.route("**/route", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(outboundResponse()),
    }),
  );
  mockTiles(page);
}

test.describe("no WebGL", () => {
  test("the composer still works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    await expect(page.getByText("Titik mulai")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rencanakan Rute", exact: true })).toBeVisible();
  });

  test("the map area says it is unavailable where the map would be", async ({ page }) => {
    /* Wide layout: compact hides the map behind the composer entirely. */
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page);
    await page.goto("/");

    await expect(page.getByText(/Peta tidak dapat ditampilkan/).first()).toBeVisible();
  });

  test("the map picker explains itself and points at search instead of stalling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Pilih di peta: Titik mulai/ }).click();

    /* Not the map canvas message about the route — the one that tells someone
       placing a pin what to do instead. */
    await expect(page.getByText(/Gunakan pencarian lokasi untuk menentukan titik/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Simpan" })).toBeDisabled();

    /* And the dialog must still be escapable. */
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(page.locator(".map-picker")).toHaveCount(0);
  });

  test("search still places a point without any map", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProviders(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Titik mulai", exact: true }).click();
    await page.getByLabel("Cari lokasi...").fill("Monas");
    await page.getByRole("button", { name: "Cari", exact: true }).click();
    await page.getByRole("option", { name: /Monumen Nasional/ }).click();

    await expect(page.getByText(/Monumen Nasional/).first()).toBeVisible();
  });
});
