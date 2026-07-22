import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "e2e-user", username: "arena-player", totalPoints: 875, level: 12 };

const ELIGIBLE_PUZZLES = [
  { id: "elig-sudoku", title: "Elig Sudoku", difficulty: "medium", puzzleType: "sudoku", category: { name: "Logic" } },
  { id: "elig-word", title: "Elig Hidden Word", difficulty: "easy", puzzleType: "word_crack", category: { name: "Words" } },
  { id: "elig-trove", title: "Elig Word Trove", difficulty: "medium", puzzleType: "word_search", category: { name: "Words" } },
  { id: "elig-jigsaw", title: "Elig Jigsaw", difficulty: "hard", puzzleType: "jigsaw", category: { name: "Visual" } },
];

function challengeFixtures() {
  const now = Date.now();
  return [
    {
      id: "chal-spotlighted",
      status: "OPEN",
      challengerWager: 100,
      createdAt: new Date(now - 3600_000).toISOString(),
      expiresAt: new Date(now + 20 * 3600_000).toISOString(),
      spotlightUntil: new Date(now + 30 * 60_000).toISOString(),
      puzzle: { id: "p-spot", title: "Spotlight Sudoku", difficulty: "medium", puzzleType: "sudoku" },
      challenger: { id: "rival-1", name: "RivalOne", image: null, level: 8 },
      opponent: null,
      invitedUser: null,
      winner: null,
    },
    {
      id: "chal-open-normal",
      status: "OPEN",
      challengerWager: 40,
      createdAt: new Date(now - 1800_000).toISOString(),
      expiresAt: new Date(now + 21 * 3600_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-normal", title: "Normal Crossword", difficulty: "medium", puzzleType: "crossword" },
      challenger: { id: "rival-2", name: "RivalTwo", image: null, level: 6 },
      opponent: null,
      invitedUser: null,
      winner: null,
    },
    {
      id: "chal-open-mine",
      status: "OPEN",
      challengerWager: 60,
      createdAt: new Date(now - 900_000).toISOString(),
      expiresAt: new Date(now + 22 * 3600_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-mine", title: "My Own Jigsaw", difficulty: "hard", puzzleType: "jigsaw" },
      challenger: { id: USER.id, name: "arena-player", image: null, level: 12 },
      opponent: null,
      invitedUser: null,
      winner: null,
    },
    {
      id: "chal-invited-other",
      status: "OPEN",
      challengerWager: 25,
      createdAt: new Date(now - 600_000).toISOString(),
      expiresAt: new Date(now + 23 * 3600_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-invited", title: "Invited Trove", difficulty: "easy", puzzleType: "word_search" },
      challenger: { id: "rival-3", name: "RivalThree", image: null, level: 4 },
      opponent: null,
      invitedUser: { id: "someone-else", name: "SomeoneElse" },
      winner: null,
    },
    {
      id: "chal-in-progress",
      status: "IN_PROGRESS",
      challengerWager: 80,
      createdAt: new Date(now - 7200_000).toISOString(),
      expiresAt: new Date(now + 18 * 3600_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-progress", title: "Active Battle Sudoku", difficulty: "medium", puzzleType: "sudoku" },
      challenger: { id: "rival-4", name: "RivalFour", image: null, level: 9 },
      opponent: { id: USER.id, name: "arena-player" },
      invitedUser: null,
      winner: null,
    },
    {
      id: "chal-completed",
      status: "COMPLETED",
      challengerWager: 30,
      createdAt: new Date(now - 86_400_000).toISOString(),
      expiresAt: new Date(now - 60_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-completed", title: "Finished Trove", difficulty: "medium", puzzleType: "word_search" },
      challenger: { id: USER.id, name: "arena-player", image: null, level: 12 },
      opponent: { id: "rival-5", name: "RivalFive" },
      invitedUser: null,
      winner: { id: USER.id, name: "arena-player" },
    },
    {
      id: "chal-expired",
      status: "EXPIRED",
      challengerWager: 15,
      createdAt: new Date(now - 172_800_000).toISOString(),
      expiresAt: new Date(now - 86_400_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-expired", title: "Stale Sudoku", difficulty: "easy", puzzleType: "sudoku" },
      challenger: { id: "rival-6", name: "RivalSix", image: null, level: 2 },
      opponent: null,
      invitedUser: null,
      winner: null,
    },
    {
      id: "chal-cancelled",
      status: "CANCELLED",
      challengerWager: 20,
      createdAt: new Date(now - 259_200_000).toISOString(),
      expiresAt: new Date(now - 172_800_000).toISOString(),
      spotlightUntil: null,
      puzzle: { id: "p-cancelled", title: "Withdrawn Jigsaw", difficulty: "medium", puzzleType: "jigsaw" },
      challenger: { id: "rival-7", name: "RivalSeven", image: null, level: 3 },
      opponent: null,
      invitedUser: null,
      winner: null,
    },
  ];
}

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: "e2e-user", id: "e2e-user", name: "arena-player", email: "arena@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

interface FixtureOptions {
  challengesStatus?: number;
  challengesFailOnce?: boolean;
  eligibleStatus?: number;
  eligibleFailOnce?: boolean;
  /** When true, /api/warz/eligible-puzzles requests are held open until releaseEligible() is called. */
  holdEligible?: boolean;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let challengeCalls = 0;
  let eligibleCalls = 0;
  let cancelCalls = 0;
  let lastCancelBody: Record<string, unknown> | null = null;
  const challenges = challengeFixtures();
  const heldEligibleRoutes: Array<{
    fulfill: (body: unknown, status?: number) => Promise<void>;
  }> = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (path === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: "arena-player", email: "arena@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (path === "/api/warz" && method === "GET") {
      challengeCalls += 1;
      if (options.challengesFailOnce && challengeCalls === 1) {
        return fulfill({ error: "failed" }, 500);
      }
      return fulfill({ challenges, total: challenges.length, page: 1, limit: 50 }, options.challengesStatus ?? 200);
    }

    if (path === "/api/user/info" && method === "GET") {
      return fulfill(USER);
    }

    if (path === "/api/warz/eligible-puzzles" && method === "GET") {
      eligibleCalls += 1;
      if (options.holdEligible) {
        heldEligibleRoutes.push({ fulfill });
        return; // left pending until releaseEligible() is called
      }
      if (options.eligibleFailOnce && eligibleCalls === 1) {
        return fulfill({ error: "failed" }, 500);
      }
      return fulfill({ puzzles: ELIGIBLE_PUZZLES }, options.eligibleStatus ?? 200);
    }

    if (path === "/api/warz/cancel" && method === "POST") {
      cancelCalls += 1;
      lastCancelBody = request.postDataJSON();
      return fulfill({ ok: true });
    }

    return fulfill({});
  });

  return {
    challengeCallCount: () => challengeCalls,
    eligibleCallCount: () => eligibleCalls,
    cancelCallCount: () => cancelCalls,
    lastCancelBody: () => lastCancelBody,
    releaseEligible: async (index: number, puzzles: typeof ELIGIBLE_PUZZLES = ELIGIBLE_PUZZLES, status = 200) => {
      const held = heldEligibleRoutes[index];
      if (!held) throw new Error(`No held eligible-puzzles request at index ${index}`);
      await held.fulfill({ puzzles }, status);
    },
    heldEligibleCount: () => heldEligibleRoutes.length,
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

/** Dismisses the site's global cookie-notice dialog so it can't shadow `getByRole("dialog")` queries or intercept clicks. */
async function dismissCookieBanner(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  try {
    await gotIt.waitFor({ state: "visible", timeout: 3000 });
    await gotIt.click();
  } catch {
    // Banner never appeared (e.g. already dismissed this session) — nothing to close.
  }
}

function cardById(page: Page, challengeId: string) {
  return page.locator(`[data-testid="warz-challenge-card"][data-challenge-id="${challengeId}"]`);
}

function pickerDialog(page: Page) {
  return page.getByRole("dialog", { name: "Choose your puzzle" });
}

const MOBILE_VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe("Warz lobby — mobile coverage", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: identity, overview, and challenge groups render correctly`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto("/warz", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Puzzle Warz");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("button", { name: /issue a challenge/i })).toBeVisible();
      await expect(page.getByText("875 Points")).toBeVisible();
      await expect(page.getByText("Level 12")).toBeVisible();

      await expect(page.getByRole("tab", { name: /Open Challenges/ })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText("Spotlighted Challenges")).toBeVisible();

      const spotlightSection = page.locator('section[aria-label="Spotlighted challenges"]');
      await expect(spotlightSection.getByText("Spotlight Sudoku")).toBeVisible();

      const tabPanel = page.getByRole("tabpanel");
      await expect(tabPanel.getByText("Normal Crossword")).toBeVisible();
      // Spotlighted challenge must not also appear inside the Open tab panel.
      await expect(
        tabPanel.locator('[data-testid="warz-challenge-card"][data-challenge-id="chal-spotlighted"]')
      ).toHaveCount(0);

      const ownCard = cardById(page, "chal-open-mine");
      await expect(ownCard.getByRole("button", { name: "Cancel" })).toBeVisible();

      const invitedCard = cardById(page, "chal-invited-other");
      await expect(invitedCard.getByRole("link", { name: "Accept" })).toHaveCount(0);

      await expectNoHorizontalOverflow(page);

      const issueBox = await page.getByRole("button", { name: /issue a challenge/i }).boundingBox();
      expect(issueBox).not.toBeNull();
      expect(issueBox!.height).toBeGreaterThanOrEqual(44);

      await expect(page.locator(".pw-bottom-nav")).toBeVisible();
    });
  }
});

test.describe("Warz lobby — tab behavior", () => {
  test("switching tabs updates the panel without new lobby requests", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("tab", { name: /Open Challenges/ })).toHaveAttribute("aria-selected", "true");
    const initialCalls = fixture.challengeCallCount();

    await page.getByRole("tab", { name: /My Battles/ }).click();
    await expect(page.getByRole("tab", { name: /My Battles/ })).toHaveAttribute("aria-selected", "true");
    const tabPanel = page.getByRole("tabpanel");
    await expect(tabPanel.getByText("My Own Jigsaw")).toBeVisible();
    await expect(tabPanel.getByText("Active Battle Sudoku")).toBeVisible();
    await expect(tabPanel.getByText("Finished Trove")).toBeVisible();

    await page.getByRole("tab", { name: /History/ }).click();
    await expect(page.getByRole("tab", { name: /History/ })).toHaveAttribute("aria-selected", "true");
    await expect(tabPanel.getByText("Finished Trove")).toBeVisible();
    await expect(tabPanel.getByText("Stale Sudoku")).toBeVisible();
    await expect(tabPanel.getByText("Withdrawn Jigsaw")).toBeVisible();

    await page.getByRole("tab", { name: /Open Challenges/ }).click();
    await expect(page.getByRole("tab", { name: /Open Challenges/ })).toHaveAttribute("aria-selected", "true");

    expect(fixture.challengeCallCount()).toBe(initialCalls);

    for (const tabName of [/Open Challenges/, /My Battles/, /History/]) {
      const tab = page.getByRole("tab", { name: tabName });
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("Warz lobby — puzzle picker", () => {
  test("open, search, filter, and close via Escape and backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect.poll(fixture.eligibleCallCount).toBe(1);

    const dialog = pickerDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Choose your puzzle" })).toBeVisible();
    await expect(page.getByLabel("Search eligible puzzles")).toBeFocused();

    for (const puzzle of ELIGIBLE_PUZZLES) {
      await expect(dialog.getByText(puzzle.title)).toBeVisible();
    }

    await page.getByLabel("Search eligible puzzles").fill("sudoku");
    await expect(dialog.getByText("Elig Sudoku")).toBeVisible();
    await expect(dialog.getByText("Elig Jigsaw")).toHaveCount(0);

    await page.getByLabel("Search eligible puzzles").fill("");
    await dialog.getByRole("button", { name: "Word Trove", exact: true }).click();
    await expect(dialog.getByText("Elig Word Trove")).toBeVisible();
    await expect(dialog.getByText("Elig Sudoku")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Sudoku" }).click();
    await page.getByLabel("Search eligible puzzles").fill("zzzz-no-match");
    await expect(dialog.getByText(/no eligible puzzles match your search/i)).toBeVisible();

    expect(fixture.eligibleCallCount()).toBe(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: /issue a challenge/i })).toBeFocused();

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect(pickerDialog(page)).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(pickerDialog(page)).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Warz lobby — picker failure and retry", () => {
  test("error state, retry, and successful recovery", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { eligibleFailOnce: true });
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    const dialog = pickerDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/couldn.t load eligible puzzles/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /try again/i })).toBeVisible();

    await dialog.getByRole("button", { name: /try again/i }).click();
    await expect.poll(fixture.eligibleCallCount).toBe(2);
    await expect(dialog.getByText("Elig Sudoku")).toBeVisible();

    expect(fixture.challengeCallCount()).toBe(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("Warz lobby — picker request lifecycle", () => {
  test("closing and reopening while a request is pending does not start a second request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { holdEligible: true });
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect.poll(fixture.eligibleCallCount).toBe(1);
    await expect(pickerDialog(page).getByText(/loading eligible puzzles/i)).toBeVisible();

    // Close with Escape while the request is still pending, then reopen immediately.
    await page.keyboard.press("Escape");
    await expect(pickerDialog(page)).toHaveCount(0);
    await page.getByRole("button", { name: /issue a challenge/i }).click();

    // Reopening must reuse the still-pending request, not start a new one.
    expect(fixture.eligibleCallCount()).toBe(1);
    await expect(pickerDialog(page).getByText(/loading eligible puzzles/i)).toBeVisible();

    await fixture.releaseEligible(0);
    await expect(pickerDialog(page).getByText("Elig Sudoku")).toBeVisible();

    // Close and reopen again after a successful load — still no new request.
    await page.keyboard.press("Escape");
    await expect(pickerDialog(page)).toHaveCount(0);
    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect(pickerDialog(page).getByText("Elig Sudoku")).toBeVisible();
    expect(fixture.eligibleCallCount()).toBe(1);

    // Searching and filtering must not cause another request either.
    await page.getByLabel("Search eligible puzzles").fill("sudoku");
    await page.getByRole("button", { name: "Jigsaw", exact: true }).click();
    expect(fixture.eligibleCallCount()).toBe(1);
  });

  test("a newer successful result is not overwritten by an older response settling afterward", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { holdEligible: true });
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // The production in-flight guard means only one real request can be
    // outstanding within a single page instance, so the authoritative,
    // deterministic reproduction of "an older response landing after a
    // newer one already succeeded" lives in the Jest suite (page.test.tsx,
    // "Warz picker request lifecycle" #11–12), which drives two independent
    // component instances directly. Here we confirm the reachable part of
    // that guarantee end-to-end: the still-pending request from before a
    // full reload resolving late must not corrupt the freshly loaded page.
    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect.poll(fixture.eligibleCallCount).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect.poll(fixture.eligibleCallCount).toBe(2);
    await fixture.releaseEligible(1);
    await expect(pickerDialog(page).getByText("Elig Sudoku")).toBeVisible();

    // The pre-reload request finally settles — the current page must be unaffected.
    await fixture.releaseEligible(0);
    await expect(pickerDialog(page).getByText("Elig Sudoku")).toBeVisible();
    await expect(pickerDialog(page).getByText(/couldn.t load eligible puzzles/i)).toHaveCount(0);
  });
});

test.describe("Warz lobby — touch targets", () => {
  test("interactive controls meet minimum size requirements at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const issueBox = await page.getByRole("button", { name: /issue a challenge/i }).boundingBox();
    expect(issueBox).not.toBeNull();
    expect(issueBox!.height).toBeGreaterThanOrEqual(44);

    for (const tabName of [/Open Challenges/, /My Battles/, /History/]) {
      const box = await page.getByRole("tab", { name: tabName }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    const dialog = pickerDialog(page);
    await expect(dialog).toBeVisible();

    const searchBox = await page.getByLabel("Search eligible puzzles").boundingBox();
    expect(searchBox).not.toBeNull();
    expect(searchBox!.height).toBeGreaterThanOrEqual(44);

    const closeBox = await dialog.getByRole("button", { name: "Close puzzle picker" }).boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);

    for (const filterName of ["All", "Sudoku", "Hidden Word", "Word Trove", "Jigsaw"]) {
      const box = await dialog.getByRole("button", { name: filterName, exact: true }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    for (const puzzle of ELIGIBLE_PUZZLES) {
      const box = await dialog.getByRole("button", { name: new RegExp(puzzle.title) }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
  });

  test("Try again button meets minimum size when the picker errors", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { eligibleFailOnce: true });
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    const dialog = pickerDialog(page);
    const retryBox = await dialog.getByRole("button", { name: /try again/i }).boundingBox();
    expect(retryBox).not.toBeNull();
    expect(retryBox!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Warz lobby — lobby failure and retry", () => {
  test("initial failure shows error, retry recovers without reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { challengesFailOnce: true });
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Puzzle Warz");
    await expect(page.getByText(/couldn.t load the warz arena/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __marker: boolean }).__marker = true;
    });

    await page.getByRole("button", { name: /try again/i }).click();
    await expect.poll(fixture.challengeCallCount).toBe(2);
    await expect(page.getByText(/couldn.t load the warz arena/i)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Open Challenges/ })).toBeVisible();

    const markerStillPresent = await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker === true);
    expect(markerStillPresent).toBe(true);

    const cardTitles = await page.locator('[role="tabpanel"]').innerText();
    expect(cardTitles.match(/Normal Crossword/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

test.describe("Warz lobby — cancellation", () => {
  test("Cancel is scoped to the owner's open challenge and submits exactly once", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const ownCard = cardById(page, "chal-open-mine");
    const otherCard = cardById(page, "chal-open-normal");

    await expect(ownCard.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(otherCard.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    const cancelButton = ownCard.getByRole("button", { name: "Cancel" });
    await cancelButton.click();
    // The control disables itself synchronously on click and is replaced
    // once cancellation succeeds — see the WarzChallengeCard unit test
    // "cancel disables while pending" for the deterministic, race-free proof
    // that a rapid repeat click cannot resubmit. Here we confirm the
    // end-to-end outcome: exactly one request reaches the real route.
    await expect.poll(fixture.cancelCallCount).toBe(1);
    expect(fixture.lastCancelBody()).toEqual({ challengeId: "chal-open-mine" });

    // Once cancelled, the challenge is no longer OPEN, so the Open tab's own
    // filter naturally excludes it (per the pass spec: "the page may update
    // the matching card status locally... do not remove the card from the
    // current tab unless the existing tab filter naturally excludes the new
    // status after the local update").
    await expect(ownCard).toHaveCount(0);
    await expect(otherCard.getByText("Open")).toBeVisible();

    await page.getByRole("tab", { name: /History/ }).click();
    await expect(cardById(page, "chal-open-mine").getByText("Cancelled")).toBeVisible();

    await expect(page.getByText("875 Points")).toBeVisible();
  });
});

test.describe("Warz lobby — desktop and landscape", () => {
  const viewports = [
    { width: 844, height: 390, label: "landscape" },
    { width: 768, height: 1024, label: "tablet" },
    { width: 1024, height: 768, label: "tablet landscape" },
    { width: 1440, height: 900, label: "desktop" },
  ];

  for (const viewport of viewports) {
    test(`${viewport.label} ${viewport.width}x${viewport.height}: browse chrome, compact header, no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await authenticate(page);
      await installFixture(page);
      await page.goto("/warz", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The mobile bottom nav / desktop navbar hand-off happens at exactly
      // 1032px (see globals.css), matching AppNavbar's own breakpoint.
      if (viewport.width >= 1032) {
        await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();
        await expect(page.locator("#global-nav")).toBeVisible();
      } else {
        await expect(page.locator(".pw-bottom-nav")).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);

      await page.getByRole("button", { name: /issue a challenge/i }).click();
      const dialog = pickerDialog(page);
      await expect(dialog).toBeVisible();
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(dialogBox!.width).toBeLessThanOrEqual(viewport.width);
      await expect(dialog.getByRole("button", { name: "Close puzzle picker" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Warz lobby — reduced motion", () => {
  test("header, cards, and dialog render without transform-based entrance motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/warz", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const header = page.locator("header");
    await expect(header).toBeVisible();

    // useAppReducedMotion is SSR-hydration-safe: React requires the first
    // client render to match the server snapshot (motion enabled) before
    // self-correcting once the real OS preference is read, so a brief
    // correction frame is expected — what matters is that it settles at rest
    // with no residual transform, not that it is instantaneous. The
    // WarzLobbyHeader unit test separately asserts the `initial` prop value
    // deterministically at the React level.
    await expect
      .poll(() => header.evaluate((el) => getComputedStyle(el).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);

    await page.getByRole("button", { name: /issue a challenge/i }).click();
    await expect(pickerDialog(page)).toBeVisible();
  });
});
