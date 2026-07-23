import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

// Deterministic route mocks throughout — this spec never depends on a live
// database, real rankings, or real follow relationships.

const USER = { id: "e2e-lb-user", name: "LeaderboardTester" };

const GLOBAL_ENTRIES = [
  { userId: "u1", userName: "Aurora Nightingale-Whitcombe-Fairweather", userImage: null, activeFlair: "none", isPremium: true, totalPoints: 9800, puzzlesSolved: 120, rank: 1 },
  { userId: "u2", userName: "Beatrix", userImage: "/images/some-avatar.png", activeFlair: "⭐", isPremium: false, totalPoints: 7200, puzzlesSolved: 95, rank: 2 },
  { userId: "u3", userName: "Cassius", userImage: null, activeFlair: "none", isPremium: false, totalPoints: 5400, puzzlesSolved: 70, rank: 3 },
];
const GLOBAL_USER_RANK = { userId: USER.id, userName: USER.name, userImage: null, activeFlair: "none", totalPoints: 1234, puzzlesSolved: 22, rank: 42 };

const WEEKLY_ENTRIES = [
  { userId: "u1", userName: "Aurora", userImage: null, activeFlair: "none", periodPoints: 900, puzzlesSolved: 12, rank: 1 },
];
const WEEKLY_USER_RANK = { userId: USER.id, userName: USER.name, userImage: null, activeFlair: "none", periodPoints: 300, puzzlesSolved: 5, rank: 10 };
const WEEKLY_REWARD_TIERS = [{ rank: 1, points: 500, xp: 100 }, { rank: "2-10", points: 200, xp: 40 }];

const MONTHLY_ENTRIES = [
  { userId: "u1", userName: "Aurora", userImage: null, activeFlair: "none", periodPoints: 4000, puzzlesSolved: 40, rank: 1 },
];
const MONTHLY_USER_RANK = { userId: USER.id, userName: USER.name, userImage: null, activeFlair: "none", periodPoints: 900, puzzlesSolved: 14, rank: 55 };

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "leaderboard-tester@example.test", role: "user", betaApproved: true },
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

/** Next.js's own route-change announcer also carries role="alert" (empty,
 * for accessibility), so scope to our error panel's actual copy instead of a
 * bare role query, which would otherwise match both. */
function errorPanel(page: Page) {
  return page.getByText("We couldn’t load this leaderboard");
}

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

interface FixtureOptions {
  followingCount?: number;
  followingEntries?: typeof GLOBAL_ENTRIES;
  followingUserRank?: typeof GLOBAL_USER_RANK | null;
  globalEntries?: typeof GLOBAL_ENTRIES;
  globalUserRank?: typeof GLOBAL_USER_RANK | null;
  weeklyEntries?: typeof WEEKLY_ENTRIES;
  weeklyEndsAt?: string;
  monthlyEntries?: typeof MONTHLY_ENTRIES;
  globalStatusOnce?: number;
  holdGlobal?: boolean;
  holdWeekly?: boolean;
  holdMonthly?: boolean;
  /** Every /global request AFTER the first (i.e. the initial foreground load
   * succeeds normally) is held rather than resolved — for background-refresh
   * and rapid-retry collision coverage. */
  holdGlobalAfterFirst?: boolean;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let globalCalls = 0;
  let weeklyCalls = 0;
  let monthlyCalls = 0;
  let followingCalls = 0;
  let globalFailedOnce = false;
  const held: Record<string, Array<(body: unknown, status?: number) => Promise<void>>> = { global: [], weekly: [], monthly: [] };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const bare = url.pathname;
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (bare === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: USER.name, email: "leaderboard-tester@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (bare === "/api/leaderboards/global") {
      globalCalls += 1;
      if (options.holdGlobal) { held.global.push(fulfill); return; }
      if (options.holdGlobalAfterFirst && globalCalls > 1) { held.global.push(fulfill); return; }
      if (options.globalStatusOnce && !globalFailedOnce) {
        globalFailedOnce = true;
        return fulfill({ error: "failed" }, options.globalStatusOnce);
      }
      return fulfill({ entries: options.globalEntries ?? GLOBAL_ENTRIES, userRank: options.globalUserRank ?? GLOBAL_USER_RANK });
    }

    if (bare === "/api/leaderboards/following") {
      followingCalls += 1;
      return fulfill({
        entries: options.followingEntries ?? [],
        userRank: options.followingUserRank ?? null,
        followingCount: options.followingCount ?? 0,
      });
    }

