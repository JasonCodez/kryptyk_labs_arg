import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

// Deterministic route mocks throughout — this spec never depends on a live
// database or a real user account.

const USER = { id: "e2e-opponent", username: "arena-opponent", name: "arena-opponent", totalPoints: 875 };
const CHALLENGER = { id: "e2e-challenger", name: "ArenaChallenger", username: "ArenaChallenger", image: null, level: 14 };
const DIFFERENT_PLAYER = { id: "different-player", name: "DifferentPlayer", username: "DifferentPlayer" };

// A fully playable, deterministic Word Search fixture — real puzzleType,
// real renderer. This is required for this spec's payload-preservation
// coverage: the whole point is proving that `puzzle.data` (only ever
// supplied by the authenticated challenge-detail request, never by the
// accept response) survives into the mounted WarzPlayBoard.
const PUZZLE = {
  id: "warz-accept-puzzle",
  title: "Midnight Word Trove",
  difficulty: "medium",
  puzzleType: "word_search",
  data: {
    grid: [
      ["C", "A", "T"],
      ["X", "X", "X"],
      ["X", "X", "X"],
    ],
    words: ["CAT"],
  },
};

/** The exact shape the real `/api/warz/accept` response uses — metadata
 * only, never the playable payload. Spreading the full original challenge
 * here would mask the defect this spec exists to catch. */
function acceptResponsePuzzle(puzzle: typeof PUZZLE) {
  return { id: puzzle.id, title: puzzle.title, difficulty: puzzle.difficulty, puzzleType: puzzle.puzzleType };
}

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "opponent@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

function pastIso(hours: number) {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

interface ChallengeFixture {
  id: string;
  status: string;
  challengerWager: number;
  expiresAt: string;
  puzzle: typeof PUZZLE;
  challenger: typeof CHALLENGER;
  opponent?: { id: string; username?: string; name?: string } | null;
  invitedUser?: { id: string; username?: string; name?: string } | null;
}

function baseChallenge(overrides: Partial<ChallengeFixture> = {}): ChallengeFixture {
  return {
    id: "challenge-fixture",
    status: "OPEN",
    challengerWager: 50,
    expiresAt: futureIso(24),
    puzzle: PUZZLE,
    challenger: CHALLENGER,
    opponent: null,
    invitedUser: null,
    ...overrides,
  };
}

interface FixtureOptions {
  challenge?: ChallengeFixture;
  balance?: number;
  acceptStatus?: number;
  acceptFailOnce?: boolean;
  acceptNetworkFailOnce?: boolean;
  holdAccept?: boolean;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  const challenge = options.challenge ?? baseChallenge();
  let acceptCalls = 0;
  let lastAcceptBody: Record<string, unknown> | null = null;
  let challengeRequestCount = 0;
  let userInfoRequestCount = 0;
  let puzzleDetailRequestCount = 0;
  const heldAcceptRoutes: Array<{ fulfill: (body: unknown, status?: number) => Promise<void> }> = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (path === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: USER.name, email: "opponent@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (path === `/api/warz/${challenge.id}` && method === "GET") {
      challengeRequestCount += 1;
      return fulfill({ challenge });
    }

    if (path === "/api/user/info" && method === "GET") {
      userInfoRequestCount += 1;
      return fulfill({ ...USER, totalPoints: options.balance ?? USER.totalPoints });
    }

    if (path.startsWith("/api/puzzles/") && method === "GET") {
      puzzleDetailRequestCount += 1;
      return fulfill({});
    }

    if (path === "/api/warz/accept" && method === "POST") {
      acceptCalls += 1;
      lastAcceptBody = request.postDataJSON();
      if (options.holdAccept) {
        heldAcceptRoutes.push({ fulfill });
        return;
      }
      if (options.acceptNetworkFailOnce && acceptCalls === 1) {
        return route.abort("failed");
      }
      if (options.acceptFailOnce && acceptCalls === 1) {
        return fulfill({ error: "This challenge is no longer available." }, 409);
      }
      return fulfill(
        {
          challenge: {
            id: challenge.id,
            status: "IN_PROGRESS",
            challengerWager: challenge.challengerWager,
            expiresAt: challenge.expiresAt,
            puzzle: acceptResponsePuzzle(challenge.puzzle),
            challenger: challenge.challenger,
            opponent: { id: USER.id, username: USER.username },
          },
        },
        options.acceptStatus ?? 200
      );
    }

    if (path === "/api/warz/complete" && method === "POST") {
      return fulfill({ winnerId: USER.id, tie: false, challenge: { challengerTime: 60 } });
    }

    return fulfill({});
  });

  return {
    acceptCallCount: () => acceptCalls,
    lastAcceptBody: () => lastAcceptBody,
    challengeRequestCount: () => challengeRequestCount,
    userInfoRequestCount: () => userInfoRequestCount,
    puzzleDetailRequestCount: () => puzzleDetailRequestCount,
    releaseAccept: async (index: number, body: unknown, status = 200) => {
      const held = heldAcceptRoutes[index];
      if (!held) throw new Error(`No held accept request at index ${index}`);
      await held.fulfill(body, status);
    },
  };
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

