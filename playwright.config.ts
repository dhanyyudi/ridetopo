/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/** Only the no-WebGL project runs the degradation journey. */
const DEGRADATION_SPEC = /degradation\.spec\.ts/;

/*
 * Headless Firefox on GitHub's GPU-less runner cannot give MapLibre a WebGL
 * context, and forcing the software backend through user prefs does not
 * change that — every map journey still times out waiting for a map that
 * never loads. So the `firefox` project is a local and pre-release gate, not
 * a CI gate: `npm run test:e2e:ci` runs the projects the runner can actually
 * execute, and `npm run test:e2e` runs the whole matrix here.
 */

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: DEGRADATION_SPEC,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: DEGRADATION_SPEC,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: DEGRADATION_SPEC,
      use: { ...devices["Desktop Safari"] },
    },
    {
      /* A browser that cannot render WebGL at all — an old device or a
         driver on the blocklist. The app must degrade, not stall. */
      name: "firefox-no-webgl",
      testMatch: DEGRADATION_SPEC,
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: { firefoxUserPrefs: { "webgl.disabled": true } },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !isCI,
  },
});