    if (path === "/api/leaderboards/period?type=weekly") {
      weeklyCalls += 1;
      if (options.holdWeekly) { held.weekly.push(fulfill); return; }
      return fulfill({
        entries: options.weeklyEntries ?? WEEKLY_ENTRIES,
        userRank: WEEKLY_USER_RANK,
        endsAt: options.weeklyEndsAt ?? futureIso(52),
        periodId: "week-42",
        rewardTiers: WEEKLY_REWARD_TIERS,
      });
    }

    if (path === "/api/leaderboards/period?type=monthly") {
      monthlyCalls += 1;
      if (options.holdMonthly) { held.monthly.push(fulfill); return; }
      return fulfill({
        entries: options.monthlyEntries ?? MONTHLY_ENTRIES,
        userRank: MONTHLY_USER_RANK,
        endsAt: futureIso(4),
        periodId: "month-7",
        rewardTiers: WEEKLY_REWARD_TIERS,
      });
    }

    return fulfill({});
  });

  return {
    globalCallCount: () => globalCalls,
    weeklyCallCount: () => weeklyCalls,
    monthlyCallCount: () => monthlyCalls,
    followingCallCount: () => followingCalls,
    heldGlobalCount: () => held.global.length,
    releaseGlobal: async (body: unknown, status = 200) => { await held.global.shift()?.(body, status); },
    releaseWeekly: async (body: unknown, status = 200) => { await held.weekly.shift()?.(body, status); },
    releaseMonthly: async (body: unknown, status = 200) => { await held.monthly.shift()?.(body, status); },
  };
}

/** Production-shaped Following self-entry — the real API always includes the
 * current user in `entries` even when followingCount is 0. */
const FOLLOWING_SELF_ENTRY = { userId: USER.id, userName: USER.name, userImage: null, activeFlair: "none", totalPoints: 1234, puzzlesSolved: 22, rank: 1 };

const MOBILE_VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe("Leaderboards shell — Global", () => {
  test("loads Global with rank summary, rows, and header actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Global/ })).toHaveAttribute("aria-selected", "true");
    expect(fixture.globalCallCount()).toBe(1);

    await expect(page.getByText("Your Global Rank")).toBeVisible();
    await expect(page.getByText("#42")).toBeVisible();
    await expect(page.getByText("1,234")).toBeVisible();
    await expect(page.getByText("22 puzzles solved")).toBeVisible();

    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();
    await expect(page.getByText("9,800")).toBeVisible();

    await expect(page.getByRole("link", { name: /Team Leaderboards/i })).toHaveAttribute("href", "/leaderboards/teams");
    await expect(page.getByRole("link", { name: /Back to Dashboard/i })).toHaveAttribute("href", "/dashboard");

    await expectNoHorizontalOverflow(page);
  });

  test("navbar clears the heading and stays in browse-mode chrome", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const nav = page.locator("#global-nav");
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const headingBox = await page.getByRole("heading", { level: 1, name: "Leaderboards" }).boundingBox();
    expect(navBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(headingBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height - 1);

    await expect(page.locator(".pw-bottom-nav")).toBeVisible();
  });
});

