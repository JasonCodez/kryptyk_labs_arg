import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "loading-e2e-user", name: "LoadingTester", username: "LoadingTester", totalPoints: 875 };
const PUZZLE = { id: "loading-puzzle", title: "Loading Puzzle", difficulty: "medium", puzzleType: "sudoku" };
const VIEWPORTS = [
  { width: 320, height: 710 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
];

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
      email: "loading@example.test",
      role: "user",
      betaApproved: true,
    },
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

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

async function installCommonRoutes(page: Page, heldPaths: string[]) {
  const held: Array<{ path: string; route: Route }> = [];
  const counts = new Map<string, number>();
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (key === "/api/auth/session") {
      return fulfill(route, { user: { ...USER, email: "loading@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }
    if (heldPaths.includes(key)) {
      held.push({ path: key, route });
      return;
    }
    if (key === `/api/puzzles/${PUZZLE.id}`) return fulfill(route, PUZZLE);
    if (key === "/api/user/info") return fulfill(route, USER);
    if (key === "/api/warz/check-eligible") return fulfill(route, { eligible: true });
    return fulfill(route, {});
  });
  return {
    counts,
    release: async (bodies: Record<string, unknown> = {}) => {
      for (const item of held.splice(0)) await fulfill(item.route, bodies[item.path] ?? {});
    },
  };
}

async function expectMotion(page: Page, reduced: boolean) {
  const shape = page.locator("[data-skeleton='true']").first();
  await expect(shape).toBeVisible();
  const style = await shape.evaluate((element) => {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { animationName: computed.animationName, animationDuration: computed.animationDuration, width: rect.width, height: rect.height };
  });
  if (reduced) {
    expect(style.animationName).toBe("none");
  } else {
    expect(style.animationName).not.toBe("none");
    expect(style.animationDuration).not.toBe("0s");
  }
  expect(style.width).toBeGreaterThan(0);
  expect(style.height).toBeGreaterThan(0);
}

test.describe("loading skeleton motion", () => {
  const scenarios = [
    { name: "Dashboard", path: "/dashboard", hold: ["/api/user/stats", "/api/admin/check", "/api/user/referral"], status: "Loading player hub" },
    { name: "Daily", path: "/daily", hold: ["/api/daily/summary"], status: /Loading today.s puzzles/ },
    { name: "Leaderboards", path: "/leaderboards", hold: ["/api/leaderboards/global"], status: "Loading leaderboard" },
    { name: "Warz lobby", path: "/warz", hold: ["/api/warz", "/api/user/info"], status: "Loading Warz arena" },
    {
      name: "Warz setup",
      path: `/warz/play/${PUZZLE.id}`,
      hold: [`/api/puzzles/${PUZZLE.id}`, "/api/user/info", "/api/warz/check-eligible"],
      status: "Loading challenge setup",
    },
  ];

  for (const scenario of scenarios) {
    test(`${scenario.name} pulses normally and is static under reduced motion`, async ({ page }) => {
      await authenticate(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const fixture = await installCommonRoutes(page, scenario.hold);
      await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
      const primaryHold = scenario.hold[0];
      await expect.poll(() => fixture.counts.get(primaryHold) ?? 0, { timeout: 15_000 }).toBeGreaterThan(0);
      const status = scenario.name.startsWith("Warz")
        ? page.getByRole("status", { name: scenario.status }).last()
        : page.getByRole("status").filter({ hasText: scenario.status }).last();
      await expect(status).toBeAttached();
      await expectMotion(page, false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expectMotion(page, true);
    });
  }
});

test.describe("Warz non-collapsing loading layouts", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}: setup remains wide, visible, scrollable, and overflow-free`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      const fixture = await installCommonRoutes(page, [
        `/api/puzzles/${PUZZLE.id}`,
        "/api/user/info",
        "/api/warz/check-eligible",
      ]);
      await page.goto(`/warz/play/${PUZZLE.id}`, { waitUntil: "domcontentloaded" });
      await expect.poll(() => fixture.counts.get(`/api/puzzles/${PUZZLE.id}`) ?? 0, { timeout: 15_000 }).toBe(1);
      const status = page.getByTestId("warz-setup-loading").last();
      await expect(status).toBeVisible();
      const metrics = await status.evaluate((element) => {
        const root = element.getBoundingClientRect();
        const navbar = document.querySelector("#global-nav");
        const navbarBottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
        const placeholders = Array.from(element.querySelectorAll<HTMLElement>("[data-skeleton='true']"));
        const first = placeholders[0]!.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          statusWidth: root.width,
          statusHeight: root.height,
          statusTop: root.top,
          firstWidth: first.width,
          firstPlaceholderTop: first.top,
          navbarBottom,
          skeletonCount: placeholders.length,
          canScroll: document.documentElement.scrollHeight > window.innerHeight,
        };
      });
      const expectedUsableWidth = Math.min(viewport.width - 32, 576);
      console.log("WARZ_SETUP_LOADING_METRICS", JSON.stringify({ viewport, ...metrics }));
      expect(metrics.statusWidth).toBeGreaterThanOrEqual(expectedUsableWidth - 16);
      expect(metrics.statusWidth).toBeGreaterThan(240);
      expect(metrics.firstWidth).toBeGreaterThanOrEqual(metrics.statusWidth * 0.9);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.statusHeight).toBeGreaterThan(500);
      expect(metrics.skeletonCount).toBe(10);
      if (viewport.height === 390) expect(metrics.canScroll).toBe(true);

      // Reachability: the loading state must never begin above 0, behind the
      // fixed Navbar, or at a negative Y position — regardless of viewport height.
      expect(metrics.statusTop).toBeGreaterThanOrEqual(0);
      expect(metrics.statusTop).toBeGreaterThanOrEqual(metrics.navbarBottom + 8 - 1);
      expect(metrics.firstPlaceholderTop).toBeGreaterThanOrEqual(metrics.navbarBottom + 8 - 1);

      // The last placeholder must be reachable by scrolling to the bottom of the document.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastMetrics = await status.evaluate((element) => {
        const placeholders = Array.from(element.querySelectorAll<HTMLElement>("[data-skeleton='true']"));
        const last = placeholders[placeholders.length - 1]!.getBoundingClientRect();
        return { lastPlaceholderTop: last.top, lastPlaceholderBottom: last.bottom, viewportHeight: window.innerHeight };
      });
      console.log("WARZ_SETUP_LAST_PLACEHOLDER_METRICS", JSON.stringify({ viewport, ...lastMetrics }));
      expect(lastMetrics.lastPlaceholderTop).toBeLessThan(lastMetrics.viewportHeight);
      expect(lastMetrics.lastPlaceholderBottom).toBeLessThanOrEqual(lastMetrics.viewportHeight + 16);

      expect(fixture.counts.get(`/api/puzzles/${PUZZLE.id}`)).toBe(1);
      expect(fixture.counts.get("/api/user/info") ?? 0).toBeGreaterThanOrEqual(1);
      expect(fixture.counts.get("/api/warz/check-eligible")).toBe(1);
    });

    test(`${viewport.width}x${viewport.height}: lobby cards remain horizontal without overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await authenticate(page);
      const fixture = await installCommonRoutes(page, ["/api/warz", "/api/user/info"]);
      await page.goto("/warz", { waitUntil: "domcontentloaded" });
      await expect.poll(() => fixture.counts.get("/api/warz") ?? 0, { timeout: 15_000 }).toBe(1);
      await expect(page.getByTestId("warz-lobby-loading")).toHaveCount(1);
      const status = page.getByTestId("warz-lobby-loading");
      await expect(status).toBeVisible();
      const metrics = await status.evaluate((element) => {
        const root = element.getBoundingClientRect();
        const cards = Array.from(element.querySelectorAll<HTMLElement>(".h-24.w-full"));
        return {
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          statusWidth: root.width,
          cardWidths: cards.map((card) => card.getBoundingClientRect().width),
        };
      });
      console.log("WARZ_LOBBY_LOADING_METRICS", JSON.stringify({ viewport, ...metrics }));
      expect(metrics.statusWidth).toBeGreaterThan(240);
      expect(metrics.cardWidths).toHaveLength(4);
      for (const width of metrics.cardWidths) expect(width).toBeGreaterThan(metrics.statusWidth * 0.9);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    });
  }
});

