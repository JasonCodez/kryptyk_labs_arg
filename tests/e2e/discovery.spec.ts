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

type DailyEntryFixture = { dayNumber: number; completedToday: boolean; streak: number; available: boolean };

// Pass 6 standard fixture: Hidden Word incomplete/available/4-day streak,
// Sudoku completed, Crossword incomplete/no streak, Word Trove unavailable,
// Jigsaw incomplete/1-day streak — all Daily #12. Debrief incomplete.
const DAILY_SUMMARY_FIXTURE: Record<string, DailyEntryFixture> = {
  word: { dayNumber: 12, completedToday: false, streak: 4, available: true },
  sudoku: { dayNumber: 12, completedToday: true, streak: 2, available: true },
  crossword: { dayNumber: 12, completedToday: false, streak: 0, available: true },
  word_search: { dayNumber: 12, completedToday: false, streak: 0, available: false },
  jigsaw: { dayNumber: 12, completedToday: false, streak: 1, available: true },
};

const DAILY_ALL_COMPLETE_FIXTURE: Record<string, DailyEntryFixture> = {
  word: { dayNumber: 12, completedToday: true, streak: 5, available: true },
  sudoku: { dayNumber: 12, completedToday: true, streak: 3, available: true },
  crossword: { dayNumber: 12, completedToday: true, streak: 1, available: true },
  word_search: { dayNumber: 12, completedToday: true, streak: 2, available: true },
  jigsaw: { dayNumber: 12, completedToday: true, streak: 1, available: true },
};

async function installDailyFixture(
  page: Page,
  options: { summary?: Record<string, DailyEntryFixture>; debriefCompleted?: boolean; authenticated?: boolean } = {}
) {
  const { summary = DAILY_SUMMARY_FIXTURE, debriefCompleted = false, authenticated = true } = options;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, "");
    if (path === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: authenticated
          ? JSON.stringify({
              user: { id: "e2e-user", name: "Discovery Tester", email: "discovery@example.test" },
              expires: "2099-01-01T00:00:00.000Z",
            })
          : JSON.stringify({}),
      });
      return;
    }
    if (path === "/api/daily/summary") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) });
      return;
    }
    if (path === "/api/debrief/today") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ completed: debriefCompleted }),
      });
      return;
    }
    await route.continue();
  });
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
      await authenticate(page);
      await installDailyFixture(page);
      await page.goto("/daily", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Next Reset")).toBeVisible();
      // Wait for the card grid (loading state resolves even when signed out).
      const wordCard = page.locator('[data-testid="daily-lineup-grid"] a[href="/daily/word"]');
      await expect(wordCard).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="daily-lineup-grid"] a[href="/debrief"]')).toBeAttached();
      await expectNoHorizontalOverflow(page);

      // Cards keep a comfortable tap size at this width.
      const cardBox = await wordCard.boundingBox();
      expect(cardBox!.width).toBeGreaterThanOrEqual(200);
      expect(cardBox!.height).toBeGreaterThanOrEqual(44);

      await expectClearsBottomNav(page, '[data-testid="daily-lineup-grid"] a[href="/debrief"]');

      await wordCard.click();
      await page.waitForURL(/\/daily\/word/, { timeout: 20000, waitUntil: "commit" });
    });
  });
}

const DAILY_MOBILE_VIEWPORTS = [
  { label: "320x710", width: 320, height: 710 },
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
];

