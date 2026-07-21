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

// Pass 4 catalog fixture: Sudoku is 1 of 2 solved (in progress), Riddle is 0
// solved and carries a boss puzzle (not started), Jigsaw is fully solved
// (completed). Grid-scoped locators are required because the Continue
// Campaign spotlight links to the same in-progress route (Sudoku) as its own
// grid card, so an unscoped href query would match two elements.
function gridCard(page: Page, href: string) {
  return page.locator(`[data-testid="campaign-grid"] a[href="${href}"]`);
}

async function installFailThenSucceedFixture(page: Page) {
  let puzzlesCallCount = 0;
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
      puzzlesCallCount += 1;
      if (puzzlesCallCount === 1) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server error" }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { id: "p1", puzzleType: "sudoku", userProgress: [{ solved: true }] },
            { id: "p2", puzzleType: "sudoku", userProgress: [{ solved: false }] },
            { id: "p3", puzzleType: "riddle", isBossPuzzle: true },
            { id: "p4", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
            { id: "p5", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
          ]),
        });
      }
      return;
    }
    await route.continue();
  });
}

const CATALOG_MOBILE_VIEWPORTS = [
  { label: "320x710", width: 320, height: 710 },
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
];

for (const viewport of CATALOG_MOBILE_VIEWPORTS) {
  test.describe(`campaign hub @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("library header, search, Continue Campaign, single-column cards, and bottom-nav clearance", async ({ page }) => {
      await authenticate(page);
      await installCampaignFixture(page);
      await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "Find your next challenge" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByLabel("Search campaigns")).toBeVisible();
      await expect(page.getByTestId("continue-campaign")).toBeVisible();
      await expect(page.getByTestId("continue-campaign")).toContainText("Sudoku");
      await expectNoHorizontalOverflow(page);

      const sudoku = gridCard(page, "/puzzles/type/sudoku");
      await expect(sudoku).toBeVisible();
      const sudokuBox = await sudoku.boundingBox();
      expect(sudokuBox!.width).toBeGreaterThanOrEqual(240);
      expect(sudokuBox!.height).toBeGreaterThanOrEqual(44);

      const jigsawBox = await gridCard(page, "/puzzles/type/jigsaw").boundingBox();
      // Single column: the next card sits below, not beside, the first one.
      expect(jigsawBox!.y).toBeGreaterThan(sudokuBox!.y + sudokuBox!.height - 4);

      const bar = sudoku.getByRole("progressbar");
      await expect(bar).toBeAttached();
      await expect(bar).toHaveAttribute("aria-valuenow", "1");
      await expect(bar).toHaveAttribute("aria-valuemax", "2");

      // Status filters wrap instead of forcing horizontal scroll.
      await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeVisible();

      await expectClearsBottomNav(page, '[data-testid="campaign-grid"] a');
    });
  });
}

test.describe("campaign hub @ 844x390 landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("no overflow, header and controls usable, page scrolls vertically", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Find your next challenge" })).toBeVisible({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);

    await expect(page.getByLabel("Search campaigns")).toBeVisible();
    await expect(page.getByRole("button", { name: "In Progress", exact: true })).toBeVisible();

    // Continue spotlight is reachable via vertical scroll.
    await page.getByTestId("continue-campaign").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("continue-campaign")).toBeVisible();

    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(innerHeight);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("campaign hub @ 1024x768 tablet", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("two-column campaign grid inside the shared catalog container", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible({ timeout: 10000 });
    const sudokuBox = await gridCard(page, "/puzzles/type/sudoku").boundingBox();
    const riddleBox = await gridCard(page, "/puzzles/type/riddle").boundingBox();
    // Two columns: the second card sits beside, not below, the first.
    expect(Math.abs(riddleBox!.y - sudokuBox!.y)).toBeLessThanOrEqual(4);
    expect(riddleBox!.x).toBeGreaterThan(sudokuBox!.x);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("campaign hub @ 1440x900 desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("three-column grid, correct states, Continue Campaign links to Sudoku, stays inside the catalog width", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible({ timeout: 10000 });
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toContainText("Completed");
    await expect(gridCard(page, "/puzzles/type/riddle")).toContainText("Boss finale");
    await expect(gridCard(page, "/puzzles/type/sudoku")).toContainText("In Progress");

    const continueLink = page.getByTestId("continue-campaign").locator("xpath=ancestor::a[1]");
    await expect(continueLink).toHaveAttribute("href", "/puzzles/type/sudoku");

    const sudokuBox = await gridCard(page, "/puzzles/type/sudoku").boundingBox();
    const riddleBox = await gridCard(page, "/puzzles/type/riddle").boundingBox();
    const jigsawBox = await gridCard(page, "/puzzles/type/jigsaw").boundingBox();
    // Three columns: all three cards share the same row.
    expect(Math.abs(riddleBox!.y - sudokuBox!.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(jigsawBox!.y - sudokuBox!.y)).toBeLessThanOrEqual(4);

    await expectNoHorizontalOverflow(page);

    const containerBox = await page.locator('[data-testid="campaign-grid"]').boundingBox();
    expect(containerBox!.width).toBeLessThanOrEqual(1280 + 32); // lg:max-w-7xl (1280px) + gutters
  });
});

test.describe("campaign hub search interaction @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("typing filters the grid; clearing restores all campaigns", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    const search = page.getByLabel("Search campaigns");
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible({ timeout: 10000 });

    await search.fill("jig");
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/sudoku")).toHaveCount(0);
    await expect(gridCard(page, "/puzzles/type/riddle")).toHaveCount(0);

    await page.getByLabel("Clear search").click();
    await expect(search).toHaveValue("");
    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/riddle")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible();
  });
});

test.describe("campaign hub status filtering @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Completed, In Progress, and Not Started each isolate the matching campaign", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/sudoku")).toHaveCount(0);
    await expect(gridCard(page, "/puzzles/type/riddle")).toHaveCount(0);

    await page.getByRole("button", { name: "In Progress", exact: true }).click();
    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toHaveCount(0);
    await expect(gridCard(page, "/puzzles/type/riddle")).toHaveCount(0);

    await page.getByRole("button", { name: "Not Started", exact: true }).click();
    await expect(gridCard(page, "/puzzles/type/riddle")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toHaveCount(0);
    await expect(gridCard(page, "/puzzles/type/sudoku")).toHaveCount(0);
  });
});

test.describe("campaign hub browse-individual action @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('"Browse individual puzzles" points at the legacy flat list', async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("link", { name: /Browse individual puzzles/ })).toHaveAttribute(
      "href",
      "/puzzles?category=all"
    );
  });
});

test.describe("campaign hub error and retry @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a failed request shows the retry state, and retry recovers without a full page reload", async ({ page }) => {
    await authenticate(page);
    await installFailThenSucceedFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("We couldn't load the puzzle library")).toBeVisible({ timeout: 10000 });
    const retryButton = page.getByRole("button", { name: /Try again/ });
    await expect(retryButton).toBeVisible();

    // A real page reload would reset this in-page marker.
    await page.evaluate(() => {
      (window as unknown as { __notReloaded: boolean }).__notReloaded = true;
    });

    await retryButton.click();

    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("We couldn't load the puzzle library")).toHaveCount(0);

    const notReloaded = await page.evaluate(() => (window as unknown as { __notReloaded?: boolean }).__notReloaded);
    expect(notReloaded).toBe(true);
  });
});
