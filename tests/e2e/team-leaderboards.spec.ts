import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "team-e2e-user", name: "TeamTester" };

const SIX_ENTRY_FIXTURE = [
  { teamId: "t1", teamName: "Alpha Squad", isPublic: true, bannerColor: "gold", totalPoints: 9000, totalPuzzlesSolved: 300, memberCount: 12, rank: 1 },
  { teamId: "t2", teamName: "Beta Crew", isPublic: false, bannerColor: "crimson", totalPoints: 7200, totalPuzzlesSolved: 250, memberCount: 10, rank: 2 },
  { teamId: "t3", teamName: "Gamma Guild", isPublic: true, bannerColor: "neon", totalPoints: 5400, totalPuzzlesSolved: 180, memberCount: 8, rank: 3 },
  { teamId: USER.id, teamName: "My Squad", isPublic: false, bannerColor: "unknown-value", totalPoints: 1234, totalPuzzlesSolved: 42, memberCount: 4, rank: 4 },
  { teamId: "t5", teamName: "Persimmon Featherstonehaugh-Wallingford-Smythe Alliance", isPublic: true, bannerColor: "gold", totalPoints: 900, totalPuzzlesSolved: 20, memberCount: 3, rank: 5 },
  { teamId: "t6", teamName: null, isPublic: true, bannerColor: "none", totalPoints: 500, totalPuzzlesSolved: 10, memberCount: 2, rank: 6 },
];

const USER_TEAM_RANK = SIX_ENTRY_FIXTURE[3];

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "team-tester@example.test", role: "user", betaApproved: true },
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

/** The rank summary ("#4") and the standard-row list can both contain the
 * same substrings — scope to the "Rankings" list region to disambiguate. */
function rankingsSection(page: Page) {
  return page.locator('section[aria-labelledby="team-leaderboard-standard-heading"]');
}

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

interface FixtureOptions {
  entries?: unknown[];
  userTeamRank?: unknown;
  status?: number;
  holdTeams?: boolean;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let teamsCalls = 0;
  const held: Route[] = [];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/auth/session") {
      return fulfill(route, { user: { id: USER.id, name: USER.name, email: "team-tester@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (path === "/api/leaderboards/teams") {
      teamsCalls += 1;
      if (options.holdTeams) {
        held.push(route);
        return;
      }
      if (options.status && options.status !== 200) {
        return fulfill(route, { error: "failed" }, options.status);
      }
      return fulfill(route, {
        entries: options.entries ?? SIX_ENTRY_FIXTURE,
        userTeamRank: options.userTeamRank !== undefined ? options.userTeamRank : USER_TEAM_RANK,
      });
    }

    return fulfill(route, {});
  });

  return {
    teamsCallCount: () => teamsCalls,
    release: async (body: unknown, status = 200) => {
      for (const route of held.splice(0)) await fulfill(route, body, status);
    },
    heldCount: () => held.length,
  };
}

