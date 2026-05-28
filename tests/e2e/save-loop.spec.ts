import { test, expect } from "@playwright/test";

/**
 * Phase 1 save loop e2e. Requires an authenticated session — gated behind STORAGE_STATE.
 * In CI we generate the storage state via a setup step (TODO once auth is wired).
 */

test.skip(({}, testInfo) => !process.env.STORAGE_STATE, "Needs authenticated storageState");

test("paste URL → placeholder card → eventually populated", async ({ page }) => {
  await page.goto("/feed");
  const input = page.getByPlaceholder("https://...");
  await input.fill("https://example.com");
  await page.keyboard.press("Enter");
  // Empty state should be gone; a card or placeholder should be visible.
  await expect(page.getByText(/working on it|example/i).first()).toBeVisible({ timeout: 30_000 });
});