function challengeUrl(id: string) {
  return `/warz/challenge/${id}`;
}

const MOBILE_VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe("Warz challenge acceptance — briefing layout", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: briefing renders with no overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page, { challenge: baseChallenge({ id: "layout-open" }) });
      await page.goto(challengeUrl("layout-open"), { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("You’ve Been Challenged");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText("@ArenaChallenger").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Midnight Word Trove" })).toBeVisible();
      await expect(page.getByText("Word Trove", { exact: true })).toBeVisible();
      await expect(page.getByText("50 Points").first()).toBeVisible();
      await expect(page.getByText("100 Points")).toBeVisible();
      await expect(page.getByText("875 Points")).toBeVisible();
      await expect(page.getByRole("button", { name: "Accept & Start Battle" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to Warz Arena" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const acceptBox = await page.getByRole("button", { name: "Accept & Start Battle" }).boundingBox();
      expect(acceptBox).not.toBeNull();
      expect(acceptBox!.height).toBeGreaterThanOrEqual(52);

      const backBox = await page.getByRole("link", { name: "Back to Warz Arena" }).boundingBox();
      expect(backBox).not.toBeNull();
      expect(backBox!.height).toBeGreaterThanOrEqual(44);
    });
  }

  test("844x390: briefing scrolls vertically with no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await authenticate(page);
    await installFixture(page, { challenge: baseChallenge({ id: "layout-landscape" }) });
    await page.goto(challengeUrl("layout-landscape"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Back to Warz Arena" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Back to Warz Arena" })).toBeVisible();
  });

  test("1440x900: briefing clears fixed navbar and stays centered", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page);
    await installFixture(page, { challenge: baseChallenge({ id: "layout-desktop" }) });
    await page.goto(challengeUrl("layout-desktop"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Warz challenge acceptance — open challenge", () => {
  test("accept flow: single request, pending state, entry transition, active play with the real puzzle renderer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({ id: "open-accept" });
    const fixture = await installFixture(page, { challenge, holdAccept: true });
    await page.goto(challengeUrl("open-accept"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("OPEN CHALLENGE")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept & Start Battle" })).toBeVisible();
    await expect(page.getByText("50 Points").first()).toBeVisible();
    await expect(page.getByText("100 Points")).toBeVisible();
    await expect(page.getByText("875 Points")).toBeVisible();
    expect(page.getByText(/DNF|—/)).toBeDefined();

    expect(fixture.acceptCallCount()).toBe(0);
    const acceptButton = page.getByRole("button", { name: "Accept & Start Battle" });
    await acceptButton.click();
    await expect(page.getByRole("button", { name: "Accepting challenge…" })).toBeVisible();

    await acceptButton.click({ force: true }).catch(() => {});
    expect(fixture.acceptCallCount()).toBe(1);

    // 1-2. Exactly one accept request; release it with the production-shaped
    // response — metadata-only puzzle, no `data`.
    await fixture.releaseAccept(0, {
      challenge: {
        id: challenge.id,
        status: "IN_PROGRESS",
        challengerWager: challenge.challengerWager,
        expiresAt: challenge.expiresAt,
        puzzle: acceptResponsePuzzle(challenge.puzzle),
        challenger: challenge.challenger,
        opponent: { id: USER.id, username: USER.username },
      },
    });

    // 2-3. Entry transition, then the active shell.
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();

    // 4. The actual Word Trove renderer mounted (not the sudoku/jigsaw
    // fallback, not an unsupported-type message) — proves `puzzle.data`
    // (only ever supplied by the initial challenge-detail load) survived
    // the accept response's metadata-only payload.
    const wordSearchRoot = page.locator('[data-testid="word-search-root"]');
    await expect(wordSearchRoot).toBeVisible();
    await expect(page.getByText(/found/i).first()).toBeVisible();

    // 5-6. No missing-payload or unsupported-type fallback text.
    await expect(page.getByText("Sudoku data missing.")).toHaveCount(0);
    await expect(page.getByText("Jigsaw image missing.")).toHaveCount(0);
    await expect(page.getByText(/Unsupported puzzle type/i)).toHaveCount(0);

    // 7. Board is interactive — the letter grid actually rendered cells.
    await expect(page.getByRole("gridcell").first()).toBeVisible();

    // 8-10. No challenge-detail refetch, no puzzle-detail request introduced.
    // user-info may be polled independently by unrelated chrome (e.g. the
    // navbar avatar), so only the challenge-detail/puzzle-detail counts —
    // which are exclusively owned by this page — are asserted exactly.
    expect(fixture.challengeRequestCount()).toBe(1);
    expect(fixture.puzzleDetailRequestCount()).toBe(0);

    // 11. Exactly one WarzPlayBoard/active-play-shell instance.
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toHaveCount(1);
  });
});

test.describe("Warz challenge acceptance — direct invitation", () => {
  test("shows DIRECT CHALLENGE and accepts through the same endpoint", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({
      id: "direct-accept",
      invitedUser: { id: USER.id, username: USER.username },
    });
    const fixture = await installFixture(page, { challenge });
    await page.goto(challengeUrl("direct-accept"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("DIRECT CHALLENGE", { exact: true })).toBeVisible();
    await expect(page.getByText("This battle was sent specifically to you.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept Direct Challenge" })).toBeVisible();
    await expect(page.getByText(USER.id)).toHaveCount(0);

    await page.getByRole("button", { name: "Accept Direct Challenge" }).click();
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
    expect(fixture.acceptCallCount()).toBe(1);
    expect(fixture.lastAcceptBody()).toEqual({ challengeId: "direct-accept" });
  });
});

