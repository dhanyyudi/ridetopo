import { expect, type Page, type Route } from "@playwright/test";

/**
 * Shared mocked provider fixtures with realistic ~14.6 km east-west
 * geometry near Jakarta (Monas corridor).
 */

export const OUTBOUND_SHAPE =
  "ni|wJ_{ewjE?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA?wcA";

export const RETURN_SHAPE =
  "fpswJ_ug_kE?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA";

export const ALT1_SHAPE =
  "~vjwJ_ug_kE?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA";

export const ALT2_SHAPE =
  "vbexJ_ug_kE?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA?vcA";

export const ROUTE_LENGTH_KM = 14.6;
export const ROUTE_TIME_SEC = 1900;

/**
 * Valhalla samples elevation every 30 m, so the array length has to follow the
 * leg length. A short array cannot be mapped to the route and is discarded.
 */
export function elevationArray(lengthMeters: number): number[] {
  const count = Math.floor(lengthMeters / 30) + 1;
  return Array.from({ length: count }, (_, i) => 5 + Math.round(Math.sin(i / 5) * 8));
}

export function outboundResponse() {
  return {
    trip: {
      status: 0,
      status_message: "Found route",
      units: "kilometers",
      legs: [
        {
          shape: OUTBOUND_SHAPE,
          summary: { length: ROUTE_LENGTH_KM, time: ROUTE_TIME_SEC },
          elevation: elevationArray(ROUTE_LENGTH_KM * 1000),
        },
      ],
      summary: { length: ROUTE_LENGTH_KM, time: ROUTE_TIME_SEC },
    },
  };
}

export const LEG_A_LENGTH_KM = 8.4;
export const LEG_B_LENGTH_KM = 6.2;
export const MULTI_LEG_LENGTH_KM = LEG_A_LENGTH_KM + LEG_B_LENGTH_KM;

/**
 * What Valhalla actually returns for A -> waypoint -> B: one leg per
 * consecutive location pair. Totals must come from every leg, not the first.
 */
export function waypointResponse() {
  return {
    trip: {
      status: 0,
      status_message: "Found route",
      units: "kilometers",
      legs: [
        {
          shape: OUTBOUND_SHAPE,
          summary: { length: LEG_A_LENGTH_KM, time: 1100 },
          elevation: elevationArray(LEG_A_LENGTH_KM * 1000),
        },
        {
          shape: RETURN_SHAPE,
          summary: { length: LEG_B_LENGTH_KM, time: 800 },
          elevation: elevationArray(LEG_B_LENGTH_KM * 1000),
        },
      ],
      summary: { length: MULTI_LEG_LENGTH_KM, time: 1900 },
    },
  };
}

/**
 * Alternates arrive at the top level of the response, each wrapped in its own
 * `trip` object — the shape a live Valhalla server returns.
 */
export function returnResponseWithAlternates() {
  return {
    trip: {
      status: 0,
      status_message: "Found route with alternatives",
      units: "kilometers",
      legs: [
        {
          shape: RETURN_SHAPE,
          summary: { length: 15.1, time: 2050 },
        },
      ],
      summary: { length: 15.1, time: 2050 },
    },
    alternates: [
      {
        trip: {
          status: 0,
          legs: [{ shape: ALT1_SHAPE, summary: { length: 16.4, time: 2200 } }],
          summary: { length: 16.4, time: 2200 },
        },
      },
      {
        trip: {
          status: 0,
          legs: [{ shape: ALT2_SHAPE, summary: { length: 17.9, time: 2400 } }],
          summary: { length: 17.9, time: 2400 },
        },
      },
    ],
  };
}

export function returnResponseLimited() {
  return {
    trip: {
      status: 0,
      status_message: "Found route",
      units: "kilometers",
      legs: [
        {
          shape: OUTBOUND_SHAPE,
          summary: { length: ROUTE_LENGTH_KM, time: ROUTE_TIME_SEC },
        },
      ],
      summary: { length: ROUTE_LENGTH_KM, time: ROUTE_TIME_SEC },
    },
  };
}

