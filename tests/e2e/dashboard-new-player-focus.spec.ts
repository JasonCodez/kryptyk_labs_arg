import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "focus-mode-user", name: "FocusPlayer", email: "focusmode@example.test" };

const ZERO_STATS = { totalPuzzlesSolved: 0, totalPoints: 0, currentTeams: 0, rank: null };
const DEFAULT_REFERRAL = { inviteCode: "ABC123", link: "https://puzzlewarz.com/invite/ABC123", signedUp: 0 };
const DEFAULT_DEBRIEF = { caseNumber: 12, classification: "Confidential", completed: false, stats: { totalPlays: 5 } };

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: {
      sub: USER.id,
      id: USER.id,
      name: USER.name,
      email: USER.email,
      role: "user",
      betaApproved: true,
    },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

function onboardingStateJson(status: string, overrides: { completedAt?: string | null } = {}): string {
  const now = new Date().toISOString();
  return JSON.stringify({
    version: 1,
    status,
    currentStep: "daily_introduced",
    completedSteps: ["welcome", "first_puzzle_started", "first_puzzle_completed"],
    dismissedTips: [],
    startedAt: now,
    updatedAt: now,
    completedAt: overrides.completedAt !== undefined ? overrides.completedAt : status === "completed" ? now : null,
  });
}

// Seeds the existing onboarding localStorage key before any page script
// runs — matches the model in src/lib/onboarding.ts exactly.
async function seedOnboarding(page: Page, status: string) {
  const key = `pw_onboarding_v1_${USER.id}`;
  const value = onboardingStateJson(status);
  await page.addInitScript(
    ({ key: k, value: v }) => {
      window.localStorage.setItem(k, v);
    },
    { key, value }
  );
}

interface DashboardFixtureOptions {
  stats?: unknown | "error";
  statsHold?: boolean;
  admin?: { isAdmin: boolean };
  adminHold?: boolean;
  referral?: unknown | null;
  referralHold?: boolean;
  debrief?: unknown | null;
}

