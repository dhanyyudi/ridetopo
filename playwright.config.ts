/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/** Only the no-WebGL project runs the degradation journey. */
const DEGRADATION_SPEC = /degradation\.spec\.ts/;

/* Headless Firefox on a GPU-less runner ships without WebGL, so MapLibre
   never initialises and every map journey times out. Force the software
   backend on so the matrix exercises the real app. */
const FIREFOX_WEBGL_PREFS = {
  "webgl.disabled": false,
  "webgl.force-enabled": true,
  "gfx.webrender.all": true,
  "layers.acceleration.force-enabled": true,
};

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
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: { firefoxUserPrefs: FIREFOX_WEBGL_PREFS },
      },
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
