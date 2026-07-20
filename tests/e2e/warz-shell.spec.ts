import { expect, test, type Page } from "@playwright/test";

// Pass 1 (site redesign): Warz app-shell mode coverage + responsive top
// clearance for the two Warz gameplay route families. Purely a shell/chrome
// check — every Warz API call is mocked with deterministic fixtures so this
// spec never depends on a live database or an existing user account.
//
// NOTE: this is a real Playwright spec (not a Jest test) — run via
// `npx playwright test`, not `npm test`.

const PUZZLE_ID = "warz-shell-test-puzzle";
const CHALLENGE_ID = "warz-shell-test-challenge";

/** document width must never exceed the viewport — a 1px tolerance absorbs scrollbar rounding. */
async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

async function expectAppMode(page: Page, mode: string) {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appMode)).toBe(mode);
}

/**
 * A puzzle type unrecognized by WarzPlayBoard's renderPuzzle() switch — it
 * falls back to a stable, puzzle-mechanic-independent "Unsupported puzzle
 * type" message. This keeps the shell/chrome geometry checks below fully
 * decoupled from any real puzzle renderer (Word Trove, Jigsaw, etc. all stay
 * untouched and unexercised by this spec).
 */
const FIXTURE_PUZZLE = {
  id: PUZZLE_ID,
  title: "Warz Shell Fixture Puzzle",
  difficulty: "medium",
  puzzleType: "e2e_shell_fixture",
  data: {},
};

async function mockWarzPlayRoutes(page: Page) {
  await page.route(`**/api/puzzles/${PUZZLE_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FIXTURE_PUZZLE) })
  );
  await page.route("**/api/user/info", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e-user", username: "e2e-user", totalPoints: 500 }) })
  );
  await page.route(`**/api/warz/check-eligible**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eligible: true }) })
  );
}

async function mockWarzChallengeRoutes(page: Page) {
  const challenge = {
    id: CHALLENGE_ID,
    status: "IN_PROGRESS",
    challengerWager: 50,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    puzzle: FIXTURE_PUZZLE,
    challenger: { id: "challenger-user", username: "Challenger" },
    opponent: { id: "e2e-user", username: "e2e-user" },
  };
  await page.route(`**/api/warz/${CHALLENGE_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ challenge }) })
  );
  await page.route("**/api/user/info", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e-user", username: "e2e-user", totalPoints: 500 }) })
  );
  // Not expected to fire on the deterministic "resume already-accepted" path below,
  // but mocked defensively so an unexpected call never falls through to a real API.
  await page.route("**/api/warz/accept", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ challenge }) })
  );
}

test.describe("Warz play — /warz/play/[puzzleId]", () => {
  test("mobile 390x844: pre-play is browse-cleared play mode, Start Battle reaches active play with compact top clearance", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWarzPlayRoutes(page);
    await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Start Battle" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#global-nav")).not.toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();
    await expectAppMode(page, "play");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Start Battle" }).click();

    const shell = page.locator('[data-testid="warz-active-play-shell"]');
    await expect(shell).toBeVisible();
    const paddingTop = await shell.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(paddingTop).toBeLessThan(96);
    expect(paddingTop).toBeCloseTo(16, 0);

    // Active battle content is visible and not obscured — the header/Forfeit control
    // render regardless of puzzle type, so this stays independent of any real puzzle renderer.
    await expect(page.getByRole("button", { name: "Forfeit" })).toBeVisible();
    await expect(page.getByText(FIXTURE_PUZZLE.title)).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test("desktop 1440x900: navbar preserved, active play keeps clearance below it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockWarzPlayRoutes(page);
    await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Start Battle" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();

    await page.getByRole("button", { name: "Start Battle" }).click();

    const shell = page.locator('[data-testid="warz-active-play-shell"]');
    await expect(shell).toBeVisible();
    const paddingTop = await shell.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(paddingTop).toBeCloseTo(96, 0);

    const navBox = await page.locator("#global-nav").boundingBox();
    const forfeitBox = await page.getByRole("button", { name: "Forfeit" }).boundingBox();
    expect(navBox).not.toBeNull();
    expect(forfeitBox).not.toBeNull();
    // First meaningful gameplay content (the Forfeit control in WarzPlayBoard's header)
    // must not overlap the fixed global navbar.
    expect(forfeitBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height);

    await expectNoHorizontalOverflow(page);
  });

  test("mobile landscape 844x390: no navbar/bottom-nav, no large blank band above gameplay, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await mockWarzPlayRoutes(page);
    await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Start Battle" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Start Battle" }).click();

    const shell = page.locator('[data-testid="warz-active-play-shell"]');
    await expect(shell).toBeVisible();
    await expect(page.locator("#global-nav")).not.toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();

    const paddingTop = await shell.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(paddingTop).toBeLessThan(96);

    await expect(page.getByRole("button", { name: "Forfeit" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Warz challenge — /warz/challenge/[id]", () => {
  test("mobile 390x844: resumable challenge is play mode, resuming reaches active play with compact top clearance", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWarzChallengeRoutes(page);
    await page.goto(`/warz/challenge/${CHALLENGE_ID}`, { waitUntil: "domcontentloaded" });

    const resumeButton = page.getByRole("button", { name: /Play Battle/ });
    await expect(resumeButton).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#global-nav")).not.toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();
    await expectAppMode(page, "play");
    await expectNoHorizontalOverflow(page);

    // Deterministic "resume" path: the fixture challenge is already accepted by the
    // current user and IN_PROGRESS, so this button flips local `playing` state directly
    // with no further network call — no reliance on live match/accept data.
    await resumeButton.click();

    const shell = page.locator('[data-testid="warz-active-play-shell"]');
    await expect(shell).toBeVisible();
    const paddingTop = await shell.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(paddingTop).toBeLessThan(96);
    expect(paddingTop).toBeCloseTo(16, 0);

    await expect(page.getByRole("button", { name: "Forfeit" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("desktop 1440x900: navbar preserved, active play keeps clearance below it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockWarzChallengeRoutes(page);
    await page.goto(`/warz/challenge/${CHALLENGE_ID}`, { waitUntil: "domcontentloaded" });

    const resumeButton = page.getByRole("button", { name: /Play Battle/ });
    await expect(resumeButton).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();

    await resumeButton.click();

    const shell = page.locator('[data-testid="warz-active-play-shell"]');
    await expect(shell).toBeVisible();
    const paddingTop = await shell.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(paddingTop).toBeCloseTo(96, 0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Warz hub — browse-mode regression", () => {
  test("/warz at 390x844 remains browse mode: navbar and bottom nav stay visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/warz", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).toBeVisible();
    await expectAppMode(page, "browse");
    await expectNoHorizontalOverflow(page);
  });
});
