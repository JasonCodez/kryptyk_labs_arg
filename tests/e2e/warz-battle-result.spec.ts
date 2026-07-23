import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "result-challenger", username: "ResultPlayer", name: "Result Player", totalPoints: 875 };
const CHALLENGER = {
  id: "result-challenger",
  username: "AChallengerNameLongEnoughToExerciseResponsiveWrappingWithoutOverflow",
  name: "Result Player",
  image: null,
  level: 17,
};
const OPPONENT = {
  id: "result-opponent",
  username: "AnOpponentNameLongEnoughToExerciseResponsiveWrappingWithoutOverflow",
  name: "Arena Rival",
  image: null,
  level: 12,
};
const PUZZLE = {
  id: "result-hidden-word",
  title: "Midnight Hidden Word",
  difficulty: "medium",
  puzzleType: "word_crack",
  data: { wordLength: 5, maxGuesses: 6 },
};
const CORRECT_RESULT = ["C", "R", "A", "N", "E"].map((letter) => ({ letter, status: "correct" }));

interface ResultChallenge {
  id: string;
  status: string;
  challengerWager: number;
  expiresAt: string;
  challengerTime: number | null;
  opponentTime: number | null;
  winnerId: string | null;
  potPaid: boolean;
  completedAt: string | null;
  puzzle: typeof PUZZLE;
  challenger: typeof CHALLENGER;
  opponent: typeof OPPONENT | null;
  winner: { id: string; username?: string; name?: string } | null;
}

function completedChallenge(overrides: Partial<ResultChallenge> = {}): ResultChallenge {
  return {
    id: "result-challenge",
    status: "COMPLETED",
    challengerWager: 50,
    expiresAt: "2099-01-01T00:00:00.000Z",
    challengerTime: 42,
    opponentTime: 58,
    winnerId: CHALLENGER.id,
    potPaid: true,
    completedAt: "2026-07-23T00:00:00.000Z",
    puzzle: PUZZLE,
    challenger: CHALLENGER,
    opponent: OPPONENT,
    winner: CHALLENGER,
    ...overrides,
  };
}

function completionResponse(authoritative = completedChallenge()) {
  const winnerId = authoritative.winnerId;
  const outcome =
    winnerId === authoritative.challenger.id
      ? "challenger"
      : winnerId === authoritative.opponent?.id
        ? "opponent"
        : "split";
  return {
    challenge: authoritative,
    outcome,
    pot: authoritative.challengerWager * 2,
    winnerId,
  };
}

async function authenticate(page: Page, userId = USER.id) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: {
      sub: userId,
      id: userId,
      name: "Result Player",
      email: "result@example.test",
      role: "user",
      betaApproved: true,
    },
  });
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function dismissCookieBanner(page: Page) {
  await page.getByRole("button", { name: "Got it" }).click({ timeout: 2_000 }).catch(() => {});
}

interface RouteOptions {
  challenge: ResultChallenge;
  currentUserId?: string;
  complete?: (body: Record<string, unknown>, call: number) => { status?: number; body: unknown };
}

async function installRoutes(page: Page, options: RouteOptions) {
  let challengeCalls = 0;
  let userInfoCalls = 0;
  let acceptCalls = 0;
  let completeCalls = 0;
  let puzzleCalls = 0;
  const completionBodies: Record<string, unknown>[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(body),
      });

    if (path === "/api/auth/session") {
      return fulfill({
        user: { id: options.currentUserId ?? USER.id, name: USER.name },
        expires: "2099-01-01T00:00:00.000Z",
      });
    }
    if (path === `/api/warz/${options.challenge.id}` && method === "GET") {
      challengeCalls += 1;
      return fulfill({ challenge: options.challenge });
    }
    if (path === "/api/user/info" && method === "GET") {
      userInfoCalls += 1;
      return fulfill({ ...USER, id: options.currentUserId ?? USER.id });
    }
    if (path === "/api/warz/accept" && method === "POST") {
      acceptCalls += 1;
      return fulfill({});
    }
    if (path === `/api/puzzles/${PUZZLE.id}/word_crack` && method === "POST") {
      puzzleCalls += 1;
      return fulfill({ result: CORRECT_RESULT, solved: true, xpGained: 0 });
    }
    if (path === "/api/warz/complete" && method === "POST") {
      completeCalls += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      completionBodies.push(body);
      const response = options.complete?.(body, completeCalls) ?? { body: completionResponse() };
      return fulfill(response.body, response.status ?? 200);
    }
    return fulfill({});
  });

  return {
    challengeCalls: () => challengeCalls,
    userInfoCalls: () => userInfoCalls,
    acceptCalls: () => acceptCalls,
    completeCalls: () => completeCalls,
    puzzleCalls: () => puzzleCalls,
    completionBodies: () => completionBodies,
  };
}