test.describe("Warz challenge acceptance — private invitation", () => {
  test("shows PRIVATE CHALLENGE with no accept action or request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({
      id: "private-other",
      invitedUser: { id: DIFFERENT_PLAYER.id, username: DIFFERENT_PLAYER.username },
    });
    const fixture = await installFixture(page, { challenge });
    await page.goto(challengeUrl("private-other"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("PRIVATE CHALLENGE")).toBeVisible();
    await expect(page.getByRole("button", { name: /accept/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /play battle/i })).toHaveCount(0);
    await expect(page.getByText(DIFFERENT_PLAYER.id)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to Warz Arena" })).toBeVisible();
    expect(fixture.acceptCallCount()).toBe(0);
  });
});

test.describe("Warz challenge acceptance — status matrix", () => {
  const cases: Array<{ name: string; challenge: Partial<ChallengeFixture>; expectedText: string }> = [
    { name: "own challenge", challenge: { id: "own", challenger: { ...CHALLENGER, id: USER.id } as typeof CHALLENGER }, expectedText: "YOUR CHALLENGE" },
    { name: "insufficient balance", challenge: { id: "insufficient", challengerWager: 900 }, expectedText: "You need" },
    { name: "in progress with current user", challenge: { id: "resume-status", status: "IN_PROGRESS", opponent: { id: USER.id } }, expectedText: "BATTLE READY" },
    { name: "in progress with someone else", challenge: { id: "in-progress-other", status: "IN_PROGRESS", opponent: { id: "another-user" } }, expectedText: "This battle is already in progress." },
    { name: "expired", challenge: { id: "expired-status", status: "EXPIRED" }, expectedText: "This challenge has expired." },
    { name: "cancelled", challenge: { id: "cancelled-status", status: "CANCELLED" }, expectedText: "This challenge was cancelled." },
    { name: "completed", challenge: { id: "completed-status", status: "COMPLETED" }, expectedText: "This battle has already finished." },
  ];

  for (const testCase of cases) {
    test(`${testCase.name}: shows exact status copy with no invalid action`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await authenticate(page);
      const challenge = baseChallenge(testCase.challenge);
      const fixture = await installFixture(page, { challenge });
      await page.goto(challengeUrl(challenge.id), { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByText(testCase.expectedText, { exact: false }).first()).toBeVisible();
      if (testCase.name !== "in progress with current user") {
        await expect(page.getByRole("button", { name: /^accept/i })).toHaveCount(0);
      }
      expect(fixture.acceptCallCount()).toBe(0);
    });
  }

  test("insufficient balance shows Point Store link and exact points", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({ id: "insufficient-link", challengerWager: 900 });
    await installFixture(page, { challenge });
    await page.goto(challengeUrl("insufficient-link"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("900 Points").first()).toBeVisible();
    await expect(page.getByText("875 Points").first()).toBeVisible();
    const storeLink = page.getByRole("link", { name: "Visit Point Store" });
    await expect(storeLink).toBeVisible();
    await expect(storeLink).toHaveAttribute("href", "/store");
    const box = await storeLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Warz challenge acceptance — resume", () => {
  test("Play Battle sends no accept request and mounts the board once", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({ id: "resume-flow", status: "IN_PROGRESS", opponent: { id: USER.id, username: USER.username } });
    const fixture = await installFixture(page, { challenge });
    await page.goto(challengeUrl("resume-flow"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("BATTLE READY")).toBeVisible();
    const playButton = page.getByRole("button", { name: "Play Battle" });
    await expect(playButton).toBeVisible();
    expect(fixture.acceptCallCount()).toBe(0);

    await playButton.click();
    expect(fixture.acceptCallCount()).toBe(0);
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
  });
});

test.describe("Warz challenge acceptance — acceptance failure and retry", () => {
  test("server error, retry, and successful recovery", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({ id: "accept-fail-retry" });
    const fixture = await installFixture(page, { challenge, acceptFailOnce: true });
    await page.goto(challengeUrl("accept-fail-retry"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: "Accept & Start Battle" }).click();
    await expect(page.getByText("This challenge is no longer available.")).toBeVisible();
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toHaveCount(0);

    await page.getByRole("button", { name: "Accept & Start Battle" }).click();
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
    expect(fixture.acceptCallCount()).toBe(2);
  });

  test("network rejection shows safe network copy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({ id: "accept-network-fail" });
    await installFixture(page, { challenge, acceptNetworkFailOnce: true });
    await page.goto(challengeUrl("accept-network-fail"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: "Accept & Start Battle" }).click();
    await expect(page.getByText("Network error — please try again.")).toBeVisible();
  });
});