for (const viewport of DAILY_MOBILE_VIEWPORTS) {
  test.describe(`daily hub mobile @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("header, progress, recommendation, and six ordered cards", async ({ page }) => {
      await authenticate(page);
      await installDailyFixture(page);
      await page.goto("/daily", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "Today’s Puzzle Lineup" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText("Next Reset")).toBeVisible();
      const countdown = page.locator("span.font-mono.tabular-nums");
      await expect(countdown).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

      // The visible HH:MM:SS and the accessible label must describe the same
      // snapshot — parse both from one rendered DOM read, not two.
      const [visible, label] = await countdown.evaluate((el) => [el.textContent || "", el.getAttribute("aria-label") || ""]);
      const [, vh, vm, vs] = visible.match(/^(\d{2}):(\d{2}):(\d{2})$/) || [];
      const [, lh, lm, ls] = label.match(/(\d{2}) hours, (\d{2}) minutes, and (\d{2}) seconds/) || [];
      expect([lh, lm, ls]).toEqual([vh, vm, vs]);

      // 1 of 6 complete: only Sudoku is completedToday in this fixture.
      const bar = page.getByRole("progressbar");
      await expect(bar).toHaveAttribute("aria-valuenow", "1");
      await expect(bar).toHaveAttribute("aria-valuemax", "6");

      // Hidden Word is first in lineup order, incomplete, available, and
      // needs no sign-in — it's the recommended next challenge.
      await expect(page.getByText("Play Next")).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Hidden Word" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Today’s Challenges" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/daily/word");

      const grid = page.getByTestId("daily-lineup-grid");
      const links = grid.locator("a");
      await expect(links).toHaveCount(6);
      await expect(links.nth(0)).toHaveAttribute("href", "/daily/word");
      await expect(links.nth(1)).toHaveAttribute("href", "/daily/sudoku");
      await expect(links.nth(2)).toHaveAttribute("href", "/daily/crossword");
      await expect(links.nth(3)).toHaveAttribute("href", "/daily/word-search");
      await expect(links.nth(4)).toHaveAttribute("href", "/daily/jigsaw");
      await expect(links.nth(5)).toHaveAttribute("href", "/debrief");

      // One card per row at these widths.
      const wordBox = await links.nth(0).boundingBox();
      const sudokuBox = await links.nth(1).boundingBox();
      expect(sudokuBox!.y).toBeGreaterThan(wordBox!.y + wordBox!.height - 4);

      await expect(grid.locator('a[href="/daily/sudoku"]')).toContainText("Completed");
      await expect(grid.locator('a[href="/daily/word-search"]')).toContainText("Check Back Soon");
      await expect(grid.locator('a[href="/daily/word"]')).toContainText("4 day streak");

      await expectNoHorizontalOverflow(page);

      for (let i = 0; i < 6; i++) {
        const box = await links.nth(i).boundingBox();
        expect(box!.width).toBeGreaterThan(0);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      await expectClearsBottomNav(page, '[data-testid="daily-lineup-grid"] a[href="/debrief"]');
    });
  });
}

test.describe("daily hub guest @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("only Hidden Word is playable; everything else requires sign-in", async ({ page }) => {
    await installDailyFixture(page, { authenticated: false });
    await page.goto("/daily", { waitUntil: "domcontentloaded" });

    const grid = page.getByTestId("daily-lineup-grid");
    await expect(grid.locator('a[href="/daily/word"]')).toBeVisible({ timeout: 10000 });

    await expect(grid.locator('a[href="/daily/word"]')).toContainText("Play");
    await expect(grid.locator('a[href="/daily/word"]')).not.toContainText("Sign In to Play");
    for (const href of ["/daily/sudoku", "/daily/crossword", "/daily/word-search", "/daily/jigsaw", "/debrief"]) {
      await expect(grid.locator(`a[href="${href}"]`)).toContainText("Sign In to Play");
    }

    await expect(page.getByText("Play Next")).toBeVisible();
    await expect(page.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/daily/word");

    // Server-reported completion (Sudoku) still counts even though the
    // guest can't play it — the hub never invents access it doesn't have.
    const bar = page.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "1");

    await expect(page).toHaveURL(/\/daily$/);
  });
});

const DAILY_LARGE_VIEWPORTS = [
  { label: "768x1024", width: 768, height: 1024 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "1440x900", width: 1440, height: 900 },
];

for (const viewport of DAILY_LARGE_VIEWPORTS) {
  test.describe(`daily hub @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("multi-column grid, shared catalog container, no overflow", async ({ page }) => {
      await authenticate(page);
      await installDailyFixture(page);
      await page.goto("/daily", { waitUntil: "domcontentloaded" });

      const grid = page.getByTestId("daily-lineup-grid");
      await expect(grid.locator('a[href="/daily/word"]')).toBeVisible({ timeout: 10000 });
      await expectNoHorizontalOverflow(page);

      const wordBox = await grid.locator('a[href="/daily/word"]').boundingBox();
      const sudokuBox = await grid.locator('a[href="/daily/sudoku"]').boundingBox();
      // 2+ columns: the second card sits beside, not below, the first.
      expect(Math.abs(sudokuBox!.y - wordBox!.y)).toBeLessThanOrEqual(4);
      expect(sudokuBox!.x).toBeGreaterThan(wordBox!.x);

      await expect(page.getByText("Play Next")).toBeVisible();
    });
  });
}

