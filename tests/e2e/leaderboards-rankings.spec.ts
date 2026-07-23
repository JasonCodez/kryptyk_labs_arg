import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

// Deterministic route mocks throughout — this spec never depends on a live
// database, real rankings, or production network timing.

const USER = { id: "e2e-rank-user", name: "RankTester" };

const BROKEN_IMAGE = "/e2e-broken-avatar.png";

const FIVE_ENTRY_FIXTURE = [
  { userId: "u1", userName: "Aurora", userImage: null, activeFlair: "none", isPremium: true, totalPoints: 9800, puzzlesSolved: 120, rank: 1 },
  { userId: "u2", userName: "Beatrix", userImage: BROKEN_IMAGE, activeFlair: "⭐ Streak", isPremium: false, totalPoints: 7200, puzzlesSolved: 95, rank: 2 },
  { userId: "u3", userName: "Cassius", userImage: null, activeFlair: "none", isPremium: false, totalPoints: 5400, puzzlesSolved: 70, rank: 3 },
  { userId: USER.id, userName: USER.name, userImage: null, activeFlair: "none", isPremium: false, totalPoints: 1234, puzzlesSolved: 22, rank: 4, isCurrentUser: true },
  { userId: "u5", userName: "Persimmon Featherstonehaugh-Wallingford-Smythe", userImage: null, activeFlair: "none", isPremium: false, totalPoints: 900, puzzlesSolved: 10, rank: 5 },
];

const WEEKLY_REWARD_TIERS = [
  { rank: 1, points: 500, xp: 100 },
  { rank: "2-10", points: 200, xp: 40 },
  { rank: "11-50", points: 100, xp: 20 },
];
const MONTHLY_REWARD_TIERS = [
  { rank: 1, points: 2000, xp: 400 },
  { rank: "2-10", points: 800, xp: 160 },
];

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "rank-tester@example.test", role: "user", betaApproved: true },
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

/** The rank summary ("#4" / "You") and the standard-row list can both contain
 * the same substrings — scope to the "Rankings" list region to disambiguate. */
function rankingsSection(page: Page) {
  return page.locator('section[aria-labelledby="leaderboard-standard-heading"]');
}

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

interface FixtureOptions {
  globalEntries?: typeof FIVE_ENTRY_FIXTURE;
  weeklyEntries?: typeof FIVE_ENTRY_FIXTURE;
  monthlyEntries?: typeof FIVE_ENTRY_FIXTURE;
  followingEntries?: typeof FIVE_ENTRY_FIXTURE;
  followingCount?: number;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let globalCalls = 0;

  await page.route("**/*.png", async (route) => {
    if (route.request().url().includes("e2e-broken-avatar")) {
      return route.fulfill({ status: 404, body: "not found" });
    }
    return route.continue();
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const bare = url.pathname;
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

    if (bare === "/api/auth/session") {
      return fulfill({ user: { id: USER.id, name: USER.name, email: "rank-tester@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (bare === "/api/leaderboards/global") {
      globalCalls += 1;
      const entries = options.globalEntries ?? FIVE_ENTRY_FIXTURE;
      const mine = entries.find((e) => e.userId === USER.id) ?? null;
      return fulfill({ entries, userRank: mine });
    }

    if (bare === "/api/leaderboards/following") {
      const entries = options.followingEntries ?? [];
      const mine = entries.find((e) => e.userId === USER.id) ?? null;
      return fulfill({ entries, userRank: mine, followingCount: options.followingCount ?? 0 });
    }

    if (path === "/api/leaderboards/period?type=weekly") {
      const entries = options.weeklyEntries ?? FIVE_ENTRY_FIXTURE.map(({ totalPoints, ...rest }) => ({ ...rest, periodPoints: totalPoints }));
      const mine = entries.find((e) => e.userId === USER.id) ?? null;
      return fulfill({ entries, userRank: mine, endsAt: futureIso(52), periodId: "week-1", rewardTiers: WEEKLY_REWARD_TIERS });
    }

    if (path === "/api/leaderboards/period?type=monthly") {
      const entries = options.monthlyEntries ?? FIVE_ENTRY_FIXTURE.map(({ totalPoints, ...rest }) => ({ ...rest, periodPoints: totalPoints }));
      const mine = entries.find((e) => e.userId === USER.id) ?? null;
      return fulfill({ entries, userRank: mine, endsAt: futureIso(4), periodId: "month-1", rewardTiers: MONTHLY_REWARD_TIERS });
    }

    return fulfill({});
  });

  return { globalCallCount: () => globalCalls };
}

const REQUIRED_VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test.describe("Leaderboards rankings — Global fixture", () => {
  test("top competitors, standard row, current user, premium, flair, avatars, and stats all render correctly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Top competitors")).toBeVisible();
    await expect(page.getByText("1st Place")).toBeVisible();
    await expect(page.getByText("2nd Place")).toBeVisible();
    await expect(page.getByText("3rd Place")).toBeVisible();
    await expect(page.locator("svg.lucide-crown")).toBeVisible();
    await expect(page.locator("svg.lucide-medal")).toBeVisible();
    await expect(page.locator("svg.lucide-award")).toBeVisible();

    const bodyText = (await page.locator("body").innerText());
    expect(/🥇|🥈|🥉/.test(bodyText)).toBe(false);
    expect(bodyText.includes("💎")).toBe(false);

    await expect(rankingsSection(page).getByText("#4", { exact: true })).toBeVisible();
    await expect(rankingsSection(page).getByText("You", { exact: true })).toBeVisible();
    await expect(page.getByText("Premium")).toBeVisible();
    await expect(page.getByText("⭐ Streak")).toBeVisible();
    await expect(page.getByText("9,800")).toBeVisible();
    await expect(page.getByText("120 puzzles solved")).toBeVisible();

    await expect(page.getByRole("link", { name: /Aurora/ })).toHaveAttribute("href", "/profile/u1");

    const stats = page.getByTestId("leaderboard-stats");
    await expect(stats.getByText("Top Players")).toBeVisible();
    await expect(stats.getByText("5", { exact: true })).toBeVisible();

    const longName = "Persimmon Featherstonehaugh-Wallingford-Smythe";
    await expect(page.getByText(longName)).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });

  test("missing avatar shows initials; broken avatar falls back to initials", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // Aurora (rank 1, userImage: null) — initials fallback.
    await expect(page.getByText("A", { exact: true })).toBeVisible();

    // Beatrix (rank 2, deliberately broken image) — initials fallback after error.
    await expect(page.getByText("B", { exact: true })).toBeVisible();
  });
});

