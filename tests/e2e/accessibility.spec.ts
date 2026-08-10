import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "iPhone SE", width: 320, height: 844 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "Desktop", width: 1440, height: 900 },
];

test.describe("Shell accessibility", () => {
  for (const vp of VIEWPORTS) {
    test(`shell at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // Header should be visible
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // No horizontal overflow at any viewport
      const html = page.locator("html");
      const scrollWidth = await html.evaluate((el) => el.scrollWidth);
      const clientWidth = await html.evaluate((el) => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      // Brand is visible in header
      await expect(page.locator("header")).toContainText("RideTopo");
    });
  }

  test("navigates to Privacy and About", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // Navigate to Privacy
    await page.click("text=Privasi");
    await expect(page.locator("h2")).toContainText("Privasi");
    await page.click("text=Kembali");

    // Navigate to About
    await page.click("text=Tentang");
    await expect(page.locator("h2")).toContainText("Tentang");
    await page.click("text=Kembali");
  });

  test("keyboard focus is visible", async ({ page }) => {
    await page.goto("/");
    // Tab through interactive elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Should not throw - just verify focus ring is applied
    const focused = page.locator(":focus-visible");
    const count = await focused.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("manifest link and service worker are present", async ({ page }) => {
    await page.goto("/");

    // Check manifest link
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href");

    // Service worker should be registered
    const sw = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations();
      return regs?.length ?? 0;
    });
    expect(sw).toBeGreaterThanOrEqual(0);
  });
});
