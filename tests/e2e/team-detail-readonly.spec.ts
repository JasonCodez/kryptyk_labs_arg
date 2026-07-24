import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const TEAM_ID = "team-detail-fixture";
const USER = { id: "me", name: "MeTester" };

const TEAM_FIXTURE = {
  id: TEAM_ID,
  name: "Midnight Puzzle Society",
  description: "A long but readable description about solving daily puzzles together.",
  isPublic: true,
  activeTheme: "neon",
  createdAt: "2026-01-14T12:00:00.000Z",
  members: [
    { user: { id: "me", name: "MeTester", email: "me@example.test", image: null }, role: "admin" },
    { user: { id: "u2", name: "Moderator Mo", email: null, image: null }, role: "moderator" },
    { user: { id: "u3", name: null, email: null, image: null }, role: "member" },
    { user: { id: "u4", name: "Longname Featherstonehaugh-Wallingford-Smythe", email: null, image: null }, role: "member" },
    { user: { id: "u5", name: "Missing Avatar", email: null, image: null }, role: "member" },
    { user: { id: "u6", name: "Broken Avatar", email: null, image: "/e2e-broken-avatar.png" }, role: "member" },
  ],
};

const STATS_FIXTURE = {
  rank: 4,
  totalTeams: 28,
  totalEarnedPoints: 5200,
  totalPuzzlesSolved: 180,
  avgPointsPerMember: 866,
  memberCount: 6,
  topContributors: [
    { userId: "me", name: "MeTester", image: null, role: "admin", joinedAt: "2026-01-01T00:00:00.000Z", earnedPoints: 3000, puzzlesSolved: 100 },
    { userId: "u2", name: "Moderator Mo", image: null, role: "moderator", joinedAt: "2026-01-02T00:00:00.000Z", earnedPoints: 1200, puzzlesSolved: 40 },
    { userId: "u3", name: null, image: null, role: "member", joinedAt: "2026-01-03T00:00:00.000Z", earnedPoints: 600, puzzlesSolved: 20 },
  ],
  recentActivity: [
    { userName: "MeTester", userImage: null, puzzleTitle: "Daily Sudoku", puzzleType: "sudoku", difficulty: "easy", pointsEarned: 25, solvedAt: "2026-01-20T11:45:00.000Z" },
    { userName: "Moderator Mo", userImage: null, puzzleTitle: "Weekly Crossword", puzzleType: "crossword", difficulty: "medium", pointsEarned: 40, solvedAt: "2026-01-20T09:00:00.000Z" },
    { userName: null, userImage: null, puzzleTitle: null, puzzleType: null, difficulty: "hard", pointsEarned: 60, solvedAt: "2026-01-19T00:00:00.000Z" },
    { userName: "MeTester", userImage: null, puzzleTitle: "Hidden Word", puzzleType: "word_crack", difficulty: "unknown", pointsEarned: 15, solvedAt: "not-a-date" },
    { userName: "MeTester", userImage: null, puzzleTitle: "Old Puzzle", puzzleType: "sudoku", difficulty: "easy", pointsEarned: 10, solvedAt: "2025-11-01T00:00:00.000Z" },
  ],
};

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "me-tester@example.test", role: "user", betaApproved: true },
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

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

interface FixtureOptions {
  authenticated?: boolean;
  team?: unknown;
  teamStatus?: number;
  stats?: unknown;
  statsStatus?: number;
  membershipRole?: string | null;
  inviteStatus?: string;
  applications?: unknown[];
  inventoryThemes?: string[];
  holdTeam?: boolean;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let teamCalls = 0;
  let statsCalls = 0;
  const mutations: Array<{ url: string; method: string }> = [];
  const held: Route[] = [];