test.describe("Leaderboards rankings — featured list edge cases", () => {
  test("one ranked player: only one featured card, no fabricated placeholders", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { globalEntries: [FIVE_ENTRY_FIXTURE[0]] });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("1st Place")).toBeVisible();
    await expect(page.getByText("2nd Place")).toHaveCount(0);
    await expect(page.getByText("3rd Place")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Rankings", exact: true })).toHaveCount(0);
  });

  test("two ranked players: two featured cards, no fabricated third place", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { globalEntries: [FIVE_ENTRY_FIXTURE[0], FIVE_ENTRY_FIXTURE[1]] });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("1st Place")).toBeVisible();
    await expect(page.getByText("2nd Place")).toBeVisible();
    await expect(page.getByText("3rd Place")).toHaveCount(0);
  });

  test("no top-three entries: no Top competitors section; rank 4 stays standard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const entries = FIVE_ENTRY_FIXTURE.slice(3).map((e, i) => ({ ...e, rank: 4 + i }));
    await installFixture(page, { globalEntries: entries });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Top competitors")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Rankings", exact: true })).toBeVisible();
    await expect(rankingsSection(page).getByText("#4", { exact: true })).toBeVisible();
    await expect(page.getByText("1st Place")).toHaveCount(0);
  });
});