test.describe("Leaderboards shell — tab switching", () => {
  test("Global -> Weekly -> Monthly -> Following -> Global replaces content and hits the right endpoints", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { followingCount: 3, followingEntries: GLOBAL_ENTRIES, followingUserRank: GLOBAL_USER_RANK });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();

    await page.getByRole("tab", { name: /Weekly/ }).click();
    expect(fixture.weeklyCallCount()).toBe(1);
    await expect(page.getByText("Your Weekly Rank")).toBeVisible();
    await expect(page.getByText("Period points")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toBeVisible();
    await expect(page.getByText("Rank #1")).toBeVisible();

    await page.getByRole("tab", { name: /Monthly/ }).click();
    expect(fixture.monthlyCallCount()).toBe(1);
    await expect(page.getByText("Your Monthly Rank")).toBeVisible();
    await expect(page.getByText("#55")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toBeVisible();

    await page.getByRole("tab", { name: /Following/ }).click();
    expect(fixture.followingCallCount()).toBe(1);
    await expect(page.getByText("Following 3 players")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toHaveCount(0);

    await page.getByRole("tab", { name: /Global/ }).click();
    expect(fixture.globalCallCount()).toBe(2);
    await expect(page.getByText("Your Global Rank")).toBeVisible();
    await expect(page.getByText("#42")).toBeVisible();
  });
});

test.describe("Leaderboards shell — rapid-switch lifecycle", () => {
  test("resolving Monthly, then Weekly, then Global (in that order) still leaves Monthly active", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { holdGlobal: true, holdWeekly: true, holdMonthly: true });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Weekly/ }).click();
    await page.getByRole("tab", { name: /Monthly/ }).click();

    await fixture.releaseMonthly({ entries: MONTHLY_ENTRIES, userRank: MONTHLY_USER_RANK, endsAt: futureIso(4), rewardTiers: WEEKLY_REWARD_TIERS });
    await expect(page.getByText("Your Monthly Rank")).toBeVisible();

    await fixture.releaseWeekly({ entries: WEEKLY_ENTRIES, userRank: WEEKLY_USER_RANK, endsAt: futureIso(52), rewardTiers: WEEKLY_REWARD_TIERS });
    await fixture.releaseGlobal({ entries: GLOBAL_ENTRIES, userRank: GLOBAL_USER_RANK });

    // Monthly must still be the active tab and its content must still be shown.
    await expect(page.getByRole("tab", { name: /Monthly/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Your Monthly Rank")).toBeVisible();
    await expect(errorPanel(page)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Leaderboards shell — error and retry", () => {
  test("a failed request shows the error panel; retry recovers", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { globalStatusOnce: 500 });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(errorPanel(page)).toBeVisible();
    const retryButton = page.getByRole("button", { name: /Try Again/i });
    const box = await retryButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(47.9);

    await retryButton.click();
    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();
    await expect(errorPanel(page)).toHaveCount(0);
    expect(fixture.globalCallCount()).toBe(2);
  });
});

test.describe("Leaderboards shell — background refresh", () => {
  test("puzzle-solved refreshes Global in place; failure shows warning; next success clears it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    let refreshCall = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const fulfill = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/api/auth/session") {
        return fulfill({ user: { id: USER.id, name: USER.name, email: "leaderboard-tester@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
      }
      if (url.pathname === "/api/leaderboards/global") {
        refreshCall += 1;
        if (refreshCall === 1) return fulfill({ entries: GLOBAL_ENTRIES, userRank: GLOBAL_USER_RANK });
        if (refreshCall === 2) return fulfill({ error: "failed" }, 500);
        return fulfill({ entries: [{ ...GLOBAL_ENTRIES[0], totalPoints: 10500 }, GLOBAL_ENTRIES[1]], userRank: GLOBAL_USER_RANK });
      }
      return fulfill({});
    });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByText("9,800")).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event("puzzlewarz:puzzle-solved")));
    await expect(page.getByText(/Couldn.t refresh just now/)).toBeVisible();
    await expect(page.getByText("9,800")).toBeVisible(); // stale content preserved

    await page.evaluate(() => window.dispatchEvent(new Event("puzzlewarz:puzzle-solved")));
    await expect(page.getByText("10,500")).toBeVisible();
    await expect(page.getByText(/Couldn.t refresh just now/)).toHaveCount(0);
  });
});

test.describe("Leaderboards shell — foreground/background collision", () => {
  test("a puzzle-solved event during a held Weekly foreground load adds no background request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { holdWeekly: true });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Weekly/ }).click();
    expect(fixture.weeklyCallCount()).toBe(1);

    await page.evaluate(() => window.dispatchEvent(new Event("puzzlewarz:puzzle-solved")));
    // Still exactly one Weekly request — the event must not have queued a
    // background refresh while the Weekly foreground load is in flight.
    expect(fixture.weeklyCallCount()).toBe(1);

    await fixture.releaseWeekly({ entries: WEEKLY_ENTRIES, userRank: WEEKLY_USER_RANK, endsAt: futureIso(52), rewardTiers: WEEKLY_REWARD_TIERS });
    await expect(page.getByText("Your Weekly Rank")).toBeVisible();
    await expect(page.getByText("Loading leaderboard")).toHaveCount(0);
  });

  test("duplicate puzzle-solved events while a background refresh is held create exactly one background request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { holdGlobalAfterFirst: true });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();
    expect(fixture.globalCallCount()).toBe(1);

    await page.evaluate(() => window.dispatchEvent(new Event("puzzlewarz:puzzle-solved")));
    await page.evaluate(() => window.dispatchEvent(new Event("puzzlewarz:puzzle-solved")));
    await page.evaluate(() => window.dispatchEvent(new Event("puzzlewarz:puzzle-solved")));

    // Only the first event's background request should have gone out —
    // it's the one now being held.
    await expect.poll(() => fixture.globalCallCount()).toBe(2);
    expect(fixture.heldGlobalCount()).toBe(1);

    await fixture.releaseGlobal({ entries: [{ ...GLOBAL_ENTRIES[0], totalPoints: 11000 }, GLOBAL_ENTRIES[1]], userRank: GLOBAL_USER_RANK });
    await expect(page.getByText("11,000")).toBeVisible();
  });
});

