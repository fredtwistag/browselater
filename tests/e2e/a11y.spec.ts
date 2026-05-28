import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility smoke tests. We run axe against the public-reachable pages.
 * Pages behind auth require a signed-in storage state (see save-loop.spec.ts).
 */

test.describe("a11y — public pages", () => {
  test("login page has no serious or critical violations", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"]) // contrast audited manually; design tokens still in flux
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});

test.describe("a11y — authed pages", () => {
  test.skip(({}) => !process.env.STORAGE_STATE, "Needs authenticated storageState");

  test.use({ storageState: process.env.STORAGE_STATE });

  for (const route of ["/feed", "/search", "/chat", "/settings/profile", "/settings/privacy"]) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });
  }
});
