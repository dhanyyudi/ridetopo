/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/** Only the no-WebGL project runs the degradation journey. */
const DEGRADATION_SPEC = /degradation\.spec\.ts/;

/*
 * The offline journey needs a live service worker — it is what serves the
 * shell once the network is gone. Playwright only intercepts requests made
 * by a service worker in Chromium; in WebKit, a worker-controlled page
 * escapes every mock, so the spec would quietly call the real routing
 * service and assert against whatever it answered. Chromium and Firefox
 * cover the journey; Safari's own offline behaviour belongs to the device QA
 * that is still an open pre-production gate.
 */
const OFFLINE_SPEC = /offline-export\.spec\.ts/;

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
    /* The worker now claims the page as soon as it activates, and a request
       it re-issues comes from the worker rather than the page — which some
       engines will not route to a mock, leaving a test blind to a call that
       really happened. Tests that are not about caching keep the worker out
       of the way; offline-export.spec.ts opts back in, because there the
       worker is the thing under test. */
    serviceWorkers: "block",
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
      testIgnore: [DEGRADATION_SPEC, OFFLINE_SPEC],
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