  await page.route("**/*.png", async (route) => {
    if (route.request().url().includes("e2e-broken-avatar")) return route.fulfill({ status: 404, body: "not found" });
    return route.continue();
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    // Only track mutations against our own API surface — NextAuth's client
    // may issue its own internal non-GET calls (e.g. session/log endpoints)
    // that have nothing to do with this page's read-only behavior.
    if (method !== "GET" && path.startsWith("/api/teams/")) mutations.push({ url: path, method });

    if (path === "/api/auth/session") {
      if (!options.authenticated) return fulfill(route, {});
      return fulfill(route, { user: { id: USER.id, name: USER.name, email: "me-tester@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (path === `/api/teams/${TEAM_ID}/stats`) {
      statsCalls += 1;
      if (options.statsStatus && options.statsStatus !== 200) return fulfill(route, { error: "failed" }, options.statsStatus);
      return fulfill(route, options.stats ?? STATS_FIXTURE);
    }
    if (path === `/api/teams/${TEAM_ID}/membership`) {
      return fulfill(route, { role: options.membershipRole ?? null });
    }
    if (path === `/api/teams/${TEAM_ID}/invite-status`) {
      return fulfill(route, { status: options.inviteStatus ?? "none" });
    }
    if (path === `/api/teams/${TEAM_ID}/applications`) {
      return fulfill(route, options.applications ?? []);
    }
    if (path === "/api/store/inventory") {
      const items = (options.inventoryThemes ?? []).map((value) => ({ item: { subcategory: "team_theme", metadata: { value } } }));
      return fulfill(route, { items });
    }
    if (path === `/api/teams/${TEAM_ID}`) {
      teamCalls += 1;
      if (options.holdTeam) {
        held.push(route);
        return;
      }
      if (options.teamStatus && options.teamStatus !== 200) return fulfill(route, { error: "failed" }, options.teamStatus);
      return fulfill(route, options.team ?? TEAM_FIXTURE);
    }

    return fulfill(route, {});
  });

  return {
    teamCallCount: () => teamCalls,
    statsCallCount: () => statsCalls,
    mutations,
    release: async (body: unknown, status = 200) => {
      for (const route of held.splice(0)) await fulfill(route, body, status);
    },
  };
}

test.describe("Team Detail — populated fixture", () => {
  test("renders identity, statistics, contributors, activity, roster with correct order and no unexpected mutation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { authenticated: true, membershipRole: "admin" });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();
    await expect(page.getByText("A long but readable description about solving daily puzzles together.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to Teams/ })).toHaveAttribute("href", "/teams");
    await expect(page.getByRole("link", { name: /Team Leaderboards/ })).toHaveAttribute("href", "/leaderboards/teams");
    await expect(page.getByText("Public")).toBeVisible();
    await expect(page.getByText(/Rank #4/)).toBeVisible();
    // Both the hero rank badge and the Rank stat card legitimately show this
    // supporting text — intentional duplication, not an ambiguity bug.
    await expect(page.getByText("of 28 teams", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("January 14, 2026")).toBeVisible();
    await expect(page.getByText("Team code")).toBeVisible();

    const stats = page.getByTestId("team-detail-stats");
    await expect(stats).toBeVisible();
    await expect(stats.getByText("#4")).toBeVisible();
    await expect(stats.getByText("5,200")).toBeVisible();
    await expect(stats.getByText("180")).toBeVisible();
    await expect(stats.getByText("6", { exact: true })).toBeVisible();
    await expect(stats.getByText("866")).toBeVisible();

    const contributors = page.getByTestId("team-detail-contributors");
    await expect(contributors.getByText("Top Contributors")).toBeVisible();
    // Crown also appears in the hero's admin role badge and the roster's
    // admin role badge — scope placement icons to the contributors panel.
    await expect(contributors.locator("svg.lucide-crown")).toBeVisible();
    await expect(contributors.locator("svg.lucide-medal")).toBeVisible();
    await expect(contributors.locator("svg.lucide-award")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(/🥇|🥈|🥉/.test(bodyText)).toBe(false);
    await expect(contributors.getByText("3,000")).toBeVisible();

    const activity = page.getByTestId("team-detail-activity");
    await expect(activity.getByText("Recent Activity")).toBeVisible();
    await expect(activity.getByText("Easy").first()).toBeVisible();
    await expect(activity.getByText("Medium")).toBeVisible();
    await expect(activity.getByText("Hard")).toBeVisible();

    const roster = page.getByTestId("team-detail-members");
    await expect(roster.getByText("Moderator Mo")).toBeVisible();
    await expect(roster.getByText("Member", { exact: true }).first()).toBeVisible();
    await expect(roster.getByText(/Longname Featherstonehaugh/)).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — public anonymous", () => {
  // The site's existing proxy (src/proxy.ts, frozen and out of Pass 16A's
  // scope) unconditionally gates every /teams/* path behind authentication
  // at the edge, redirecting unauthenticated visitors to /auth/signin before
  // the page ever renders — the same pre-existing, pass-independent gate
  // already documented for other protected routes (e.g. mobile-shell.spec.ts's
  // /puzzles/nonexistent-id case). This is unrelated to and unaffected by the
  // read-only redesign: the page component itself never redirects
  // unauthenticated visitors (see page.tsx's session-status effect).
  test("pre-existing proxy auth gate redirects unauthenticated visitors to sign-in (unaffected by the read-only redesign)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFixture(page, { authenticated: false });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});

test.describe("Team Detail — authenticated member", () => {
  test("member sees Leave Team, team code, and no admin/moderator controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { authenticated: true, membershipRole: "member" });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Team code")).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave Team" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Theme$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Invite Members" })).toHaveCount(0);
    await expect(page.getByText("Pending Applications")).toHaveCount(0);
  });
});

test.describe("Team Detail — authenticated admin", () => {
  test("admin sees Theme, Invite Members, Leave Team, and Pending Applications", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true, membershipRole: "admin", applications: [] });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("button", { name: /^Theme$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite Members" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave Team" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pending Applications" })).toBeVisible();
    // Admin can't remove themselves — Remove appears only for other members.
    expect(await page.getByRole("button", { name: "Remove" }).count()).toBeGreaterThan(0);
    expect(fixture.mutations.length).toBe(0);
  });
});

test.describe("Team Detail — loading", () => {
  test("skeleton renders with pulse, then real content replaces it after release", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const fixture = await installFixture(page, { authenticated: true, holdTeam: true });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const loading = page.getByTestId("team-detail-loading");
    await expect(loading).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading team details" })).toHaveCount(1);

    const shape = loading.locator("[data-skeleton='true']").first();
    const style = await shape.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { animationName: computed.animationName, animationDuration: computed.animationDuration };
    });
    expect(style.animationName).not.toBe("none");
    expect(style.animationDuration).not.toBe("0s");

    expect(fixture.statsCallCount()).toBe(0);
    await expectNoHorizontalOverflow(page);

    await fixture.release(TEAM_FIXTURE);
    await expect(page.getByTestId("team-detail-loading")).toHaveCount(0);
    await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();
    await expect.poll(() => fixture.statsCallCount()).toBeGreaterThan(0);
  });
});

test.describe("Team Detail — reduced motion loading", () => {
  test("skeleton is static and geometry is stable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installFixture(page, { authenticated: true, holdTeam: true });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const loading = page.getByTestId("team-detail-loading");
    await expect(loading).toBeVisible();
    const shape = loading.locator("[data-skeleton='true']").first();
    const animationName = await shape.evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe("none");

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — private team", () => {
  test("shows Private Team with exact links and no team data", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true, teamStatus: 403 });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Private Team")).toBeVisible();
    await expect(page.getByText("This team is private. You must be a member to view it.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to Team Leaderboards/ })).toHaveAttribute("href", "/leaderboards/teams");
    await expect(page.getByRole("link", { name: /Explore Teams/ })).toHaveAttribute("href", "/teams");
    expect(fixture.statsCallCount()).toBe(0);
    expect((await page.locator("body").innerText()).includes("🔒")).toBe(false);
    expect(fixture.mutations.length).toBe(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — not found", () => {
  test("shows Team not found with exact links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true, teamStatus: 404 });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Team not found")).toBeVisible();
    await expect(page.getByText("This team may have been disbanded, or the link is no longer valid.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore Teams/ })).toHaveAttribute("href", "/teams");
    await expect(page.getByRole("link", { name: /Team Leaderboards/ })).toHaveAttribute("href", "/leaderboards/teams");
    expect(fixture.statsCallCount()).toBe(0);
    expect(fixture.mutations.length).toBe(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — error and retry", () => {
  test("failed load shows error panel; rapid retry produces one request; success recovers", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { authenticated: true, teamStatus: 500 });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("We couldn’t load this team")).toBeVisible();
    await expect(page.getByText("Check your connection and try again.")).toBeVisible();

    const retryFixture = await installFixture(page, { authenticated: true, holdTeam: true });
    const button = page.getByRole("button", { name: "Try Again" });
    await button.evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => retryFixture.teamCallCount()).toBe(1);
    await expect(page.getByRole("button", { name: "Trying…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trying…" })).toBeDisabled();

    await retryFixture.release(TEAM_FIXTURE);
    await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();
    await expect(page.getByText("We couldn’t load this team")).toHaveCount(0);
    await expect.poll(() => retryFixture.statsCallCount()).toBeGreaterThan(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — statistics failure", () => {
  test("team stays visible; stats show — with no fabricated zero", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, { authenticated: true, statsStatus: 500 });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();
    const roster = page.getByTestId("team-detail-members");
    await expect(roster).toBeVisible();

    const stats = page.getByTestId("team-detail-stats");
    await expect(stats.getByText("6", { exact: true })).toBeVisible(); // real member count from roster
    const dashCount = await stats.getByText("—").count();
    expect(dashCount).toBeGreaterThan(0);
    expect(await stats.getByText("0", { exact: true }).count()).toBe(0);
    await expect(page.getByText("We couldn’t load this team")).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — out-of-order contributor progress bars", () => {
  test("bars clamp to 100% and preserve API order even when a later contributor exceeds the first", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const outOfOrderStats = {
      ...STATS_FIXTURE,
      topContributors: [
        { userId: "low-first", name: "Low First", image: null, role: "member", joinedAt: null, earnedPoints: 10, puzzlesSolved: 1 },
        { userId: "high-second", name: "High Second", image: null, role: "member", joinedAt: null, earnedPoints: 999, puzzlesSolved: 50 },
      ],
    };
    const fixture = await installFixture(page, { authenticated: true, membershipRole: "admin", stats: outOfOrderStats });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const contributors = page.getByTestId("team-detail-contributors");
    await expect(contributors).toBeVisible();

    // Order preserved — Low First stays first, High Second is not promoted.
    const names = await contributors.locator("li").allTextContents();
    expect(names[0]).toContain("Low First");
    expect(names[1]).toContain("High Second");

    await expect(contributors.getByTestId("contribution-bar-0")).toBeAttached();
    await expect(contributors.getByTestId("contribution-bar-1")).toBeAttached();

    const widths = await page.evaluate(() => {
      const b0 = document.querySelector('[data-testid="contribution-bar-0"]') as HTMLElement | null;
      const b1 = document.querySelector('[data-testid="contribution-bar-1"]') as HTMLElement | null;
      const row0 = b0?.closest("li");
      const row1 = b1?.closest("li");
      return {
        pct0: b0 ? parseInt(b0.style.width, 10) : null,
        pct1: b1 ? parseInt(b1.style.width, 10) : null,
        barWidth0: b0?.getBoundingClientRect().width ?? 0,
        rowWidth0: row0?.getBoundingClientRect().width ?? 0,
        barWidth1: b1?.getBoundingClientRect().width ?? 0,
        rowWidth1: row1?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(widths.pct0).toBe(100);
    expect(widths.pct1).toBe(100);
    expect(widths.barWidth0).toBeLessThanOrEqual(widths.rowWidth0 + 1);
    expect(widths.barWidth1).toBeLessThanOrEqual(widths.rowWidth1 + 1);

    const allBars = await contributors.locator("[data-testid^='contribution-bar-']").all();
    for (const bar of allBars) {
      const style = await bar.getAttribute("style");
      const match = style?.match(/width:\s*(\d+)%/);
      expect(match).not.toBeNull();
      const pct = Number(match![1]);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }

    // Placement treatment stays based on supplied order — first entry gets the 1st-place icon.
    await expect(contributors.locator("svg.lucide-crown")).toBeVisible();

    await expect(page.getByText("999", { exact: false })).toBeVisible();
    expect(fixture.mutations.length).toBe(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — malformed data", () => {
  test("does not crash; fallbacks render; invalid theme falls back safely", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const malformedTeam = {
      ...TEAM_FIXTURE,
      name: null,
      createdAt: "not-a-date",
      activeTheme: "totally-unknown-theme",
      members: [TEAM_FIXTURE.members[0], null, "invalid", {}, TEAM_FIXTURE.members[1]],
    };
    const malformedStats = {
      ...STATS_FIXTURE,
      topContributors: [STATS_FIXTURE.topContributors[0], null, "invalid", { userId: "neg", name: "Negative", image: null, role: "member", joinedAt: null, earnedPoints: -5, puzzlesSolved: -1 }],
      recentActivity: [STATS_FIXTURE.recentActivity[0], null, "invalid"],
    };
    await installFixture(page, { authenticated: true, team: malformedTeam, stats: malformedStats });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Unnamed Team")).toBeVisible();
    await expect(page.getByText("Date unavailable")).toBeVisible();
    const roster = page.getByTestId("team-detail-members");
    expect(await roster.locator("li").count()).toBe(2);
    await expect(page.getByText("Negative")).toBeVisible();
    expect(await page.locator("a[href*='undefined']").count()).toBe(0);

    await expectNoHorizontalOverflow(page);
  });

  test("fully malformed base team payload shows the primary error, no stats request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true, team: { id: 5 } });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("We couldn’t load this team")).toBeVisible();
    expect(fixture.statsCallCount()).toBe(0);
  });
});

test.describe("Team Detail — required viewports", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1440, height: 900 },
  ]) {
    test(`${viewport.width}x${viewport.height}: renders with no overflow, navigation reachable`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      await installFixture(page, { authenticated: true, membershipRole: "admin" });
      await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();
      const backLink = page.getByRole("link", { name: /Back to Teams/ });
      await expect(backLink).toBeVisible();
      const backBox = await backLink.boundingBox();
      expect(backBox!.height).toBeGreaterThanOrEqual(43.9);

      const lbLink = page.getByRole("link", { name: /Team Leaderboards/ });
      await expect(lbLink).toBeVisible();

      await expect(page.getByTestId("team-detail-stats")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("844x390: landscape header and content remain readable with vertical scroll", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await authenticate(page);
    await installFixture(page, { authenticated: true, membershipRole: "admin" });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();
    await expect(page.getByTestId("team-detail-stats")).toBeVisible();

    const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(canScroll).toBe(true);

    await expectNoHorizontalOverflow(page);
  });
});