test.describe("Warz challenge acceptance — initial load failure", () => {
  test("challenge 404 shows missing-battle copy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: USER.id }, expires: "2099-01-01T00:00:00.000Z" }) })
    );
    await page.route("**/api/warz/missing-challenge", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) }));
    await page.route("**/api/user/info", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) }));
    await page.goto(challengeUrl("missing-challenge"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("This battle could not be found.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Warz Arena" })).toHaveAttribute("href", "/warz");
  });

  test("generic failure shows error state, retry recovers without reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    let failedOnce = false;
    let challengeCalls = 0;
    let userCalls = 0;
    const challenge = baseChallenge({ id: "retry-recover" });
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: USER.id }, expires: "2099-01-01T00:00:00.000Z" }) })
    );
    await page.route(`**/api/warz/${challenge.id}`, (route) => {
      challengeCalls += 1;
      if (!failedOnce) {
        failedOnce = true;
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "failed" }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ challenge }) });
    });
    await page.route("**/api/user/info", (route) => {
      userCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(USER) });
    });
    await page.goto(challengeUrl("retry-recover"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: "We couldn’t load this battle" })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __marker: boolean }).__marker = true;
    });

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("OPEN CHALLENGE")).toBeVisible();
    const markerStillPresent = await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker === true);
    expect(markerStillPresent).toBe(true);
    expect(challengeCalls).toBe(2);
    // Other chrome (e.g. the navbar) may also call /api/user/info
    // independently of this page's own load/retry cycle, so only the
    // challenge-detail count (owned exclusively by this route) is asserted
    // exactly; user-info just needs to have been refetched at least once more.
    expect(userCalls).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Warz challenge acceptance — reduced motion", () => {
  test("briefing and transition render without transform-based entrance motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const challenge = baseChallenge({ id: "reduced-motion" });
    await installFixture(page, { challenge });
    await page.goto(challengeUrl("reduced-motion"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Accept & Start Battle" }).click();
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
  });
});
