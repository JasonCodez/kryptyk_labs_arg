import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

// Phase 8.2A discovery-surface coverage: homepage, daily hub, and campaign hub
// layouts from 320px up — no horizontal overflow, bottom navigation never
// covers the final content, and the main cards stay clickable.
//
// Run via `npx playwright test`, not Jest (excluded from jest.config.js).

const DISCOVERY_VIEWPORTS: Array<{ label: string; width: number; height: number }> = [
  { label: "320x568", width: 320, height: 568 },
  { label: "390x844", width: 390, height: 844 },
];

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

/** After scrolling to the bottom, the given element must sit fully above the
 * fixed bottom tab bar rather than underneath it. */
async function expectClearsBottomNav(page: Page, selector: string) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const nav = await page.locator(".pw-bottom-nav").boundingBox();
  const target = await page.locator(selector).last().boundingBox();
  expect(nav).not.toBeNull();
  expect(target).not.toBeNull();
  expect(target!.y + target!.height).toBeLessThanOrEqual(nav!.y + 1);
}

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const sessionToken = await encode({
    secret,
    maxAge: 60 * 60,
    token: { sub: "e2e-user", id: "e2e-user", name: "Discovery Tester", email: "discovery@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: sessionToken, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

async function installCampaignFixture(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.replace(/\/$/, "") === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({
          user: { id: "e2e-user", name: "Discovery Tester", email: "discovery@example.test" },
          expires: "2099-01-01T00:00:00.000Z",
        }),
      });
      return;
    }
    if (url.pathname === "/api/puzzles") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "p1", puzzleType: "sudoku", userProgress: [{ solved: true }] },
          { id: "p2", puzzleType: "sudoku", userProgress: [{ solved: false }] },
          { id: "p3", puzzleType: "riddle", isBossPuzzle: true },
          { id: "p4", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
        ]),
      });
      return;
    }
    await route.continue();
  });
}

for (const viewport of DISCOVERY_VIEWPORTS) {
  test.describe(`homepage @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("hero, feature cards, and footer fit and stay clickable", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expectNoHorizontalOverflow(page);

      // The daily hero is the top play action and links to /daily.
      const hero = page.locator('a[href="/daily"]').first();
      await expect(hero).toBeVisible();

      // Feature strip destinations exist (Warz resolves to register for guests).
      await expect(page.locator('a[href="/puzzles"]').first()).toBeVisible();
      await expect(page.locator('a[href="/auth/register"]').first()).toBeAttached();

      // Bottom nav present and the footer content clears it.
      await expect(page.locator(".pw-bottom-nav")).toBeVisible();
      await expectClearsBottomNav(page, "footer");

      // Main card actually navigates.
      await hero.click();
      await page.waitForURL(/\/daily/, { timeout: 20000, waitUntil: "commit" });
    });
  });

  test.describe(`daily hub @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("six cards render, fit, clear the bottom nav, and open a puzzle", async ({ page }) => {
      await page.goto("/daily", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/resets in/i)).toBeVisible();
      // Wait for the card grid (loading state resolves even when signed out).
      const wordCard = page.locator('a[href="/daily/word"]');
      await expect(wordCard).toBeVisible({ timeout: 10000 });
      await expect(page.locator('a[href="/debrief"]')).toBeAttached();
      await expectNoHorizontalOverflow(page);

      // Cards keep a comfortable tap size at this width.
      const cardBox = await wordCard.boundingBox();
      expect(cardBox!.width).toBeGreaterThanOrEqual(200);
      expect(cardBox!.height).toBeGreaterThanOrEqual(44);

      await expectClearsBottomNav(page, 'a[href="/debrief"]');

      await wordCard.click();
      await page.waitForURL(/\/daily\/word/, { timeout: 20000, waitUntil: "commit" });
    });
  });
}

test.describe("campaign hub @ 320x568", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("campaign cards render readable and fit", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    const sudoku = page.locator('a[href="/puzzles/type/sudoku"]');
    await expect(sudoku).toBeVisible({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);

    const box = await sudoku.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(240);
    await expect(sudoku.getByRole("progressbar")).toBeAttached();
    await expect(sudoku).toContainText("1 of 2 cleared");
  });
});

test.describe("campaign hub @ desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("hub renders the campaign grid and complete state", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(page.locator('a[href="/puzzles/type/sudoku"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/puzzles/type/jigsaw"]')).toContainText("✓ Complete");
    await expect(page.locator('a[href="/puzzles/type/riddle"]')).toContainText("Campaign");
    await expectNoHorizontalOverflow(page);
  });
});