test.describe("Leaderboards shell — rapid retry", () => {
  test("rapidly activating Try Again produces exactly one retry request and shows a pending state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { globalStatusOnce: 500, holdGlobalAfterFirst: true });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(errorPanel(page)).toBeVisible();
    const retryButton = page.getByRole("button", { name: /Try Again/i });
    await retryButton.click({ force: true });
    await retryButton.click({ force: true }).catch(() => {});
    await retryButton.click({ force: true }).catch(() => {});

    await expect.poll(() => fixture.globalCallCount()).toBe(2);
    expect(fixture.heldGlobalCount()).toBe(1);
    await expect(page.getByRole("button", { name: /Trying…/i })).toBeVisible();

    await fixture.releaseGlobal({ entries: GLOBAL_ENTRIES, userRank: GLOBAL_USER_RANK });
    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();
    await expect(errorPanel(page)).toHaveCount(0);
  });
});

test.describe("Leaderboards shell — invalid period schedule", () => {
  test("an invalid endsAt shows 'Schedule unavailable' and never 'Invalid Date'", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { weeklyEndsAt: "not-a-date" });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Weekly/ }).click();
    await expect(page.getByText("Schedule unavailable")).toBeVisible();
    await expect(page.getByText(/Invalid Date/)).toHaveCount(0);
  });
});

test.describe("Leaderboards shell — empty states", () => {
  test("Following empty state browses to Global with exactly one Global request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, {
      followingCount: 0,
      followingEntries: [FOLLOWING_SELF_ENTRY],
      followingUserRank: FOLLOWING_SELF_ENTRY,
    });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Following/ }).click();
    await expect(page.getByRole("heading", { name: "Build your comparison group" })).toBeVisible();
    // The API returns the current user's own row even at followingCount: 0 —
    // it must not render as a leaderboard row or footer stats beneath the panel.
    await expect(page.getByRole("link", { name: USER.name })).toHaveCount(0);
    await expect(page.getByText("Top Players")).toHaveCount(0);
    const action = page.getByRole("button", { name: /Browse Global Leaderboard/i });
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(47.9);

    // The initial page load already issued one Global request (the default
    // tab) — the action must add exactly one more, not refetch twice.
    const globalCallsBeforeAction = fixture.globalCallCount();
    await action.click();
    await expect(page.getByRole("tab", { name: /Global/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();
    expect(fixture.globalCallCount()).toBe(globalCallsBeforeAction + 1);
  });

  test("Weekly empty state keeps countdown and reward tiers visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { weeklyEntries: [] });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Weekly/ }).click();
    await expect(page.getByText("No weekly activity yet")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toBeVisible();
    await expect(page.getByText("500 pts")).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse Puzzles/i })).toHaveAttribute("href", "/puzzles");
  });

  test("Monthly empty state keeps countdown and reward tiers visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { monthlyEntries: [] });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Monthly/ }).click();
    await expect(page.getByText("No monthly activity yet")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse Puzzles/i })).toHaveAttribute("href", "/puzzles");
  });

  test("Global empty state shows Browse Puzzles", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { globalEntries: [], globalUserRank: null });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("No ranked players yet")).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse Puzzles/i })).toHaveAttribute("href", "/puzzles");
  });
});

test.describe("Leaderboards shell — required viewports", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: renders with no overflow, targets remain reachable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const backBox = await page.getByRole("link", { name: /Back to Dashboard/i }).boundingBox();
      const teamBox = await page.getByRole("link", { name: /Team Leaderboards/i }).boundingBox();
      expect(backBox!.height).toBeGreaterThanOrEqual(43.9);
      expect(teamBox!.height).toBeGreaterThanOrEqual(43.9);

      for (const tab of ["Global", "Weekly", "Monthly", "Following"]) {
        const tabBox = await page.getByRole("tab", { name: new RegExp(tab) }).boundingBox();
        expect(tabBox!.height).toBeGreaterThanOrEqual(43.9);
      }

      await expect(page.getByText("#42")).toBeVisible();
    });
  }

  test("844x390: landscape compacts without clipping and keeps vertical scroll available", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByText("Aurora Nightingale-Whitcombe-Fairweather")).toBeVisible();
  });

  test("1440x900: desktop clears fixed navbar and stays within page width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Leaderboards shell — reduced motion", () => {
  test("header, tabs, and rank summary render immediately usable with no animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
    await page.getByRole("tab", { name: /Weekly/ }).click();
    await expect(page.getByText("Your Weekly Rank")).toBeVisible();
  });
});