async function openResult(page: Page, challenge: ResultChallenge, currentUserId = USER.id) {
  await authenticate(page, currentUserId);
  const traffic = await installRoutes(page, { challenge, currentUserId });
  await page.goto(`/warz/challenge/${challenge.id}`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
  await expect(page.getByTestId("warz-battle-result")).toBeVisible();
  return traffic;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

const RESTORATION_CASES = [
  {
    name: "challenger victory",
    viewer: CHALLENGER.id,
    challenge: completedChallenge(),
    headline: "Victory",
    economy: "POT CLAIMED",
    times: ["00:42", "00:58"],
  },
  {
    name: "challenger defeat",
    viewer: CHALLENGER.id,
    challenge: completedChallenge({ winnerId: OPPONENT.id, winner: OPPONENT }),
    headline: "Defeat",
    economy: "WAGER LOST",
    times: ["00:42", "00:58"],
  },
  {
    name: "opponent victory",
    viewer: OPPONENT.id,
    challenge: completedChallenge({ winnerId: OPPONENT.id, winner: OPPONENT }),
    headline: "Victory",
    economy: "POT CLAIMED",
    times: ["00:42", "00:58"],
  },
  {
    name: "opponent defeat",
    viewer: OPPONENT.id,
    challenge: completedChallenge(),
    headline: "Defeat",
    economy: "WAGER LOST",
    times: ["00:42", "00:58"],
  },
  {
    name: "victory by opponent forfeit",
    viewer: CHALLENGER.id,
    challenge: completedChallenge({ opponentTime: 999999 }),
    headline: "Victory by Forfeit",
    economy: "POT CLAIMED",
    times: ["00:42", "Forfeit"],
  },
  {
    name: "defeat by own forfeit",
    viewer: OPPONENT.id,
    challenge: completedChallenge({ opponentTime: 999999 }),
    headline: "Defeat by Forfeit",
    economy: "WAGER LOST",
    times: ["00:42", "Forfeit"],
  },
  {
    name: "both-forfeited draw",
    viewer: CHALLENGER.id,
    challenge: completedChallenge({
      challengerTime: 999999,
      opponentTime: 999999,
      winnerId: null,
      winner: null,
    }),
    headline: "Draw",
    economy: "WAGER RETURNED",
    times: ["Forfeit"],
  },
] as const;

test.describe("Warz battle result — completed restoration", () => {
  for (const scenario of RESTORATION_CASES) {
    test(scenario.name, async ({ page }) => {
      await authenticate(page, scenario.viewer);
      const traffic = await installRoutes(page, {
        challenge: scenario.challenge,
        currentUserId: scenario.viewer,
      });
      await page.goto(`/warz/challenge/${scenario.challenge.id}`, { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByTestId("warz-battle-result")).toBeVisible();
      const result = page.getByTestId("warz-battle-result");
      await expect(page.getByRole("heading", { name: scenario.headline, exact: true })).toBeVisible();
      await expect(page.getByText(scenario.economy)).toBeVisible();
      for (const time of scenario.times) await expect(page.getByText(time, { exact: true }).first()).toBeVisible();
      await expect(result.getByText("Winner", { exact: true })).toHaveCount(scenario.headline === "Draw" ? 0 : 1);
      await expect(page.getByRole("button", { name: "Return to Warz" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Browse Puzzles" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible();
      await expect(page.getByText(/battle scoreboard/i)).toBeVisible();
      await expect(page.getByText("Midnight Hidden Word")).toBeVisible();
      await expect(page.getByTestId("warz-active-play-shell")).toHaveCount(0);
      await expect(page.getByTestId("warz-battle-briefing")).toHaveCount(0);
      expect(traffic.challengeCalls()).toBe(1);
      expect(traffic.userInfoCalls()).toBeGreaterThanOrEqual(1);
      expect(traffic.acceptCalls()).toBe(0);
      expect(traffic.completeCalls()).toBe(0);
    });
  }

  test("neutral viewer sees a winner without a viewer-relative claim", async ({ page }) => {
    await authenticate(page, "neutral-viewer");
    const winnerTraffic = await installRoutes(page, {
      challenge: completedChallenge(),
      currentUserId: "neutral-viewer",
    });
    await page.goto("/warz/challenge/result-challenge", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Battle Complete" })).toBeVisible();
    await expect(page.getByText("TOTAL POT")).toBeVisible();
    expect(winnerTraffic.completeCalls()).toBe(0);
  });

  test("neutral viewer sees an authoritative draw", async ({ page }) => {
    await authenticate(page, "neutral-viewer");
    const draw = completedChallenge({ id: "neutral-draw", winnerId: null, winner: null, challengerTime: 42, opponentTime: 42 });
    await installRoutes(page, { challenge: draw, currentUserId: "neutral-viewer" });
    await page.goto("/warz/challenge/neutral-draw", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Battle Complete" })).toBeVisible();
    await expect(page.getByText(/ended in a draw/i)).toBeVisible();
  });

  test("malformed completed data is unavailable and cannot be shared", async ({ page }) => {
    await authenticate(page, "neutral-viewer");
    const malformed = completedChallenge({ id: "malformed", opponent: null, winnerId: null, winner: null });
    await installRoutes(page, { challenge: malformed, currentUserId: "neutral-viewer" });
    await page.goto("/warz/challenge/malformed", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Result Unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share Result" })).toHaveCount(0);
  });
});

test.describe("Warz battle result — immediate completion", () => {
  test("real Hidden Word solve transitions from the active board without refetch", async ({ page }) => {
    await authenticate(page, OPPONENT.id);
    const initial = completedChallenge({
      status: "IN_PROGRESS",
      challengerTime: 58,
      opponentTime: null,
      winnerId: null,
      winner: null,
      potPaid: false,
      completedAt: null,
    });
    const completed = completedChallenge({
      challengerTime: 58,
      opponentTime: 42,
      winnerId: OPPONENT.id,
      winner: OPPONENT,
    });
    const traffic = await installRoutes(page, {
      challenge: initial,
      currentUserId: OPPONENT.id,
      complete: () => ({ body: completionResponse(completed) }),
    });
    await page.goto(`/warz/challenge/${initial.id}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "Play Battle" }).click();
    await expect(page.getByTestId("warz-active-play-shell")).toBeVisible();
    await page.getByRole("button", { name: "Start Solving" }).click({ timeout: 4_000 }).catch(() => {});
    for (const letter of ["C", "R", "A", "N", "E"]) await page.keyboard.press(letter);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("00:58", { exact: true })).toBeVisible();
    await expect(page.getByText("00:42", { exact: true })).toBeVisible();
    await expect(page.getByText("POT CLAIMED")).toBeVisible();
    expect(traffic.completeCalls()).toBe(1);
    expect(traffic.completionBodies()).toHaveLength(1);
    expect(traffic.completionBodies()[0]).toEqual({
      challengeId: initial.id,
      completionSeconds: expect.any(Number),
    });
    expect(traffic.challengeCalls()).toBe(1);
    expect(traffic.puzzleCalls()).toBe(1);
  });

  test("forfeit posts once and renders Defeat by Forfeit", async ({ page }) => {
    await authenticate(page, OPPONENT.id);
    const initial = completedChallenge({
      status: "IN_PROGRESS",
      challengerTime: 42,
      opponentTime: null,
      winnerId: null,
      winner: null,
      potPaid: false,
      completedAt: null,
    });
    const forfeited = completedChallenge({ challengerTime: 42, opponentTime: 999999 });
    const traffic = await installRoutes(page, {
      challenge: initial,
      currentUserId: OPPONENT.id,
      complete: () => ({ body: completionResponse(forfeited) }),
    });
    await page.goto(`/warz/challenge/${initial.id}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "Play Battle" }).click();
    await page.getByRole("button", { name: "Start Solving" }).click({ timeout: 4_000 }).catch(() => {});
    await page.getByRole("button", { name: /forfeit/i }).click();
    const confirm = page.getByRole("button", { name: "Forfeit Battle" });
    await confirm.click({ force: true });
    await confirm.click({ force: true }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Defeat by Forfeit" })).toBeVisible();
    await expect(page.getByText("Forfeit", { exact: true })).toBeVisible();
    await expect(page.getByText("WAGER LOST")).toBeVisible();
    expect(traffic.completeCalls()).toBe(1);
    expect(traffic.completionBodies()).toEqual([{ challengeId: initial.id, forfeited: true }]);
  });

  test("failed completion is honest and an exact-body retry succeeds", async ({ page }) => {
    await authenticate(page, OPPONENT.id);
    const initial = completedChallenge({
      status: "IN_PROGRESS",
      challengerTime: 58,
      opponentTime: null,
      winnerId: null,
      winner: null,
      potPaid: false,
      completedAt: null,
    });
    const completed = completedChallenge({ challengerTime: 58, opponentTime: 42, winnerId: OPPONENT.id, winner: OPPONENT });
    const traffic = await installRoutes(page, {
      challenge: initial,
      currentUserId: OPPONENT.id,
      complete: (_body, call) =>
        call === 1
          ? { status: 500, body: { error: "Unable to finalize this battle" } }
          : { body: completionResponse(completed) },
    });
    await page.goto(`/warz/challenge/${initial.id}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "Play Battle" }).click();
    await page.getByRole("button", { name: "Start Solving" }).click({ timeout: 4_000 }).catch(() => {});
    for (const letter of ["C", "R", "A", "N", "E"]) await page.keyboard.press(letter);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Result Not Recorded" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Unable to finalize this battle")).toBeVisible();
    await expect(page.getByRole("button", { name: "Share Result" })).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Retry Submission" });
    await retry.click({ force: true });
    await retry.click({ force: true }).catch(() => {});
    await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
    expect(traffic.completeCalls()).toBe(2);
    expect(traffic.completionBodies()[1]).toEqual(traffic.completionBodies()[0]);
  });
});

test.describe("Warz battle result — sharing", () => {
  test("native share receives exact data once and clears success feedback", async ({ page }) => {
    await page.addInitScript(() => {
      const calls: ShareData[] = [];
      Object.defineProperty(window, "__shareCalls", { configurable: true, value: calls });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: (data: ShareData) => {
          calls.push(data);
          return new Promise((resolve) => setTimeout(resolve, 200));
        },
      });
    });
    await openResult(page, completedChallenge());
    await page.evaluate(() => {
      const share = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Share Result"));
      share?.click();
      share?.click();
    });
    await expect(page.getByRole("button", { name: "Shared" })).toBeVisible();
    await expect(page.getByText("Result shared.", { exact: true })).toBeVisible();
    const calls = await page.evaluate(() => (window as typeof window & { __shareCalls: ShareData[] }).__shareCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0].title).toBe("Puzzle Warz Battle Result");
    expect(calls[0].text).toContain("42s vs 58s");
    expect(calls[0].url).toBe("http://localhost:3000/warz/challenge/result-challenge");
    await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("Result shared.", { exact: true })).toHaveCount(0);
  });

  for (const scenario of [
    {
      name: "opponent victory",
      challenge: completedChallenge({
        challengerTime: 66,
        opponentTime: 42,
        winnerId: OPPONENT.id,
        winner: OPPONENT,
      }),
      expected: "42s vs 1m 6s",
      reversed: "1m 6s vs 42s",
    },
    {
      name: "opponent defeat",
      challenge: completedChallenge({
        challengerTime: 42,
        opponentTime: 66,
        winnerId: CHALLENGER.id,
        winner: CHALLENGER,
      }),
      expected: "1m 6s vs 42s",
      reversed: "42s vs 1m 6s",
    },
  ] as const) {
    test(`${scenario.name} native share is viewer-relative`, async ({ page }) => {
      await page.addInitScript(() => {
        const calls: ShareData[] = [];
        Object.defineProperty(window, "__shareCalls", { configurable: true, value: calls });
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: (data: ShareData) => {
            calls.push(data);
            return Promise.resolve();
          },
        });
      });
      await openResult(page, scenario.challenge, OPPONENT.id);
      await page.getByRole("button", { name: "Share Result" }).click();
      await expect(page.getByText("Result shared.", { exact: true })).toBeVisible();
      const calls = await page.evaluate(() => (window as typeof window & { __shareCalls: ShareData[] }).__shareCalls);
      expect(calls).toHaveLength(1);
      expect(calls[0].text).toContain(scenario.expected);
      expect(calls[0].text).not.toContain(scenario.reversed);
    });
  }

  test("AbortError does not invoke clipboard fallback", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "__clipboardCalls", { configurable: true, value: [] as string[] });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: () => Promise.reject(new DOMException("cancelled", "AbortError")),
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: (text: string) => (window as typeof window & { __clipboardCalls: string[] }).__clipboardCalls.push(text) },
      });
    });
    await openResult(page, completedChallenge());
    await page.getByRole("button", { name: "Share Result" }).click();
    await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & { __clipboardCalls: string[] }).__clipboardCalls)).toHaveLength(0);
  });

  test("native failure falls back to one clipboard copy including the URL once", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "__clipboardCalls", { configurable: true, value: [] as string[] });
      Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new Error("unavailable")) });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            (window as typeof window & { __clipboardCalls: string[] }).__clipboardCalls.push(text);
            return Promise.resolve();
          },
        },
      });
    });
    await openResult(page, completedChallenge());
    await page.getByRole("button", { name: "Share Result" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    await expect(page.getByText("Result copied to clipboard.", { exact: true })).toBeVisible();
    const calls = await page.evaluate(() => (window as typeof window & { __clipboardCalls: string[] }).__clipboardCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0].match(/http:\/\/localhost:3000\/warz\/challenge\/result-challenge/g)).toHaveLength(1);
  });

  test("clipboard failure shows the recoverable error", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
    });
    await openResult(page, completedChallenge());
    await page.getByRole("button", { name: "Share Result" }).click();
    await expect(page.getByText("We couldn’t share this result.")).toBeVisible();
  });
});

const VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
];

test.describe("Warz battle result — responsive geometry", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openResult(page, completedChallenge());
      await expectNoHorizontalOverflow(page);
      await expect(page.getByTestId("warz-battle-result")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
      await expect(page.getByText("Midnight Hidden Word")).toBeVisible();
      await expect(page.getByText(/battle scoreboard/i)).toBeVisible();
      await expect(page.getByTestId("result-economy")).toBeVisible();
      await expect(page.getByTestId("result-actions")).toBeVisible();
      await expect(page.locator('[data-testid="result-player-challenger"]')).toBeVisible();
      await expect(page.locator('[data-testid="result-player-opponent"]')).toBeVisible();
      await expect(page.locator("#mobile-bottom-nav")).toHaveCount(0);
      await page.waitForTimeout(400);

      for (const [name, minimum] of [["Share Result", 48], ["Return to Warz", 48], ["Browse Puzzles", 44]] as const) {
        const box = await page.getByRole("button", { name }).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(minimum - 0.1);
      }
    });
  }

  test("reduced motion keeps result actions immediate and functional", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openResult(page, completedChallenge());
    const result = page.getByTestId("warz-battle-result");
    await expect(result).toBeVisible();
    await expect(page.getByTestId("result-actions")).toBeVisible();
    await expect(page.getByRole("button", { name: "Share Result" })).toBeEnabled();
    await expect(result).toHaveCSS("transform", "none");
  });
});