// Fully intercepts every /api/** request the dashboard (and its child
// components) can make. No request ever reaches a real database,
// production, a real auth service, Google, Facebook, or a real referral
// service.
async function installDashboardFixture(page: Page, options: DashboardFixtureOptions = {}) {
  const counts = new Map<string, number>();
  const held: Array<{ path: string; route: Route }> = [];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    counts.set(path, (counts.get(path) ?? 0) + 1);

    if (path === "/api/auth/session") {
      return fulfill(route, { user: { ...USER }, expires: "2099-01-01T00:00:00.000Z" });
    }
    if (path === "/api/auth/csrf") return fulfill(route, { csrfToken: "test-csrf-token" });
    if (path === "/api/auth/providers") return fulfill(route, {});

    if (path === "/api/user/stats") {
      if (options.statsHold) {
        held.push({ path, route });
        return;
      }
      if (options.stats === "error") {
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      return fulfill(route, options.stats ?? ZERO_STATS);
    }

    if (path === "/api/admin/check") {
      if (options.adminHold) {
        held.push({ path, route });
        return;
      }
      return fulfill(route, options.admin ?? { isAdmin: false });
    }

    if (path === "/api/user/referral") {
      if (options.referralHold) {
        held.push({ path, route });
        return;
      }
      if (options.referral === null) {
        return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      }
      return fulfill(route, options.referral ?? DEFAULT_REFERRAL);
    }

    if (path === "/api/debrief/today") {
      if (options.debrief === null) {
        return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      }
      return fulfill(route, options.debrief ?? DEFAULT_DEBRIEF);
    }

    // Unknown dashboard-adjacent request — recorded above, safe empty body.
    return fulfill(route, {});
  });

  return {
    counts,
    release: async (bodies: Record<string, unknown> = {}) => {
      for (const item of held.splice(0)) {
        await fulfill(item.route, bodies[item.path] ?? {});
      }
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

test.describe("Dashboard New-Player Focus — active onboarding, zero stats", () => {
  test("shows only Starter Path, the focus panel, and Play navigation", async ({ page }) => {
    await seedOnboarding(page, "active");
    await authenticate(page);
    await installDashboardFixture(page, { stats: ZERO_STATS, admin: { isAdmin: false } });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // The global Navbar (outside <main>, always present) has its own links
    // for Warz/Achievements/FAQ/etc. — scope dashboard-content assertions to
    // <main> (DashboardPageShell's own element) so they can never collide.
    const dashboardMain = page.locator("main");

    await expect(page.getByRole("region", { name: "Starter Path" })).toBeVisible();
    await expect(page.getByTestId("dashboard-new-player-focus")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Start with the essentials" })).toBeVisible();

    await expect(page.getByTestId("dashboard-navigation-starter")).toBeVisible();
    await expect(page.getByTestId("dashboard-navigation-full")).toHaveCount(0);

    await expect(dashboardMain.getByRole("link", { name: /Daily Challenge/ })).toBeVisible();
    await expect(dashboardMain.getByRole("link", { name: /Puzzle Library/ })).toBeVisible();
    await expect(dashboardMain.getByRole("link", { name: /Browse Categories/ })).toBeVisible();

    await expect(dashboardMain.getByRole("heading", { name: "The Debrief" })).toHaveCount(0);
    await expect(dashboardMain.getByRole("heading", { name: "Your Progress" })).toHaveCount(0);
    await expect(dashboardMain.getByRole("heading", { name: "Invite Friends" })).toHaveCount(0);
    await expect(dashboardMain.getByRole("link", { name: /^Warz/ })).toHaveCount(0);
    await expect(dashboardMain.getByRole("link", { name: /Leaderboards/ })).toHaveCount(0);
    await expect(dashboardMain.getByRole("link", { name: /Achievements/ })).toHaveCount(0);
    await expect(dashboardMain.getByRole("link", { name: /FAQ/ })).toHaveCount(0);
    await expect(dashboardMain.getByRole("heading", { name: "Manage" })).toHaveCount(0);
    await expect(dashboardMain.getByRole("heading", { name: "Moderate" })).toHaveCount(0);

    const reveal = page.getByTestId("show-full-dashboard-button");
    const box = await reveal.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.9);
  });
});

test.describe("Dashboard New-Player Focus — paused onboarding, zero stats", () => {
  test("Focus Mode also appears", async ({ page }) => {
    await seedOnboarding(page, "paused");
    await authenticate(page);
    await installDashboardFixture(page, { stats: ZERO_STATS });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("dashboard-new-player-focus")).toBeVisible();
    await expect(page.getByTestId("dashboard-navigation-starter")).toBeVisible();
  });
});

test.describe("Dashboard New-Player Focus — reveal full dashboard", () => {
  test("reveal shows the full dashboard, leaves onboarding untouched, and makes no extra requests", async ({ page }) => {
    await seedOnboarding(page, "active");
    await authenticate(page);
    const fixture = await installDashboardFixture(page, {
      stats: ZERO_STATS,
      admin: { isAdmin: false },
      referral: DEFAULT_REFERRAL,
      debrief: DEFAULT_DEBRIEF,
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dashboard-new-player-focus")).toBeVisible();

    const key = `pw_onboarding_v1_${USER.id}`;
    const before = await page.evaluate((k) => window.localStorage.getItem(k), key);

    const statsCountBefore = fixture.counts.get("/api/user/stats") ?? 0;
    const adminCountBefore = fixture.counts.get("/api/admin/check") ?? 0;
    const referralCountBefore = fixture.counts.get("/api/user/referral") ?? 0;
    // DashboardFeaturedMission (which owns the debrief request) isn't
    // rendered at all in Focus Mode, so it hasn't fetched yet — its first
    // fetch happens on mount right after reveal. That's expected, not a
    // redundant re-fetch, so it's asserted separately below rather than
    // included in the "no extra requests" checks for stats/admin/referral.
    const debriefCountBefore = fixture.counts.get("/api/debrief/today") ?? 0;
    expect(debriefCountBefore).toBe(0);

    await page.getByTestId("show-full-dashboard-button").click();

    await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Starter Path" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Debrief" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invite Friends" })).toBeVisible();
    await expect(page.getByTestId("dashboard-navigation-full")).toBeVisible();
    const revealedMain = page.locator("main");
    await expect(revealedMain.getByRole("link", { name: /^Warz/ })).toBeVisible();
    await expect(revealedMain.getByRole("link", { name: /Leaderboards/ })).toBeVisible();
    await expect(revealedMain.getByRole("link", { name: /Achievements/ })).toBeVisible();
    await expect(revealedMain.getByRole("link", { name: /FAQ/ })).toBeVisible();
    await expect(page.getByTestId("show-full-dashboard-button")).toHaveCount(0);

    const after = await page.evaluate((k) => window.localStorage.getItem(k), key);
    expect(after).toBe(before);

    expect(fixture.counts.get("/api/user/stats") ?? 0).toBe(statsCountBefore);
    expect(fixture.counts.get("/api/admin/check") ?? 0).toBe(adminCountBefore);
    expect(fixture.counts.get("/api/user/referral") ?? 0).toBe(referralCountBefore);
    // Expected new fetch(es): the newly-mounted DashboardFeaturedMission
    // loads its debrief data for the first time now that it's rendered
    // (dev-mode double-effect invocation can fire this more than once —
    // that's DashboardFeaturedMission's own frozen behavior, not something
    // this test asserts on).
    expect(fixture.counts.get("/api/debrief/today") ?? 0).toBeGreaterThan(0);

    expect(page.url()).toContain("/dashboard");
  });
});

test.describe("Dashboard New-Player Focus — completed onboarding, zero stats", () => {
  test("normal full dashboard, no Starter Path, no Focus panel", async ({ page }) => {
    await seedOnboarding(page, "completed");
    await authenticate(page);
    await installDashboardFixture(page, { stats: ZERO_STATS });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Starter Path" })).toHaveCount(0);
    await expect(page.getByTestId("dashboard-navigation-full")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible();
  });
});

test.describe("Dashboard New-Player Focus — skipped onboarding, zero stats", () => {
  test("normal full dashboard behavior", async ({ page }) => {
    await seedOnboarding(page, "skipped");
    await authenticate(page);
    await installDashboardFixture(page, { stats: ZERO_STATS });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Starter Path" })).toHaveCount(0);
    await expect(page.getByTestId("dashboard-navigation-full")).toBeVisible();
  });
});

test.describe("Dashboard New-Player Focus — meaningful progress prevents Focus Mode", () => {
  for (const [label, statsOverride] of [
    ["puzzles solved > 0", { ...ZERO_STATS, totalPuzzlesSolved: 1 }],
    ["points > 0", { ...ZERO_STATS, totalPoints: 100 }],
    ["teams > 0", { ...ZERO_STATS, currentTeams: 1 }],
    ["rank !== null", { ...ZERO_STATS, rank: 42 }],
  ] as const) {
    test(`${label} disables Focus Mode`, async ({ page }) => {
      await seedOnboarding(page, "active");
      await authenticate(page);
      await installDashboardFixture(page, { stats: statsOverride });

      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Starter Path" })).toBeVisible();
      await expect(page.getByTestId("dashboard-navigation-full")).toBeVisible();
    });
  }
});

test.describe("Dashboard New-Player Focus — admin exclusion", () => {
  test("admins never see Focus Mode, even with active onboarding and zero stats", async ({ page }) => {
    await seedOnboarding(page, "active");
    await authenticate(page);
    await installDashboardFixture(page, { stats: ZERO_STATS, admin: { isAdmin: true } });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-navigation-full")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Manage" })).toBeVisible();
  });
});

test.describe("Dashboard New-Player Focus — stats failure safety", () => {
  test("a failed stats request never triggers Focus Mode and uses existing fallbacks", async ({ page }) => {
    await seedOnboarding(page, "active");
    await authenticate(page);
    await installDashboardFixture(page, { stats: "error" });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-navigation-full")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Progress" })).toBeVisible();
  });
});