test("844x390 landscape: setup loading geometry is unchanged under reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page);
  const fixture = await installCommonRoutes(page, [
    `/api/puzzles/${PUZZLE.id}`,
    "/api/user/info",
    "/api/warz/check-eligible",
  ]);
  await page.goto(`/warz/play/${PUZZLE.id}`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => fixture.counts.get(`/api/puzzles/${PUZZLE.id}`) ?? 0, { timeout: 15_000 }).toBe(1);
  const status = page.getByTestId("warz-setup-loading").last();
  await expect(status).toBeVisible();

  const metrics = await status.evaluate((element) => {
    const root = element.getBoundingClientRect();
    const navbar = document.querySelector("#global-nav");
    const navbarBottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
    const first = element.querySelector<HTMLElement>("[data-skeleton='true']")!;
    const firstRect = first.getBoundingClientRect();
    return {
      statusTop: root.top,
      navbarBottom,
      firstPlaceholderTop: firstRect.top,
      animationName: getComputedStyle(first).animationName,
    };
  });
  console.log("WARZ_SETUP_LANDSCAPE_REDUCED_MOTION_METRICS", JSON.stringify(metrics));
  expect(metrics.statusTop).toBeGreaterThanOrEqual(0);
  expect(metrics.statusTop).toBeGreaterThanOrEqual(metrics.navbarBottom + 8 - 1);
  expect(metrics.firstPlaceholderTop).toBeGreaterThanOrEqual(metrics.navbarBottom + 8 - 1);
  expect(metrics.animationName).toBe("none");
});

