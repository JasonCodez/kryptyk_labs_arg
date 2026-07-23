import { expect, test } from "@playwright/test";

test.describe("leaderboards shell", () => {
  test("keeps the shell within a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await page.goto("/leaderboards");
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});
