import { test, expect } from "@playwright/test";

/**
 * Phase 0 acceptance test (tasks/phase-0.md).
 *
 * Steps require a real Supabase project + env vars in .env.local; otherwise
 * the magic-link request will fail. Skip locally if env not set.
 */

test.describe("Phase 0 auth + shell", () => {
  test("unauthenticated /feed redirects to /login", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Send magic link")).toBeVisible();
  });

  test("login page shows magic link + Google option", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });
});