test.describe("Leaderboards rankings — current-user standard row", () => {
  test("You is visible, rank stays #4, not promoted to top-three, remains usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(rankingsSection(page).getByText("You", { exact: true })).toBeVisible();
    await expect(rankingsSection(page).getByText("#4", { exact: true })).toBeVisible();
    await expect(rankingsSection(page).getByText("1,234")).toBeVisible();
    // Below the sm breakpoint (320px viewport) the row shows the compact
    // "22 solved" label; "22 puzzles solved" is sm:block-only.
    await expect(rankingsSection(page).getByText("22 solved", { exact: true })).toBeVisible();

    const profileLink = page.getByRole("link", { name: new RegExp(USER.name) });
    await expect(profileLink).toHaveAttribute("href", `/profile/${USER.id}`);
    const box = await profileLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(43.9);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Leaderboards rankings — Weekly rewards", () => {
  test("countdown, rank summary, rewards heading, tier order, and top-three all present", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Weekly/ }).click();

    await expect(page.getByText("Time Remaining")).toBeVisible();
    await expect(page.getByText("Your Weekly Rank")).toBeVisible();
    await expect(page.getByText("Weekly rewards")).toBeVisible();
    await expect(page.getByText("Final standings determine rewards after the period ends.")).toBeVisible();

    const rewardTiers = page.getByTestId("leaderboard-reward-tiers");
    const labels = await rewardTiers.getByText(/Place$|–/).allTextContents();
    expect(labels).toEqual(["1st Place", "2nd–10th", "11th–50th"]);

    await expect(page.getByText("500 Points")).toBeVisible();
    await expect(page.getByText("100 XP")).toBeVisible();
    await expect(page.getByText(/Claim/i)).toHaveCount(0);
    expect((await page.locator("body").innerText()).includes("🏆")).toBe(false);

    await expect(page.getByText("Top competitors")).toBeVisible();
    await expect(page.getByText("1st Place").first()).toBeVisible();
    await expect(page.getByText("Period points").first()).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Leaderboards rankings — Weekly reward geometry", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    test(`${viewport.width}x${viewport.height}: reward ladder does not horizontally scroll`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await page.getByRole("tab", { name: /Weekly/ }).click();

      const rewardTiers = page.getByTestId("leaderboard-reward-tiers");
      await expect(rewardTiers).toBeVisible();

      await expect(rewardTiers.getByText("1st Place")).toBeVisible();
      await expect(rewardTiers.getByText("2nd–10th")).toBeVisible();
      await expect(rewardTiers.getByText("11th–50th")).toBeVisible();
      await expect(rewardTiers.getByText("500 Points")).toBeVisible();
      await expect(rewardTiers.getByText("100 XP")).toBeVisible();
      await expect(rewardTiers.getByText("200 Points")).toBeVisible();
      await expect(rewardTiers.getByText("40 XP")).toBeVisible();
      await expect(rewardTiers.getByText("100 Points")).toBeVisible();
      await expect(rewardTiers.getByText("20 XP")).toBeVisible();

      const dimensions = await rewardTiers.evaluate((element) => {
        const list = element.querySelector("ul");
        return {
          componentClientWidth: element.clientWidth,
          componentScrollWidth: element.scrollWidth,
          listClientWidth: list?.clientWidth ?? 0,
          listScrollWidth: list?.scrollWidth ?? 0,
        };
      });

      expect(dimensions.componentScrollWidth).toBeLessThanOrEqual(dimensions.componentClientWidth + 1);
      expect(dimensions.listScrollWidth).toBeLessThanOrEqual(dimensions.listClientWidth + 1);

      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Leaderboards rankings — Monthly rewards", () => {
  test("monthly heading, exact tier values, exact API order, and existing countdown/rank summary remain", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Monthly/ }).click();

    await expect(page.getByText("Monthly rewards")).toBeVisible();
    await expect(page.getByText("Weekly rewards")).toHaveCount(0);
    await expect(page.getByText("2,000 Points")).toBeVisible();
    await expect(page.getByText("400 XP")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toBeVisible();
    await expect(page.getByText("Your Monthly Rank")).toBeVisible();
    await expect(page.getByText("Period points").first()).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Leaderboards rankings — Following", () => {
  test("Following with players: list renders, You visible, stats render, exact API order, no period content", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await authenticate(page);
    const followingEntries = [FIVE_ENTRY_FIXTURE[3], FIVE_ENTRY_FIXTURE[0], FIVE_ENTRY_FIXTURE[1]];
    await installFixture(page, { followingEntries, followingCount: 2 });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Following/ }).click();

    await expect(rankingsSection(page).getByText("You", { exact: true })).toBeVisible();
    await expect(page.getByText("Top Players")).toBeVisible();
    await expect(page.getByText("Time Remaining")).toHaveCount(0);

    const names = await page
      .getByTestId("leaderboard-list")
      .getByText(new RegExp(`^(${USER.name}|Aurora|Beatrix)$`))
      .allTextContents();
    // Featured (top-three) entries render before the standard rankings section,
    // so Aurora (rank 1) and Beatrix (rank 2) precede the current user (rank 4) in the DOM.
    expect(names).toEqual(["Aurora", "Beatrix", USER.name]);

    await expectNoHorizontalOverflow(page);
  });

  test("Following count zero: Build your comparison group remains, no list, no stats", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { followingEntries: [FIVE_ENTRY_FIXTURE[3]], followingCount: 0 });
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: /Following/ }).click();

    await expect(page.getByRole("heading", { name: "Build your comparison group" })).toBeVisible();
    await expect(page.getByText("Your Following Rank")).toBeVisible();
    await expect(page.getByText("Rankings")).toHaveCount(0);
    await expect(page.getByText("Top competitors")).toHaveCount(0);
    await expect(page.getByText("Top Players")).toHaveCount(0);
  });
});

test.describe("Leaderboards rankings — required viewports", () => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: no overflow, bounded content, usable profile links`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const profileLink = page.getByRole("link", { name: new RegExp(USER.name) });
      const box = await profileLink.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(43.9);

      const backBox = await page.getByRole("link", { name: /Back to Dashboard/i }).boundingBox();
      const teamBox = await page.getByRole("link", { name: /Team Leaderboards/i }).boundingBox();
      expect(backBox!.height).toBeGreaterThanOrEqual(43.9);
      expect(teamBox!.height).toBeGreaterThanOrEqual(43.9);

      for (const tab of ["Global", "Weekly", "Monthly", "Following"]) {
        const tabBox = await page.getByRole("tab", { name: new RegExp(tab) }).boundingBox();
        expect(tabBox!.height).toBeGreaterThanOrEqual(43.9);
      }
    });
  }

  test("844x390: landscape featured cards and standard rows remain readable with vertical scroll", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(rankingsSection(page).getByText("#4", { exact: true })).toBeVisible();
  });

  test("1440x900: desktop clears fixed navbar, three-column featured grid, bounded stats", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.getByText("Top competitors")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Leaderboards rankings — reduced motion", () => {
  test("ranking content is immediately visible with no entrance animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Top competitors")).toBeVisible();
    await expect(page.getByText("1st Place")).toBeVisible();
    await page.getByRole("tab", { name: /Weekly/ }).click();
    await expect(page.getByText("Your Weekly Rank")).toBeVisible();
  });
});