test.describe("Team Leaderboards — populated fixture", () => {
  test("heading, header actions, current-team summary, top teams, standard rows, badges, and statistics all render correctly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: "Team Leaderboards" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to Leaderboards/ })).toHaveAttribute("href", "/leaderboards");
    await expect(page.getByRole("link", { name: /Explore Teams/ }).first()).toHaveAttribute("href", "/teams");

    await expect(page.getByText("Your Team Rank")).toBeVisible();
    const rankSummary = page.getByTestId("team-rank-summary");
    await expect(rankSummary.getByText("My Squad")).toBeVisible();
    await expect(rankSummary.getByText("#4")).toBeVisible();
    await expect(rankSummary.getByText("1,234")).toBeVisible();
    await expect(rankSummary.getByText(/4 members/)).toBeVisible();
    await expect(rankSummary.getByText(/42 puzzles solved/)).toBeVisible();

    await expect(page.getByText("Top teams")).toBeVisible();
    await expect(page.getByText("1st Place")).toBeVisible();
    await expect(page.getByText("2nd Place")).toBeVisible();
    await expect(page.getByText("3rd Place")).toBeVisible();
    await expect(page.locator("svg.lucide-crown")).toBeVisible();
    await expect(page.locator("svg.lucide-medal")).toBeVisible();
    await expect(page.locator("svg.lucide-award")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(/🥇|🥈|🥉|🏆/.test(bodyText)).toBe(false);

    await expect(rankingsSection(page).getByText("#4", { exact: true })).toBeVisible();
    await expect(rankingsSection(page).getByText("Your team", { exact: true })).toBeVisible();

    await expect(page.getByText("Public").first()).toBeVisible();
    await expect(page.getByText("Private").first()).toBeVisible();

    const publicLink = page.getByRole("link", { name: /Alpha Squad/ });
    await expect(publicLink).toHaveAttribute("href", "/teams/t1");

    // Beta Crew (rank 2, private, not the user's team) must not be a link.
    await expect(page.getByRole("link", { name: /Beta Crew/ })).toHaveCount(0);

    // My Squad (private, the user's own team) is linkable both in the summary and the row.
    const myTeamLinks = page.getByRole("link", { name: /My Squad/ });
    expect(await myTeamLinks.count()).toBeGreaterThan(0);
    await expect(myTeamLinks.first()).toHaveAttribute("href", `/teams/${USER.id}`);

    await expect(page.getByText("Unnamed Team")).toBeVisible();
    const longName = "Persimmon Featherstonehaugh-Wallingford-Smythe Alliance";
    await expect(page.getByText(longName)).toBeVisible();

    const stats = page.getByTestId("team-leaderboard-stats");
    await expect(stats.getByText("Ranked Teams")).toBeVisible();
    await expect(stats.getByText("6", { exact: true })).toBeVisible();
    const expectedTotalPoints = SIX_ENTRY_FIXTURE.reduce((sum, e) => sum + e.totalPoints, 0).toLocaleString();
    await expect(stats.getByText(expectedTotalPoints)).toBeVisible();
    const expectedTotalPuzzles = SIX_ENTRY_FIXTURE.reduce((sum, e) => sum + e.totalPuzzlesSolved, 0).toLocaleString();
    await expect(stats.getByText(expectedTotalPuzzles)).toBeVisible();

    const listEntries = await page.getByTestId("team-leaderboard-list").locator("li").count();
    expect(listEntries).toBe(SIX_ENTRY_FIXTURE.length);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Leaderboards — loading", () => {
  test("skeleton renders with pulse, then real rankings replace it after release", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const fixture = await installFixture(page, { holdTeams: true });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: "Team Leaderboards" })).toBeVisible();
    const loading = page.getByTestId("team-leaderboard-loading");
    await expect(loading).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading team leaderboard" })).toHaveCount(1);

    const shape = loading.locator("[data-skeleton='true']").first();
    const style = await shape.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { animationName: computed.animationName, animationDuration: computed.animationDuration };
    });
    expect(style.animationName).not.toBe("none");
    expect(style.animationDuration).not.toBe("0s");

    expect(await page.locator("body").innerText()).not.toContain("Alpha Squad");
    await expectNoHorizontalOverflow(page);

    await fixture.release({ entries: SIX_ENTRY_FIXTURE, userTeamRank: USER_TEAM_RANK });
    await expect(page.getByTestId("team-leaderboard-loading")).toHaveCount(0);
    await expect(page.getByText("Alpha Squad")).toBeVisible();
    expect(fixture.teamsCallCount()).toBe(1);
  });
});