export interface RouteCallLog {
  linearCostFactor?: number;
  hasShape: boolean;
  alternates?: number;
  locations: number[][];
  excludeLocations?: unknown[];
}

export function trackRouteCalls(
  log: RouteCallLog[],
  handler: (body: Record<string, unknown>) => Record<string, unknown> | { fail: true },
) {
  return async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    log.push({
      linearCostFactor: body.linear_cost_factors?.[0]?.factor,
      hasShape: Boolean(body.linear_cost_factors?.[0]?.shape),
      alternates: body.alternates,
      locations: body.locations ?? [],
      excludeLocations: body.exclude_locations,
    });
    const result = handler(body);
    if ("fail" in result && result.fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  };
}

export function mockTiles(page: Page) {
  /* Matched by path, not by host: a spec may point the basemap somewhere
     else entirely, and the mock has to follow it there. */
  void page.route(/\/(tiles|data)\/.*\.(pbf|mvt|png|webp|json)(\?|$)/, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/octet-stream", body: "" }),
  );
  void page.route("**/tiles.openfreemap.org/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/octet-stream", body: "" }),
  );
  void page.route("**/styles/**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    }),
  );
}

export function mockNominatim(page: Page, results = NOMINATIM_DEFAULT) {
  void page.route("**/search?**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results),
    }),
  );
}

export const NOMINATIM_DEFAULT = [
  {
    place_id: 101,
    display_name: "Monumen Nasional, Jakarta Pusat, Jakarta, Indonesia",
    lat: "-6.1754",
    lon: "106.8272",
    category: "tourism",
  },
];

export async function fillJourney(page: Page) {
  /* Search lives in the row itself now — no dialog to open first. */
  await page.getByLabel("Titik mulai", { exact: true }).fill("Monas");
  await page
    .locator(".location-field", { hasText: "Titik mulai" })
    .getByRole("button", { name: "Cari", exact: true })
    .click();
  await page.getByRole("option", { name: /Monumen Nasional/ }).click();

  await page.getByRole("button", { name: /Pilih di peta: Tujuan/ }).click();

  /* Wide layouts place the point on the map beside the panel; compact ones
     still open the full-screen picker. */
  const inline = page.locator(".inline-pick");
  if (await inline.isVisible().catch(() => false)) {
    await placeInline(page);
    return;
  }

  await placeInPickerDialog(page);
}

async function placeInline(page: Page) {
  const map = page.locator(".app-map");
  const box = (await map.boundingBox())!;
  const save = page.getByRole("button", { name: "Simpan" });

  for (let attempt = 0; attempt < 5 && !(await save.isEnabled()); attempt++) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
  }
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.locator(".inline-pick")).toHaveCount(0);
}

async function placeInPickerDialog(page: Page) {
  await page.waitForSelector(".map-picker-canvas[data-map-ready=true]");

  const saveButton = page.getByRole("button", { name: "Simpan" });
  const canvas = page.locator(".map-picker-canvas");

  /* Tap the map until the save action enables (retries for slow WebGL) */
  let enabled = false;
  for (let attempt = 0; attempt < 5 && !enabled; attempt++) {
    await canvas.click({ position: { x: 200, y: 200 } });
    try {
      await expect(saveButton).toBeEnabled({ timeout: 3_000 });
      enabled = true;
    } catch {
      /* retry the map tap */
    }
  }
  expect(enabled).toBe(true);
  /* Dispatch the click directly — deterministic regardless of viewport
     position during map/layout settling. */
  await saveButton.evaluate((el) => (el as HTMLButtonElement).click());

  /* The picker must close after save */
  await page.waitForSelector(".map-picker", { state: "detached", timeout: 10_000 });
}

export async function planJourney(page: Page) {
  await fillJourney(page);
  await page.getByRole("button", { name: "Rencanakan Rute", exact: true }).click();
  await page.waitForSelector("text=Hasil rute");
}
