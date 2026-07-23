import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "e2e-user", username: "arena-player", name: "arena-player", totalPoints: 875 };
const PUZZLE = { id: "warz-setup-puzzle", title: "Midnight Sudoku", difficulty: "medium", puzzleType: "sudoku" };
const RIVAL_ONE = { id: "rival-one", username: "RivalOne", name: "RivalOne", image: null };
const RIVAL_TWO = { id: "rival-two", username: "RivalTwo", name: "RivalTwo", image: null };

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "arena@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

interface FixtureOptions {
  puzzleStatus?: number;
  userStatus?: number;
  eligible?: boolean;
  eligibleReason?: string;
  eligibleStatus?: number;
  balance?: number;
  createStatus?: number;
  createFailOnce?: boolean;
  searchResultsFor?: (q: string) => Array<typeof RIVAL_ONE>;
  holdInvite?: boolean;
  holdSearch?: boolean;
  selfInviteId?: string;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let searchCalls = 0;
  let createCalls = 0;
  let inviteCalls = 0;
  let lastCreateBody: Record<string, unknown> | null = null;
  const heldInviteRoutes: Array<{ fulfill: (body: unknown, status?: number) => Promise<void> }> = [];
  const heldSearchRoutes: Array<{ query: string; fulfill: (body: unknown, status?: number) => Promise<void> }> = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (path === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: USER.name, email: "arena@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (path === `/api/puzzles/${PUZZLE.id}` && method === "GET") {
      return fulfill(PUZZLE, options.puzzleStatus ?? 200);
    }

    if (path === "/api/user/info" && method === "GET") {
      return fulfill({ ...USER, totalPoints: options.balance ?? USER.totalPoints }, options.userStatus ?? 200);
    }

    if (path === "/api/warz/check-eligible" && method === "GET") {
      return fulfill(
        { eligible: options.eligible ?? true, reason: options.eligibleReason },
        options.eligibleStatus ?? 200
      );
    }

    if (path === "/api/users/search" && method === "GET") {
      searchCalls += 1;
      const q = url.searchParams.get("q") ?? "";
      if (options.holdSearch) {
        heldSearchRoutes.push({ query: q, fulfill });
        return;
      }
      const users = options.searchResultsFor ? options.searchResultsFor(q) : [RIVAL_ONE, RIVAL_TWO].filter((u) => u.username.toLowerCase().includes(q.toLowerCase()));
      return fulfill({ users });
    }

    if (path.startsWith("/api/users/") && method === "GET") {
      inviteCalls += 1;
      const id = decodeURIComponent(path.replace("/api/users/", ""));
      if (options.holdInvite) {
        heldInviteRoutes.push({ fulfill });
        return;
      }
      if (id === options.selfInviteId) return fulfill({ id: USER.id, name: USER.name });
      if (id === RIVAL_ONE.id) return fulfill(RIVAL_ONE);
      return fulfill({ error: "not found" }, 404);
    }

    if (path === "/api/warz/create" && method === "POST") {
      createCalls += 1;
      lastCreateBody = request.postDataJSON();
      if (options.createFailOnce && createCalls === 1) {
        return fulfill({ error: "Failed to post challenge" }, 500);
      }
      return fulfill({ success: true }, options.createStatus ?? 200);
    }