test.describe("Team Leaderboards — reduced motion loading", () => {
  test("skeleton is static under reduced motion and geometry is unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installFixture(page, { holdTeams: true });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const loading = page.getByTestId("team-leaderboard-loading");
    await expect(loading).toBeVisible();
    const shape = loading.locator("[data-skeleton='true']").first();
    const animationName = await shape.evaluate((element) => getComputedStyle(element).animationName);
    expect(animationName).toBe("none");

    await expect(page.getByRole("heading", { name: "Team Leaderboards" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Leaderboards — error and retry", () => {
  test("failed load shows the error panel; rapid retry produces one request; success recovers", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { status: 500 });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("We couldn’t load team rankings")).toBeVisible();
    await expect(page.getByText("Check your connection and try again.")).toBeVisible();

    const retryFixture = await installFixture(page, { holdTeams: true });
    const button = page.getByRole("button", { name: "Try Again" });
    // Dispatch two click events on the same button synchronously in-browser
    // — the button's accessible name flips to "Trying…" as soon as React
    // processes the first click, so two separate Playwright .click() actions
    // (each re-querying by name) would have the second one wait forever for
    // a "Try Again" button that no longer exists.
    await button.evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => retryFixture.teamsCallCount()).toBe(1);

    await expect(page.getByRole("button", { name: "Trying…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trying…" })).toBeDisabled();

    await retryFixture.release({ entries: SIX_ENTRY_FIXTURE, userTeamRank: USER_TEAM_RANK });
    await expect(page.getByText("Alpha Squad")).toBeVisible();
    await expect(page.getByText("We couldn’t load team rankings")).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Leaderboards — empty leaderboard", () => {
  test("shows Not ranked and the empty panel; no list or stats", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await authenticate(page);
    await installFixture(page, { entries: [], userTeamRank: null });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Not ranked")).toBeVisible();
    await expect(page.getByText("No ranked teams yet")).toBeVisible();
    await expect(page.getByText("Create or join a team, solve puzzles together, and claim the first ranking.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore Teams/ }).first()).toBeVisible();
    await expect(page.getByTestId("team-leaderboard-list")).toHaveCount(0);
    await expect(page.getByTestId("team-leaderboard-stats")).toHaveCount(0);
    await expect(page.getByText("#0")).toHaveCount(0);
    expect((await page.locator("body").innerText()).includes("🏆")).toBe(false);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Leaderboards — ranked user with otherwise empty list", () => {
  test("current-team summary renders; empty panel renders; stats stay suppressed; no duplication", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, {
      entries: [],
      userTeamRank: { teamId: "my-team", teamName: "My Team", isPublic: false, bannerColor: "gold", totalPoints: 500, totalPuzzlesSolved: 12, memberCount: 3, rank: 1 },
    });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByTestId("team-rank-summary").getByText("My Team")).toBeVisible();
    await expect(page.getByText("No ranked teams yet")).toBeVisible();
    await expect(page.getByTestId("team-leaderboard-stats")).toHaveCount(0);
    await expect(page.getByTestId("team-leaderboard-list")).toHaveCount(0);
    expect(await page.getByText("My Team").count()).toBe(1);
  });
});

test.describe("Team Leaderboards — no top three", () => {
  test("Top teams section absent; rank 4 stays standard, not first-place styled", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const entries = SIX_ENTRY_FIXTURE.slice(3).map((e, i) => ({ ...e, rank: 4 + i }));
    await installFixture(page, { entries, userTeamRank: entries[0] });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Top teams")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Rankings", exact: true })).toBeVisible();
    await expect(rankingsSection(page).getByText("#4", { exact: true })).toBeVisible();
    await expect(page.getByText("1st Place")).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Leaderboards — one and two featured teams", () => {
  test("one entry: single featured card, no fabricated placeholders", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { entries: [SIX_ENTRY_FIXTURE[0]], userTeamRank: null });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("1st Place")).toBeVisible();
    await expect(page.getByText("2nd Place")).toHaveCount(0);
    await expect(page.getByText("3rd Place")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Rankings", exact: true })).toHaveCount(0);
  });

  test("two entries: two featured cards, no fabricated third place", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { entries: [SIX_ENTRY_FIXTURE[0], SIX_ENTRY_FIXTURE[1]], userTeamRank: null });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("1st Place")).toBeVisible();
    await expect(page.getByText("2nd Place")).toBeVisible();
    await expect(page.getByText("3rd Place")).toHaveCount(0);
  });
});