test.describe("Dashboard New-Player Focus — no full-dashboard flash", () => {
  test("loading state persists until data settles, and Focus Mode is the first settled state", async ({ page }) => {
    await seedOnboarding(page, "active");
    await authenticate(page);
    const fixture = await installDashboardFixture(page, { statsHold: true, adminHold: true, referralHold: true });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect.poll(() => fixture.counts.get("/api/user/stats") ?? 0).toBeGreaterThan(0);
    await expect(page.getByRole("status").filter({ hasText: "Loading player hub" })).toBeAttached();
    await expect(page.getByTestId("dashboard-navigation-full")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-new-player-focus")).toHaveCount(0);

    await page.evaluate(() => {
      const w = window as unknown as { __fullNavSamples: boolean[]; __sampleInterval: number };
      w.__fullNavSamples = [];
      w.__sampleInterval = window.setInterval(() => {
        w.__fullNavSamples.push(!!document.querySelector('[data-testid="dashboard-navigation-full"]'));
      }, 20);
    });

    await fixture.release({
      "/api/user/stats": ZERO_STATS,
      "/api/admin/check": { isAdmin: false },
      "/api/user/referral": DEFAULT_REFERRAL,
    });

    await expect(page.getByTestId("dashboard-new-player-focus")).toBeVisible();

    const samples = await page.evaluate(() => {
      const w = window as unknown as { __fullNavSamples: boolean[]; __sampleInterval: number };
      window.clearInterval(w.__sampleInterval);
      return w.__fullNavSamples;
    });
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.some(Boolean)).toBe(false);
  });
});

test.describe("Dashboard New-Player Focus — responsive", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`${viewport.width}x${viewport.height}: no overflow, single-column starter nav, reachable links`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedOnboarding(page, "active");
      await authenticate(page);
      await installDashboardFixture(page, { stats: ZERO_STATS });

      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("region", { name: "Starter Path" })).toBeVisible();
      await expect(page.getByTestId("dashboard-new-player-focus")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const reveal = page.getByTestId("show-full-dashboard-button");
      const revealBox = await reveal.boundingBox();
      expect(revealBox!.x).toBeGreaterThanOrEqual(0);
      expect(revealBox!.x + revealBox!.width).toBeLessThanOrEqual(viewport.width + 1);

      const nav = page.getByTestId("dashboard-navigation-starter");
      const columns = await nav.evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
      expect(columns).toBe(1);

      await expect(page.getByRole("link", { name: /Daily Challenge/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Puzzle Library/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Browse Categories/ })).toBeVisible();
    });
  }
});