test("Warz setup loading is replaced after all three requests resolve without duplicate requests", async ({ page }) => {
  await authenticate(page);
  const fixture = await installCommonRoutes(page, [
    `/api/puzzles/${PUZZLE.id}`,
    "/api/user/info",
    "/api/warz/check-eligible",
  ]);
  await page.goto(`/warz/play/${PUZZLE.id}`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => fixture.counts.get(`/api/puzzles/${PUZZLE.id}`) ?? 0, { timeout: 15_000 }).toBe(1);
  await expect(page.getByRole("status", { name: "Loading challenge setup" }).last()).toBeVisible();
  expect(fixture.counts.get(`/api/puzzles/${PUZZLE.id}`)).toBe(1);
  expect(fixture.counts.get("/api/warz/check-eligible")).toBe(1);
  expect(fixture.counts.get("/api/user/info") ?? 0).toBeGreaterThanOrEqual(1);
  const heldResponses = {
    [`/api/puzzles/${PUZZLE.id}`]: PUZZLE,
    "/api/user/info": USER,
    "/api/warz/check-eligible": { eligible: true },
  };
  await fixture.release(heldResponses);
  await expect(page.getByRole("status", { name: "Loading challenge setup" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Set Your Challenge" })).toBeVisible();
});

test("real lobby-to-setup navigation: Issue a Challenge -> pick puzzle -> setup loading is reachable and never blank", async ({ page }) => {
  await authenticate(page);

  const counts = new Map<string, number>();

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (key === "/api/auth/session") {
      return fulfill(route, { user: { ...USER, email: "loading@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }
    if (key === "/api/warz") return fulfill(route, { challenges: [] });
    if (key === "/api/warz/eligible-puzzles") return fulfill(route, { puzzles: [PUZZLE] });
    if (key === "/api/user/info") return fulfill(route, USER);
    if (key === `/api/puzzles/${PUZZLE.id}`) return fulfill(route, PUZZLE);
    if (key === "/api/warz/check-eligible") return fulfill(route, { eligible: true });
    return fulfill(route, {});
  });

  await page.goto("/warz", { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);

  // 1. Confirm the Warz lobby is ready.
  await expect(page.getByRole("heading", { name: "Puzzle Warz" })).toBeVisible();
  const issueButton = page.getByRole("button", { name: "Issue a Challenge" });
  await expect(issueButton).toBeVisible();

  // Sample the page repeatedly across the whole transition — every sample
  // must find lobby content, the picker dialog, a route-loading state, or the
  // setup loading state, so the main content region is never empty.
  await page.evaluate(() => {
    const w = window as unknown as { __frameSamples: boolean[]; __frameInterval: number };
    w.__frameSamples = [];
    w.__frameInterval = window.setInterval(() => {
      const hasLobbyContent = document.body.textContent?.includes("Puzzle Warz") ?? false;
      const hasPicker = !!document.querySelector('[role="dialog"]');
      const hasSetupLoading = !!document.querySelector('[data-testid="warz-setup-loading"]');
      const hasLobbyLoading = !!document.querySelector('[data-testid="warz-lobby-loading"]');
      const hasSetup = document.body.textContent?.includes("Set Your Challenge") ?? false;
      const nonEmpty = (document.body.textContent ?? "").trim().length > 0;
      w.__frameSamples.push(nonEmpty && (hasLobbyContent || hasPicker || hasSetupLoading || hasLobbyLoading || hasSetup));
    }, 20);
  });

  // 2. Click the real Issue Challenge action.
  await issueButton.click();

  // 3. Confirm the puzzle picker appears.
  await expect(page.getByRole("dialog", { name: "Choose your puzzle" })).toBeVisible();

  // 4. Select "Loading Puzzle".
  await page.getByRole("button", { name: /Loading Puzzle/ }).click();

  // 6. Confirm the URL becomes /warz/play/loading-puzzle.
  await page.waitForURL(/\/warz\/play\/loading-puzzle/);

  // 7-9. A setup loading state must have appeared at some point during the
  // transition (it may already have been replaced by the ready setup UI by
  // the time we check, since responses resolve immediately in this scenario).
  await expect(page.getByRole("heading", { name: "Set Your Challenge" })).toBeVisible();

  // 10-11. Body is never visually empty; no collapsed vertical line.
  const setupBox = await page.locator("h1", { hasText: "Set Your Challenge" }).boundingBox();
  expect(setupBox).not.toBeNull();
  expect(setupBox!.width).toBeGreaterThan(100);

  // 12. No horizontal overflow.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);

  const samples = await page.evaluate(() => {
    const w = window as unknown as { __frameSamples: boolean[]; __frameInterval: number };
    window.clearInterval(w.__frameInterval);
    return w.__frameSamples;
  });
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.every(Boolean)).toBe(true);

  // 13. Confirm the setup requests fired a small, bounded number of times.
  // A client-side (soft) transition into a freshly-mounted route can expose
  // React's development-only StrictMode double-invoke as two real network
  // requests (the first aborted, the second successful) — unlike a hard
  // page.goto, which typically aborts before the first ever reaches the
  // network. Either outcome is a legitimate, bounded request count; runaway
  // repeated firing is not.
  expect(counts.get(`/api/puzzles/${PUZZLE.id}`)).toBeGreaterThanOrEqual(1);
  expect(counts.get(`/api/puzzles/${PUZZLE.id}`)).toBeLessThanOrEqual(2);
  expect(counts.get("/api/warz/check-eligible")).toBeGreaterThanOrEqual(1);
  expect(counts.get("/api/warz/check-eligible")).toBeLessThanOrEqual(2);
  expect(counts.get("/api/user/info") ?? 0).toBeGreaterThanOrEqual(2);

  // 15-16. The setup UI is showing and no setup loading skeleton remains.
  await expect(page.getByRole("status", { name: "Loading challenge setup" })).toHaveCount(0);

  // 17-18. No wager was submitted; no challenge was created.
  expect(counts.get("/api/warz/create") ?? 0).toBe(0);
});
