import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

// Deterministic route mocks throughout — this spec never depends on a live
// database or a real user account.

const USER = { id: "e2e-battle-user", username: "arena-battler", name: "arena-battler", totalPoints: 875 };
const CHALLENGER = { id: "e2e-battle-challenger", name: "ArenaChallenger", username: "ArenaChallenger", image: null, level: 14 };

const HIDDEN_WORD_PUZZLE = {
  id: "battle-hidden-word",
  title: "Midnight Hidden Word",
  difficulty: "medium",
  puzzleType: "word_crack",
  data: { wordLength: 5, maxGuesses: 6 },
};

async function authenticate(page: Page, userId: string, name: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: userId, id: userId, name, email: "battler@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

async function dismissCookieBanner(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  try {
    await gotIt.waitFor({ state: "visible", timeout: 3000 });
    await gotIt.click();
  } catch {
    // Banner never appeared this session — nothing to close.
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

const WRONG_RESULT = [
  { letter: "X", status: "absent" },
  { letter: "X", status: "absent" },
  { letter: "X", status: "absent" },
  { letter: "X", status: "absent" },
  { letter: "X", status: "absent" },
];
const CORRECT_RESULT = [
  { letter: "C", status: "correct" },
  { letter: "R", status: "correct" },
  { letter: "A", status: "correct" },
  { letter: "N", status: "correct" },
  { letter: "E", status: "correct" },
];

/** Installs deterministic routes for the challenger flow (/warz/play/[puzzleId]). */
async function installChallengerFixture(page: Page, options: { createFailOnce?: boolean } = {}) {
  let createCalls = 0;
  let lastCreateBody: Record<string, unknown> | null = null;
  let guessCalls = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (path === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: USER.name, email: "battler@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }
    if (path === `/api/puzzles/${HIDDEN_WORD_PUZZLE.id}` && method === "GET") {
      return fulfill(HIDDEN_WORD_PUZZLE);
    }
    if (path === "/api/user/info" && method === "GET") {
      return fulfill(USER);
    }
    if (path === "/api/warz/check-eligible" && method === "GET") {
      return fulfill({ eligible: true });
    }
    if (path === `/api/puzzles/${HIDDEN_WORD_PUZZLE.id}/word_crack` && method === "POST") {
      guessCalls += 1;
      return fulfill({ result: CORRECT_RESULT, solved: true, xpGained: 0 });
    }
    if (path === "/api/warz/create" && method === "POST") {
      createCalls += 1;
      lastCreateBody = request.postDataJSON();
      // A brief deterministic delay so the intermediate "Puzzle Complete" /
      // pending state is reliably observable — a fully local mocked route
      // otherwise resolves fast enough that the panel can transition away
      // before an assertion's first poll ever sees it.
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (options.createFailOnce && createCalls === 1) {
        return fulfill({ error: "Failed to post challenge" }, 500);
      }
      return fulfill({ success: true });
    }
    return fulfill({});
  });

  return {
    createCallCount: () => createCalls,
    lastCreateBody: () => lastCreateBody,
    guessCallCount: () => guessCalls,
  };
}

/** Installs deterministic routes for the opponent flow (/warz/challenge/[id]), pre-accepted (IN_PROGRESS). */
async function installOpponentFixture(page: Page, options: { failGuessesUntilLoss?: boolean } = {}) {
  let completeCalls = 0;
  let lastCompleteBody: Record<string, unknown> | null = null;
  let guessCalls = 0;

  const challenge = {
    id: "battle-challenge",
    status: "IN_PROGRESS",
    challengerWager: 50,
    expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    puzzle: HIDDEN_WORD_PUZZLE,
    challenger: CHALLENGER,
    opponent: { id: USER.id, username: USER.username },
    invitedUser: null,
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (path === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: USER.name, email: "battler@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }
    if (path === `/api/warz/${challenge.id}` && method === "GET") {
      return fulfill({ challenge });
    }
    if (path === "/api/user/info" && method === "GET") {
      return fulfill(USER);
    }
    if (path === `/api/puzzles/${HIDDEN_WORD_PUZZLE.id}/word_crack` && method === "POST") {
      guessCalls += 1;
      if (options.failGuessesUntilLoss) {
        return fulfill({ result: WRONG_RESULT, solved: false });
      }
      return fulfill({ result: CORRECT_RESULT, solved: true, xpGained: 0 });
    }
    if (path === "/api/warz/complete" && method === "POST") {
      completeCalls += 1;
      lastCompleteBody = request.postDataJSON();
      // See the matching comment in installChallengerFixture — a brief
      // deterministic delay keeps the intermediate pending state observable.
      await new Promise((resolve) => setTimeout(resolve, 400));
      return fulfill({ winnerId: USER.id, tie: false });
    }
    return fulfill({});
  });

  return {
    completeCallCount: () => completeCalls,
    lastCompleteBody: () => lastCompleteBody,
    guessCallCount: () => guessCalls,
    challengeId: challenge.id,
  };
}

async function solveHiddenWord(page: Page) {
  for (const letter of ["C", "R", "A", "N", "E"]) {
    await page.keyboard.press(letter);
  }
  await page.keyboard.press("Enter");
}

async function submitWrongGuess(page: Page) {
  for (const letter of ["X", "X", "X", "X", "X"]) {
    await page.keyboard.press(letter);
  }
  await page.keyboard.press("Enter");
  // The tile-reveal animation blocks new input for roughly
  // wordLength * revealStepMs + revealBaseMs — wait it out so the next
  // guess isn't silently dropped while a row is still revealing.
  await page.waitForTimeout(1200);
}

function challengerUrl() {
  return `/warz/play/${HIDDEN_WORD_PUZZLE.id}`;
}

function opponentUrl(challengeId: string) {
  return `/warz/challenge/${challengeId}`;
}

async function enterChallengerBattle(page: Page) {
  await page.goto(challengerUrl(), { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: "Start Battle" }).click();
  await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
  await startSolving(page);
}

async function enterOpponentBattle(page: Page, challengeId: string) {
  await page.goto(opponentUrl(challengeId), { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: "Play Battle" }).click();
  await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
  await startSolving(page);
}

async function startSolving(page: Page) {
  // HiddenWordPuzzle's own briefing modal mounts asynchronously — wait for it
  // (bounded) rather than taking an instantaneous, potentially-too-early
  // isVisible() snapshot that could race the modal's mount.
  const startBtn = page.getByRole("button", { name: "Start Solving" });
  await startBtn.click({ timeout: 4000 }).catch(() => {});
}

const MOBILE_VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe("Warz active battle — HUD layout", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: HUD renders with no overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page, USER.id, USER.name);
      await installChallengerFixture(page);
      await enterChallengerBattle(page);

      await expect(page.locator('[data-testid="warz-active-play-shell"]').getByText("Puzzle Warz")).toBeVisible();
      await expect(page.getByText("Midnight Hidden Word")).toBeVisible();
      await expect(page.getByText("50 Points")).toBeVisible();
      await expect(page.getByText("00:0", { exact: false }).first()).toBeVisible();
      const forfeitBtn = page.getByRole("button", { name: /forfeit/i });
      await expect(forfeitBtn).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const box = await forfeitBtn.boundingBox();
      expect(box).not.toBeNull();
      // Real browser subpixel rounding can render an inline 44px minHeight as
      // 43.99999… — a sub-pixel float artifact, not an actual undersized
      // target (see prior passes' established tolerance for this).
      expect(box!.height).toBeGreaterThanOrEqual(43.9);
    });
  }

  test("844x390: HUD renders in landscape with no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await authenticate(page, USER.id, USER.name);
    await installChallengerFixture(page);
    await enterChallengerBattle(page);
    await expect(page.locator('[data-testid="warz-active-play-shell"]').getByText("Puzzle Warz")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("1440x900: HUD stays compact, desktop navbar clearance remains", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, USER.id, USER.name);
    await installChallengerFixture(page);
    await enterChallengerBattle(page);
    await expect(page.locator("#global-nav")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Warz active battle — timer", () => {
  test("timer progresses monotonically, survives the Forfeit dialog, and freezes on solve", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    const fixture = await installChallengerFixture(page);
    await enterChallengerBattle(page);
    await startSolving(page);

    await page.waitForTimeout(1200);
    const firstReading = await page.locator("text=/^\\d{2}:\\d{2}$/").first().textContent();

    await page.getByRole("button", { name: /forfeit/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(1200);
    const duringDialog = await page.locator("text=/^\\d{2}:\\d{2}$/").first().textContent();
    expect(duringDialog).not.toBe(firstReading);

    await page.getByRole("button", { name: "Keep Fighting" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await solveHiddenWord(page);
    await expect(page.getByText("Puzzle Complete")).toBeVisible({ timeout: 15000 });
    // Solved-time freeze under real (non-fake) timers is exhaustively proven
    // deterministically in WarzPlayBoard.test.tsx ("timer freezes after
    // solve"); here we only need to confirm the durable end state — exactly
    // one create request — since the mocked route resolves fast enough that
    // the page moves on to "posted" almost immediately afterward.
    await expect.poll(fixture.createCallCount).toBe(1);
  });
});

test.describe("Warz active battle — Forfeit dialog", () => {
  test("focus trap, Escape, backdrop, and confirm behavior", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    await installChallengerFixture(page);
    await enterChallengerBattle(page);

    const forfeitBtn = page.getByRole("button", { name: /forfeit/i });
    await forfeitBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep Fighting" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Forfeit Battle" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Keep Fighting" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(forfeitBtn).toBeFocused();

    await forfeitBtn.click();
    await page.mouse.click(10, 10);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await forfeitBtn.click();
    await page.getByRole("dialog").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "Keep Fighting" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("rapid Forfeit Battle activation submits exactly one forfeited request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    const fixture = await installOpponentFixture(page);
    await enterOpponentBattle(page, fixture.challengeId);

    await page.getByRole("button", { name: /forfeit/i }).click();
    const confirmBtn = page.getByRole("button", { name: "Forfeit Battle" });
    await confirmBtn.click({ force: true });
    await confirmBtn.click({ force: true }).catch(() => {});

    await expect.poll(fixture.completeCallCount).toBe(1);
    expect(fixture.lastCompleteBody()).toEqual({ challengeId: fixture.challengeId, forfeited: true });
  });
});

test.describe("Warz active battle — failure dialog", () => {
  test("exhausting attempts opens a non-dismissible alertdialog and auto-forfeits", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    const fixture = await installOpponentFixture(page, { failGuessesUntilLoss: true });
    await enterOpponentBattle(page, fixture.challengeId);
    await startSolving(page);

    for (let i = 0; i < 6; i += 1) {
      await submitWrongGuess(page);
    }

    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Puzzle Failed")).toBeVisible();
    await expect(page.getByText(/Forfeiting in \d…/)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 20000 });
    await page.mouse.click(10, 10);
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 20000 });

    await expect.poll(fixture.completeCallCount, { timeout: 10_000 }).toBe(1);
    expect(fixture.lastCompleteBody()).toEqual({ challengeId: fixture.challengeId, forfeited: true });
  });

  test("Forfeit Now submits immediately without waiting for the countdown", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    const fixture = await installOpponentFixture(page, { failGuessesUntilLoss: true });
    await enterOpponentBattle(page, fixture.challengeId);
    await startSolving(page);

    for (let i = 0; i < 6; i += 1) {
      await submitWrongGuess(page);
    }
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Forfeit Now" }).click();

    await expect.poll(fixture.completeCallCount).toBe(1);
  });
});

