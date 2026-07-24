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
  applicationActionStatus?: number;
  holdApplicationActions?: boolean;
  inventoryThemes?: string[];
  holdTeam?: boolean;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let teamCalls = 0;
  let statsCalls = 0;
  const mutations: Array<{ url: string; method: string }> = [];
  const themeRequests: Array<{ method: string; body: unknown }> = [];
  const applicationRequests: Array<{ applicationId: string; method: string; body: unknown }> = [];
  const held: Route[] = [];
  const heldApplicationActions: Route[] = [];

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

    if (path === `/api/teams/${TEAM_ID}/theme`) {
      let parsedBody: unknown = null;
      try { parsedBody = request.postDataJSON(); } catch { /* ignore */ }
      themeRequests.push({ method, body: parsedBody });
      return fulfill(route, {});
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
    if (path.startsWith(`/api/teams/${TEAM_ID}/applications/`)) {
      const applicationId = path.slice(path.lastIndexOf("/") + 1);
      let parsedBody: unknown = null;
      try { parsedBody = request.postDataJSON(); } catch { /* ignore */ }
      applicationRequests.push({ applicationId, method, body: parsedBody });
      if (options.holdApplicationActions) {
        heldApplicationActions.push(route);
        return;
      }
      if (options.applicationActionStatus && options.applicationActionStatus !== 200) {
        return fulfill(route, { error: "failed" }, options.applicationActionStatus);
      }
      return fulfill(route, {});
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
    themeRequests,
    applicationRequests,
    release: async (body: unknown, status = 200) => {
      for (const route of held.splice(0)) await fulfill(route, body, status);
    },
    releaseApplicationAction: async (body: unknown, status = 200) => {
      for (const route of heldApplicationActions.splice(0)) await fulfill(route, body, status);
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
  // Pass 16A.1: the proxy now carries a narrow exception for the exact
  // /teams/[id] path, so an unauthenticated visitor reaches the page for a
  // public team instead of being redirected to /auth/signin. The primary
  // Team API and the page itself already handled anonymous viewing
  // correctly — this exercises that the routing layer now lets them.
  test("anonymous visitor reaches a public team, sees full read-only content, and no management controls or mutations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installFixture(page, { authenticated: false });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page).toHaveURL(new RegExp(`/teams/${TEAM_ID}$`));
    await expect(page).not.toHaveURL(/\/auth\/signin/);

    await expect(page.getByText("Midnight Puzzle Society")).toBeVisible();

    const stats = page.getByTestId("team-detail-stats");
    await expect(stats).toBeVisible();
    await expect(stats.getByText("#4")).toBeVisible();

    const contributors = page.getByTestId("team-detail-contributors");
    await expect(contributors.getByText("Top Contributors")).toBeVisible();
    await expect(contributors.getByText("3,000")).toBeVisible();

    const activity = page.getByTestId("team-detail-activity");
    await expect(activity.getByText("Recent Activity")).toBeVisible();

    const roster = page.getByTestId("team-detail-members");
    await expect(roster.getByText("Moderator Mo")).toBeVisible();

    await expect(page.getByRole("link", { name: "Sign in to Join" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Theme$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Invite Members" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Leave Team" })).toHaveCount(0);
    await expect(page.getByText("Pending Applications")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);

    expect(fixture.mutations.length).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — anonymous private team", () => {
  test("anonymous visitor reaches the route but sees only the Private Team panel, with no data exposure and no stats request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installFixture(page, { authenticated: false, teamStatus: 403 });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page).toHaveURL(new RegExp(`/teams/${TEAM_ID}$`));
    await expect(page).not.toHaveURL(/\/auth\/signin/);

    await expect(page.getByText("Private Team")).toBeVisible();
    await expect(page.getByText("This team is private. You must be a member to view it.")).toBeVisible();

    await expect(page.getByText("Midnight Puzzle Society")).toHaveCount(0);
    await expect(page.getByText("Moderator Mo")).toHaveCount(0);
    await expect(page.getByTestId("team-detail-stats")).toHaveCount(0);
    await expect(page.getByTestId("team-detail-contributors")).toHaveCount(0);
    await expect(page.getByTestId("team-detail-activity")).toHaveCount(0);

    expect(fixture.statsCallCount()).toBe(0);
    expect(fixture.mutations.length).toBe(0);
  });
});

test.describe("Team Detail — proxy boundary", () => {
  test("the Teams index remains protected for anonymous visitors", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFixture(page, { authenticated: false });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("a nested Team management-like path remains protected for anonymous visitors", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFixture(page, { authenticated: false });
    await page.goto(`/teams/${TEAM_ID}/settings`, { waitUntil: "domcontentloaded" });
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

test.describe("Team Detail — admin theme management (Pass 16B.1)", () => {
  test("admin opens the action deck theme picker, sees owned themes, and switching themes sends exactly one PUT with the exact body", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, {
      authenticated: true,
      membershipRole: "admin",
      applications: [],
      inventoryThemes: ["neon", "gold"],
    });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const actions = page.getByTestId("team-detail-actions");
    await expect(actions).toBeVisible();
    await expect(page.getByRole("button", { name: /^Theme$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite Members" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leave Team" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const themeButton = page.getByRole("button", { name: /^Theme$/ });
    await expect(themeButton).toHaveAttribute("aria-expanded", "false");
    await themeButton.click();
    await expect(themeButton).toHaveAttribute("aria-expanded", "true");

    const picker = page.getByTestId("team-theme-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId("team-theme-option-default")).toBeVisible();
    await expect(picker.getByTestId("team-theme-option-neon")).toBeVisible();
    await expect(picker.getByTestId("team-theme-option-gold")).toBeVisible();
    await expect(picker.getByTestId("team-theme-option-crimson")).toHaveCount(0);

    // TEAM_FIXTURE.activeTheme is "neon" — that tile should be marked active.
    await expect(picker.getByTestId("team-theme-option-neon")).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Close theme picker" }).click();
    await expect(picker).toHaveCount(0);
    expect(fixture.mutations.length).toBe(0);

    await themeButton.click();
    await expect(page.getByTestId("team-theme-picker")).toBeVisible();
    await page.getByTestId("team-theme-option-gold").click();

    await expect(page.getByTestId("team-theme-picker")).toHaveCount(0);
    expect(fixture.themeRequests.length).toBe(1);
    expect(fixture.themeRequests[0]!.method).toBe("PUT");
    expect(fixture.themeRequests[0]!.body).toEqual({ theme: "gold" });

    await themeButton.click();
    await expect(page.getByTestId("team-theme-option-gold")).toHaveAttribute("aria-pressed", "true");

    const teamMutations = fixture.mutations.filter((m) => !m.url.endsWith("/theme"));
    expect(teamMutations.length).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — moderator applications visibility (Pass 16B.2)", () => {
  test("moderator sees Pending Applications and its actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, {
      authenticated: true,
      membershipRole: "moderator",
      applications: [
        { id: "mod-app-1", createdAt: "2026-07-20T12:00:00.000Z", user: { id: "applicant-mod", name: "Mod Applicant", email: "mod-applicant@example.test", image: null } },
      ],
    });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const panel = page.getByTestId("team-applications-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Mod Applicant")).toBeVisible();
    await expect(page.getByTestId("team-application-approve-mod-app-1")).toBeVisible();
    await expect(page.getByTestId("team-application-deny-mod-app-1")).toBeVisible();
  });
});

test.describe("Team Detail — admin applications management (Pass 16B.2)", () => {
  test("admin reviews, approves, and denies applications with exact endpoints, bodies, and modal copy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const applicationFixture = [
      { id: "application-first", createdAt: "2026-07-20T12:00:00.000Z", user: { id: "applicant-1", name: "First Applicant", email: "first@example.test", image: null } },
      { id: "application-second", createdAt: "2026-07-19T12:00:00.000Z", user: { id: "applicant-2", name: null, email: "second@example.test", image: null } },
    ];
    const fixture = await installFixture(page, {
      authenticated: true,
      membershipRole: "admin",
      applications: applicationFixture,
      holdApplicationActions: true,
    });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const panel = page.getByTestId("team-applications-panel");
    await expect(panel).toBeVisible();

    // Both rows render in supplied API order.
    const rowIds = (await panel.locator("[data-testid^='team-application-row-']").all()).length;
    expect(rowIds).toBe(2);
    const rowTexts = await panel.locator("[data-testid^='team-application-row-']").allTextContents();
    expect(rowTexts[0]).toContain("First Applicant");
    expect(rowTexts[1]).toContain("second@example.test"); // name fallback: null name -> email

    // Dates render without "Invalid Date".
    expect(rowTexts.join(" ")).not.toMatch(/Invalid Date/);

    // Approve appears before Deny in the first row.
    const firstRowButtons = await page.getByTestId("team-application-row-application-first").getByRole("button").allTextContents();
    expect(firstRowButtons[0]).toContain("Approve");
    expect(firstRowButtons[1]).toContain("Deny");

    expect(fixture.applicationRequests.length).toBe(0);
    await expectNoHorizontalOverflow(page);

    const teamCallsBeforeApprove = fixture.teamCallCount();
    const statsCallsBeforeApprove = fixture.statsCallCount();

    // Hold the first approve request and verify the pending-state UI.
    await page.getByTestId("team-application-approve-application-first").click();
    await expect(page.getByTestId("team-application-approve-application-first")).toHaveText(/Approving…/);
    await expect(page.getByTestId("team-application-approve-application-first")).toBeDisabled();
    await expect(page.getByTestId("team-application-deny-application-first")).toBeDisabled();
    await expect(page.getByTestId("team-application-approve-application-second")).toBeDisabled();
    await expect(page.getByTestId("team-application-deny-application-second")).toBeDisabled();

    // A second activation while pending cannot create another request.
    await page.getByTestId("team-application-approve-application-first").click({ force: true });
    expect(fixture.applicationRequests.length).toBe(1);

    // Release the held approve request successfully.
    await fixture.releaseApplicationAction({});
    await expect(page.getByTestId("team-application-row-application-first")).toHaveCount(0);
    await expect(page.getByTestId("team-application-row-application-second")).toBeVisible();

    expect(fixture.applicationRequests.length).toBe(1);
    expect(fixture.applicationRequests[0]!.applicationId).toBe("application-first");
    expect(fixture.applicationRequests[0]!.body).toEqual({ action: "approve" });

    await expect(page.getByText("Applicant approved")).toBeVisible();
    await expect(page.getByText("The applicant has been added to the team.")).toBeVisible();
    // Approve performs exactly one primary Team refresh; stats are never refetched.
    expect(fixture.teamCallCount()).toBe(teamCallsBeforeApprove + 1);
    expect(fixture.statsCallCount()).toBe(statsCallsBeforeApprove);

    await page.getByRole("button", { name: "Close", exact: true }).click();

    const teamCallsBeforeDeny = fixture.teamCallCount();
    const statsCallsBeforeDeny = fixture.statsCallCount();

    // Deny the second application.
    await page.getByTestId("team-application-deny-application-second").click();
    await fixture.releaseApplicationAction({});
    await expect(page.getByTestId("team-application-row-application-second")).toHaveCount(0);
    await expect(page.getByText("No pending applications.")).toBeVisible();

    expect(fixture.applicationRequests.length).toBe(2);
    expect(fixture.applicationRequests[1]!.applicationId).toBe("application-second");
    expect(fixture.applicationRequests[1]!.body).toEqual({ action: "deny" });

    await expect(page.getByText("Applicant denied")).toBeVisible();
    await expect(page.getByText("The applicant has been denied.")).toBeVisible();

    // Denial performs no additional primary Team refresh and no stats refetch.
    expect(fixture.teamCallCount()).toBe(teamCallsBeforeDeny);
    expect(fixture.statsCallCount()).toBe(statsCallsBeforeDeny);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Team Detail — malformed applications payload (Pass 16B.2)", () => {
  test("malformed application rows are dropped safely; valid rows and fallbacks render", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page, {
      authenticated: true,
      membershipRole: "admin",
      applications: [
        { id: "valid-app", createdAt: "2026-07-20T12:00:00.000Z", user: { id: "u1", name: "Valid Applicant", email: null, image: null } },
        null,
        "invalid",
        { createdAt: "2026-07-20T12:00:00.000Z", user: { id: "u2", name: "No Id" } },
        { id: "bad-date-app", createdAt: "not-a-date", user: null },
      ],
    });
    await page.goto(`/teams/${TEAM_ID}`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const panel = page.getByTestId("team-applications-panel");
    await expect(panel).toBeVisible();

    const rows = await panel.locator("[data-testid^='team-application-row-']").all();
    expect(rows.length).toBe(2);

    const validRow = page.getByTestId("team-application-row-valid-app");
    const badDateRow = page.getByTestId("team-application-row-bad-date-app");
    await expect(validRow).toBeVisible();
    await expect(badDateRow).toBeVisible();
    await expect(validRow.getByText("Valid Applicant")).toBeVisible();
    await expect(badDateRow.getByText("Applicant", { exact: true })).toBeVisible(); // missing-user fallback
    await expect(badDateRow.getByText("Date unavailable")).toBeVisible(); // invalid date fallback
    expect(await page.locator("body").innerText()).not.toMatch(/Invalid Date/);

    await expectNoHorizontalOverflow(page);
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

      if (viewport.width === 320) {
        const actions = page.getByTestId("team-detail-actions");
        await expect(actions).toBeVisible();
        const themeBtn = page.getByRole("button", { name: /^Theme$/ });
        const inviteBtn = page.getByRole("button", { name: "Invite Members" });
        const leaveBtn = page.getByRole("button", { name: "Leave Team" });
        for (const btn of [themeBtn, inviteBtn, leaveBtn]) {
          const box = await btn.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.height).toBeGreaterThanOrEqual(43.9);
          // Single-column mobile layout — each action fills the available width.
          expect(box!.width).toBeGreaterThan(200);
        }
      }
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