    return fulfill({});
  });

  return {
    searchCallCount: () => searchCalls,
    createCallCount: () => createCalls,
    inviteCallCount: () => inviteCalls,
    lastCreateBody: () => lastCreateBody,
    releaseInvite: async (index: number, body: unknown, status = 200) => {
      const held = heldInviteRoutes[index];
      if (!held) throw new Error(`No held invite request at index ${index}`);
      await held.fulfill(body, status);
    },
    heldSearchCount: () => heldSearchRoutes.length,
    releaseSearch: async (index: number, users: Array<typeof RIVAL_ONE>) => {
      const held = heldSearchRoutes[index];
      if (!held) throw new Error(`No held search request at index ${index}`);
      await held.fulfill({ users });
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

function setupUrl(invite?: string) {
  return invite ? `/warz/play/${PUZZLE.id}?invite=${encodeURIComponent(invite)}` : `/warz/play/${PUZZLE.id}`;
}

const MOBILE_VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe("Warz challenge setup — mobile coverage", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: setup renders and remains scrollable with no overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { level: 1, name: "Set Your Challenge" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Midnight Sudoku" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start Battle" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const startBox = await page.getByRole("button", { name: "Start Battle" }).boundingBox();
      expect(startBox).not.toBeNull();
      expect(startBox!.height).toBeGreaterThanOrEqual(48);

      const presetButtons = page.getByRole("button", { name: /^\d+$/ });
      const count = await presetButtons.count();
      for (let i = 0; i < count; i += 1) {
        const box = await presetButtons.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe("Warz challenge setup — wager flow", () => {
  test("presets, custom input, and validation drive the summary and Start Battle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("50 Points").first()).toBeVisible();
    await expect(page.getByText("100 Points").first()).toBeVisible();

    await page.getByRole("button", { name: "100", exact: true }).click();
    await expect(page.getByText("100 Points").first()).toBeVisible();
    await expect(page.getByText("200 Points").first()).toBeVisible();

    const customInput = page.getByLabel("Custom wager");
    await customInput.fill("5");
    await expect(page.getByText("Minimum wager is 10 Points.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Battle" })).toBeDisabled();

    await customInput.fill("501");
    await expect(page.getByText("Maximum wager is 500 Points.")).toBeVisible();

    await customInput.fill("75");
    await expect(page.getByRole("button", { name: "Start Battle" })).toBeEnabled();
    await expect(page.getByText("150 Points").first()).toBeVisible();
  });

  test("wager above the player's balance is invalid", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { balance: 60 });
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const customInput = page.getByLabel("Custom wager");
    await customInput.fill("100");
    await expect(page.getByText(/enough Points/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Battle" })).toBeDisabled();
  });
});

test.describe("Warz challenge setup — opponent search", () => {
  test("debounced search, selection, and removal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const searchInput = page.getByLabel("Invite a specific player");
    await searchInput.fill("Rival");

    // Debounce is 350ms — no request should have fired yet.
    await page.waitForTimeout(150);
    expect(fixture.searchCallCount()).toBe(0);

    await expect.poll(fixture.searchCallCount, { timeout: 2000 }).toBe(1);
    await expect(page.getByRole("option", { name: /RivalOne/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /RivalTwo/ })).toBeVisible();

    await page.getByRole("button", { name: /RivalOne/ }).click();
    await expect(page.getByText("Targeted challenge")).toBeVisible();
    await expect(page.getByText("@RivalOne").first()).toBeVisible();
    await expect(page.getByText("Only the selected player can accept this challenge.")).toBeVisible();

    await page.getByRole("button", { name: "Remove opponent" }).click();
    await expect(page.getByLabel("Invite a specific player")).toBeVisible();
    await expect(page.getByText("Any eligible player can accept this challenge.")).toBeVisible();
  });

  test("a stale search response arriving after a query change never overwrites the latest results", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { holdSearch: true });
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const searchInput = page.getByLabel("Invite a specific player");

    // 1-3. Enter "ri", wait for the first request, keep it pending.
    await searchInput.fill("ri");
    await expect.poll(fixture.heldSearchCount).toBe(1);

    // 4-5. Change the query to "riv" — old options must disappear immediately.
    await searchInput.fill("riv");
    await expect(page.getByRole("option", { name: /RivalOne/ })).toHaveCount(0);

    // 6-7. Resolve the first ("ri") request during the second query's
    // debounce window — its results must never appear.
    await fixture.releaseSearch(0, [RIVAL_ONE]);
    await page.waitForTimeout(100);
    await expect(page.getByRole("option", { name: /RivalOne/ })).toHaveCount(0);

    // 8-9. Allow the second ("riv") request to begin and resolve it with
    // different users — only the second query's results may appear.
    await expect.poll(fixture.heldSearchCount).toBe(2);
    await fixture.releaseSearch(1, [RIVAL_TWO]);
    await expect(page.getByRole("option", { name: /RivalTwo/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /RivalOne/ })).toHaveCount(0);
  });

  test("search failure shows retry and recovers", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    let failedOnce = false;
    // Registered after installFixture's broad "**/api/**" handler so this
    // more specific route is tried first (Playwright matches most-recently
    // registered handlers before earlier ones).
    await page.route("**/api/users/search**", async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "failed" }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ users: [RIVAL_ONE] }) });
    });
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByLabel("Invite a specific player").fill("Riv");
    await expect(page.getByText("We couldn’t search players.")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("option", { name: /RivalOne/ })).toBeVisible();
  });
});

