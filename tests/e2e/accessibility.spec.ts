import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

      const header = page.locator("header");
      await expect(header).toBeVisible();

      const html = page.locator("html");
      const scrollWidth = await html.evaluate((el) => el.scrollWidth);
      const clientWidth = await html.evaluate((el) => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      await expect(page.locator("header")).toContainText("RideTopo");
    });
  }

  test("navigates to Privacy and About through the menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Privasi" }).click();
    await expect(page.getByRole("heading", { name: "Privasi" })).toBeVisible();

    /* Return to composer via header brand */
    await page.getByRole("button", { name: /RideTopo/ }).first().click();

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Tentang" }).click();
    await expect(page.getByRole("heading", { name: "Tentang" })).toBeVisible();
  });

  test("keyboard focus lands on a real element with a visible focus ring", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Titik mulai")).toBeVisible();

    /* WebKit only moves focus with Tab after an explicit pointer
       interaction; click the brand first, then Tab. */
    await page.getByRole("button", { name: /RideTopo/ }).first().click();
    await page.keyboard.press("Tab");

    const focusedText = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "";
      const ring = window.getComputedStyle(el).outlineWidth;
      return `${el.tagName}:${ring}`;
    });
    /* Focus must have moved to a real focusable element with a visible ring */
    expect(["BUTTON", "CANVAS", "INPUT", "A"]).toContain(focusedText.split(":")[0]);
    expect(focusedText).not.toMatch(/:0px$/);
  });

  test("manifest link and service worker are present", async ({ page }) => {
    await page.goto("/");

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href");

    const swCount = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return 0;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length;
    });
    expect(swCount).toBeGreaterThan(0);
  });

  test("axe finds no serious or critical violations on the composer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByText("Titik mulai")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => v.id)).toEqual([]);
  });
});