test.describe("daily hub @ 844x390 landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("header not clipped, progress reachable, page scrolls vertically, no overflow", async ({ page }) => {
    await authenticate(page);
    await installDailyFixture(page);
    await page.goto("/daily", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Today’s Puzzle Lineup" })).toBeVisible({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);

    const bar = page.getByRole("progressbar");
    await bar.scrollIntoViewIfNeeded();
    await expect(bar).toBeVisible();

    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(innerHeight);

    await page.getByTestId("daily-lineup-grid").locator('a[href="/debrief"]').scrollIntoViewIfNeeded();
    await expect(page.getByTestId("daily-lineup-grid").locator('a[href="/debrief"]')).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("daily hub error and retry @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a failed summary request shows retry, and retry recovers without a full page reload", async ({ page }) => {
    await authenticate(page);
    let summaryCallCount = 0;
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/\/$/, "");
      if (path === "/api/auth/session") {
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
      if (path === "/api/daily/summary") {
        summaryCallCount += 1;
        if (summaryCallCount === 1) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server error" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DAILY_SUMMARY_FIXTURE) });
        }
        return;
      }
      if (path === "/api/debrief/today") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ completed: false }) });
        return;
      }
      await route.continue();
    });

    await page.goto("/daily", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 2, name: "We couldn’t load today’s lineup" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Today’s Puzzle Lineup" })).toBeVisible();
    await expect(page.getByText("Next Reset")).toBeVisible();
    const retryButton = page.getByRole("button", { name: /Try again/ });
    await expect(retryButton).toBeVisible();

    // A real page reload would reset this in-page marker.
    await page.evaluate(() => {
      (window as unknown as { __notReloaded: boolean }).__notReloaded = true;
    });

    await retryButton.click();

    const grid = page.getByTestId("daily-lineup-grid");
    await expect(grid.locator("a")).toHaveCount(6, { timeout: 10000 });
    await expect(page.getByRole("heading", { level: 2, name: "We couldn’t load today’s lineup" })).toHaveCount(0);

    const notReloaded = await page.evaluate(() => (window as unknown as { __notReloaded?: boolean }).__notReloaded);
    expect(notReloaded).toBe(true);
  });
});

test.describe("daily hub all-complete @ 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("lineup-complete state, no recommended CTA, all six cards remain visible", async ({ page }) => {
    await authenticate(page);
    await installDailyFixture(page, { summary: DAILY_ALL_COMPLETE_FIXTURE, debriefCompleted: true });
    await page.goto("/daily", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 2, name: "Today’s lineup complete" })).toBeVisible({ timeout: 10000 });
    const bar = page.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "6");

    await expect(page.getByRole("link", { name: "Play now" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open case" })).toHaveCount(0);

    const grid = page.getByTestId("daily-lineup-grid");
    await expect(grid.locator("a")).toHaveCount(6);
    await expect(grid.locator('a[href="/daily/sudoku"]')).toContainText("Completed");
    await expect(grid.locator('a[href="/debrief"]')).toContainText("New Case Tomorrow");
  });
});

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

  test("Clear search meets the 44x44 touch target and returns focus to the search input", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    const search = page.getByLabel("Search campaigns");
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible({ timeout: 10000 });

    await search.fill("jig");
    const clearSearch = page.getByLabel("Clear search");
    const box = await clearSearch.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await clearSearch.click();

    await expect(search).toBeFocused();
    await expect(search).toHaveValue("");
    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/riddle")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible();
  });

  test("Clear filters returns focus to the search input and restores all campaigns", async ({ page }) => {
    await authenticate(page);
    await installCampaignFixture(page);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    const search = page.getByLabel("Search campaigns");
    await search.fill("sudoku");
    await expect(page.getByText("No campaigns found")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();

    await expect(search).toBeFocused();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(gridCard(page, "/puzzles/type/sudoku")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/riddle")).toBeVisible();
    await expect(gridCard(page, "/puzzles/type/jigsaw")).toBeVisible();
    await expectNoHorizontalOverflow(page);
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