test.describe("Warz challenge setup — targeted invite via query param", () => {
  test("resolves the invited opponent and locks the targeted state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto(setupUrl(RIVAL_ONE.id), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Targeted challenge")).toBeVisible();
    await expect(page.getByText("@RivalOne").first()).toBeVisible();
    await expect(page.getByText(RIVAL_ONE.id)).toHaveCount(0);
  });

  test("unavailable invited player shows a retryable error", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto(setupUrl("missing-user"), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("That player is unavailable.")).toBeVisible();
    const callsBefore = fixture.inviteCallCount();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(fixture.inviteCallCount).toBe(callsBefore + 1);
  });

  test("a query-param invite matching the authenticated player is rejected as a self-challenge", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { selfInviteId: USER.id });
    await page.goto(setupUrl(USER.id), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("You cannot challenge yourself.")).toBeVisible();
    await expect(page.getByText(USER.id)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start Battle" })).toBeDisabled();
    expect(fixture.createCallCount()).toBe(0);

    await page.getByRole("button", { name: "Choose another opponent" }).click();
    await expect(page.getByLabel("Invite a specific player")).toBeVisible();

    const searchInput = page.getByLabel("Invite a specific player");
    await searchInput.fill("Rival");
    await expect.poll(fixture.searchCallCount, { timeout: 2000 }).toBeGreaterThan(0);
    await page.getByRole("button", { name: /RivalOne/ }).click();
    await expect(page.getByText("@RivalOne").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Battle" })).toBeEnabled();
  });
});

test.describe("Warz challenge setup — start transition and submission", () => {
  test("Start Battle transitions into play and posts the challenge after a solve", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: "Start Battle" }).click();
    // "Battle Ready" is a brief (~200ms) transition state — it may have
    // already resolved to the play shell by the time we can poll for it, so
    // we only assert on the durable end state here.
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();

    expect(fixture.createCallCount()).toBe(0);
  });

  test("reduced motion skips the Battle Ready delay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: "Start Battle" }).click();
    await expect(page.locator('[data-testid="warz-active-play-shell"]')).toBeVisible();
  });
});

test.describe("Warz challenge setup — initial load failure", () => {
  test("shows error state and retry recovers", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { eligible: false, eligibleReason: "You have already attempted this puzzle." });
    await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("You have already attempted this puzzle.")).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to warz arena/i })).toHaveAttribute("href", "/warz");
  });
});

test.describe("Warz challenge setup — desktop", () => {
  const viewports = [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height}: setup clears navbar and stays centered`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto(setupUrl(), { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      // Warz play-mode routes never show the bottom nav; the top navbar is
      // CSS-hidden below 1032px and preserved on desktop (see AppChrome).
      if (viewport.width >= 1032) {
        await expect(page.locator("#global-nav")).toBeVisible();
      } else {
        await expect(page.locator("#global-nav")).not.toBeVisible();
      }
      await expect(page.locator(".pw-bottom-nav")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: "Set Your Challenge" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