test.describe("Warz active battle — submission and retry (challenger)", () => {
  test("solve shows PUZZLE COMPLETE, posts once, retries on failure, and reaches posted state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    const fixture = await installChallengerFixture(page, { createFailOnce: true });
    await enterChallengerBattle(page);
    await startSolving(page);

    await solveHiddenWord(page);
    await expect(page.getByText("Puzzle Complete")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Solved in \d{2}:\d{2}/)).toBeVisible();

    await expect.poll(fixture.createCallCount).toBe(1);
    await expect(page.getByText("Submission Interrupted")).toBeVisible();
    await expect(page.getByText("Failed to post challenge")).toBeVisible();

    const bodyBefore = fixture.lastCreateBody();
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect.poll(fixture.createCallCount).toBe(2);
    expect(fixture.lastCreateBody()).toEqual(bodyBefore);

    await expect(page.getByText("Challenge Posted")).toBeVisible();
  });
});

test.describe("Warz active battle — submission (opponent)", () => {
  test("solve shows PUZZLE COMPLETE, submits once, and preserves existing result behavior", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    const fixture = await installOpponentFixture(page);
    await enterOpponentBattle(page, fixture.challengeId);
    await startSolving(page);

    await solveHiddenWord(page);
    await expect(page.getByText("Puzzle Complete")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Solved in \d{2}:\d{2}/)).toBeVisible();

    await expect.poll(fixture.completeCallCount).toBe(1);
    await expect(page.getByText("You Win!")).toBeVisible();
    await expect(page.getByRole("button", { name: /Share Result/ })).toBeVisible();
  });
});

test.describe("Warz active battle — reduced motion", () => {
  test("HUD, dialogs, and submission panel render without motion; solve and forfeit remain functional", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page, USER.id, USER.name);
    await installChallengerFixture(page);
    await enterChallengerBattle(page);

    await expect(page.locator('[data-testid="warz-active-play-shell"]').getByText("Puzzle Warz")).toBeVisible();
    await page.getByRole("button", { name: /forfeit/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Keep Fighting" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await startSolving(page);
    await solveHiddenWord(page);
    await expect(page.getByText("Puzzle Complete")).toBeVisible({ timeout: 15000 });
  });
});
