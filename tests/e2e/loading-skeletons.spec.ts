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
        const first = element.querySelector<HTMLElement>("[data-skeleton='true']")!.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          statusWidth: root.width,
          statusHeight: root.height,
          firstWidth: first.width,
          skeletonCount: element.querySelectorAll("[data-skeleton='true']").length,
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