test.describe("Team Leaderboards — required viewports", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1440, height: 900 },
  ]) {
    test(`${viewport.width}x${viewport.height}: renders with no overflow, header and actions reachable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page);
      await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByRole("heading", { name: "Team Leaderboards" })).toBeVisible();
      const backLink = page.getByRole("link", { name: /Back to Leaderboards/ });
      await expect(backLink).toBeVisible();
      const backBox = await backLink.boundingBox();
      expect(backBox!.height).toBeGreaterThanOrEqual(43.9);

      const exploreLink = page.getByRole("link", { name: /Explore Teams/ }).first();
      await expect(exploreLink).toBeVisible();
      const exploreBox = await exploreLink.boundingBox();
      expect(exploreBox!.height).toBeGreaterThanOrEqual(43.9);

      await expect(page.getByText("Your Team Rank")).toBeVisible();
      await expect(page.getByTestId("team-leaderboard-stats")).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });
  }

  test("844x390: landscape header and rows remain readable with vertical scroll", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: "Team Leaderboards" })).toBeVisible();
    await expect(page.getByText("Top teams")).toBeVisible();
    await expect(rankingsSection(page)).toBeVisible();
    await expect(page.getByTestId("team-leaderboard-stats")).toBeVisible();

    const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(canScroll).toBe(true);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Leaderboards — malformed payload safety", () => {
  test("mixed valid/invalid entries and a partial userTeamRank render safely with no fake links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, {
      entries: [SIX_ENTRY_FIXTURE[0], null, "invalid", {}, SIX_ENTRY_FIXTURE[3]],
      userTeamRank: { teamId: "partial" },
    });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Alpha Squad")).toBeVisible();
    await expect(page.getByText("My Squad")).toBeVisible();

    const listItems = page.getByTestId("team-leaderboard-list").locator("li");
    expect(await listItems.count()).toBe(2);

    await expect(page.getByText("Not ranked")).toBeVisible();
    await expect(rankingsSection(page).getByText("Your team")).toHaveCount(0);

    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((l) => l.getAttribute("href")));
    for (const href of hrefs) {
      expect(href).not.toMatch(/undefined/);
      expect(href).not.toMatch(/\/null\b/);
    }

    const stats = page.getByTestId("team-leaderboard-stats");
    const expectedPoints = (SIX_ENTRY_FIXTURE[0].totalPoints + SIX_ENTRY_FIXTURE[3].totalPoints).toLocaleString();
    await expect(stats.getByText(expectedPoints)).toBeVisible();

    await expect(page.getByText("We couldn’t load team rankings")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("empty current-team ID keeps the summary visible with no /teams/ link", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, {
      entries: [],
      userTeamRank: {
        teamId: "",
        teamName: "Nameless Route Team",
        isPublic: false,
        bannerColor: "gold",
        totalPoints: 500,
        totalPuzzlesSolved: 12,
        memberCount: 3,
        rank: 1,
      },
    });
    await page.goto("/leaderboards/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const rankSummary = page.getByTestId("team-rank-summary");
    await expect(rankSummary).toBeVisible();
    await expect(rankSummary.getByText("Nameless Route Team")).toBeVisible();
    await expect(page.getByRole("link", { name: /Nameless Route Team/ })).toHaveCount(0);
    await expect(rankSummary.getByText("Private")).toBeVisible();
    await expect(rankSummary.getByText("#1")).toBeVisible();
    await expect(rankSummary.getByText("500")).toBeVisible();

    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((l) => l.getAttribute("href")));
    expect(hrefs.some((href) => href?.startsWith("/teams/"))).toBe(false);

    await expect(page.getByText("No ranked teams yet")).toBeVisible();
    await expect(page.getByTestId("team-leaderboard-stats")).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});
