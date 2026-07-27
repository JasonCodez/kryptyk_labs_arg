import { expect, test, type Page, type Route } from "@playwright/test";

// Deterministic route mocks throughout — this spec never depends on a live
// database or production API. `/players` renders without authentication, so
// no session is set up here.

const PRIVATE_EMAIL = "alpha.private@example.test";

const ALPHA = {
  id: "player-1",
  name: "Alpha Player",
  email: PRIVATE_EMAIL,
  image: null,
  isPremium: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  stats: {
    puzzlesSolved: 5,
    totalPoints: 120,
    achievementsCount: 2,
    teamsCount: 1,
    followers: 4,
  },
};

const BRAVO_EMAIL = "bravo.private@example.test";
const BRAVO = {
  id: "player-2",
  name: "Bravo Player",
  email: BRAVO_EMAIL,
  image: null,
  isPremium: false,
  createdAt: "2026-01-02T00:00:00.000Z",
  stats: {
    puzzlesSolved: 1,
    totalPoints: 10,
    achievementsCount: 0,
    teamsCount: 0,
    followers: 0,
  },
};

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

interface FixtureOptions {
  users?: unknown[];
  onRequest?: (url: URL) => unknown[] | undefined;
}

async function installPlayersFixture(page: Page, options: FixtureOptions = {}) {
  const requestUrls: string[] = [];

  await page.route("**/api/users**", async (route) => {
    const url = new URL(route.request().url());
    requestUrls.push(route.request().url());

    const dynamic = options.onRequest?.(url);
    const users = dynamic ?? options.users ?? [ALPHA, BRAVO];
    return fulfill(route, { users, total: users.length, limit: 20, skip: 0 });
  });

  // Unknown /api/** requests (e.g. auth session probes) must never reach
  // production — safe empty-body fallback.
  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("/api/users")) return route.fallback();
    return fulfill(route, {});
  });

  return { requestUrls };
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

function makePlayer(overrides: Partial<typeof ALPHA> = {}) {
  return { ...ALPHA, ...overrides };
}

test.describe("Player directory — cards never expose email", () => {
  test("standard directory renders public data with no email anywhere", async ({ page }) => {
    await installPlayersFixture(page);

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: /Find Players/ })).toBeVisible();
    await expect(page.getByText("Alpha Player")).toBeVisible();
    await expect(page.getByText("120")).toBeVisible();
    await expect(page.getByText("💎", { exact: false })).toBeVisible();

    await expect(page.locator('a[href="/profile/player-1"]')).toBeVisible();

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain(PRIVATE_EMAIL);
    expect(bodyText).not.toContain(BRAVO_EMAIL);
    await expect(page.getByText(PRIVATE_EMAIL)).toHaveCount(0);

    const search = page.getByPlaceholder("Search players by name...");
    await expect(search).toBeVisible();
    await expect(page.getByLabel("Search players by name")).toBeVisible();

    expect(bodyText.toLowerCase()).not.toContain("name or email");
  });
});

test.describe("Player directory — missing display names", () => {
  test("null and blank names fall back to Anonymous, never to email or ID", async ({ page }) => {
    await installPlayersFixture(page, {
      users: [
        makePlayer({ id: "player-null", name: null }),
        makePlayer({ id: "player-blank", name: "   ", email: "blank-name@example.test" }),
      ],
    });

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const anonymousHeadings = page.getByRole("heading", { name: /^Anonymous/ });
    await expect(anonymousHeadings).toHaveCount(2);

    const avatars = page.getByLabel("Anonymous avatar");
    await expect(avatars).toHaveCount(2);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain("blank-name@example.test");
    expect(bodyText).not.toContain("player-null");
    expect(bodyText).not.toContain("player-blank");
  });
});

test.describe("Player directory — search stays name-based", () => {
  test("search request includes only the search parameter, never an email field", async ({ page }) => {
    const fixture = await installPlayersFixture(page, {
      onRequest: (url) => (url.searchParams.get("search") === "Alpha" ? [ALPHA] : [ALPHA, BRAVO]),
    });

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const search = page.getByPlaceholder("Search players by name...");
    await search.fill("Alpha");
    await expect.poll(() => fixture.requestUrls.some((u) => u.includes("search=Alpha"))).toBe(true);

    const lastUrl = new URL(fixture.requestUrls[fixture.requestUrls.length - 1]);
    expect(lastUrl.searchParams.get("search")).toBe("Alpha");
    expect(lastUrl.searchParams.has("email")).toBe(false);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.toLowerCase()).not.toContain("email");
    expect(bodyText).not.toContain(PRIVATE_EMAIL);
  });
});

test.describe("Player directory — sort behavior", () => {
  test("clicking Points sends sortBy=points and keeps content visible with no email", async ({ page }) => {
    const fixture = await installPlayersFixture(page);

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByRole("button", { name: "Points" }).click();
    await expect.poll(() => fixture.requestUrls.some((u) => u.includes("sortBy=points"))).toBe(true);

    await expect(page.getByText("Alpha Player")).toBeVisible();
    await expect(page.getByText("120")).toBeVisible();

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain(PRIVATE_EMAIL);
  });
});

test.describe("Player directory — Load More", () => {
  test("Load More appends players via skip=20 with no email in either batch", async ({ page }) => {
    const firstBatch = Array.from({ length: 20 }, (_, i) =>
      makePlayer({ id: `player-batch1-${i}`, name: `First Player ${i}`, email: `first${i}@example.test` })
    );
    const secondBatch = [
      makePlayer({ id: "player-batch2-0", name: "Second Player 0", email: "second0@example.test" }),
      makePlayer({ id: "player-batch2-1", name: "Second Player 1", email: "second1@example.test" }),
    ];

    const fixture = await installPlayersFixture(page, {
      onRequest: (url) => (url.searchParams.get("skip") === "20" ? secondBatch : firstBatch),
    });

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const loadMoreButton = page.getByRole("button", { name: "Load More Players" });
    await expect(loadMoreButton).toBeVisible();
    await expect(page.getByText("First Player 0")).toBeVisible();

    await loadMoreButton.click();
    await expect.poll(() => fixture.requestUrls.some((u) => u.includes("skip=20"))).toBe(true);

    await expect(page.getByText("Second Player 0")).toBeVisible();
    await expect(page.getByText("Second Player 1")).toBeVisible();
    await expect(page.getByText("First Player 0")).toBeVisible();

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toMatch(/@example\.test/);
  });

  test("Load More shows a loading label while the next batch is in flight", async ({ page }) => {
    const firstBatch = Array.from({ length: 20 }, (_, i) => makePlayer({ id: `player-batch1-${i}`, name: `First Player ${i}` }));
    let releaseSecondBatch: (() => void) | null = null;
    const held = new Promise<void>((resolve) => {
      releaseSecondBatch = resolve;
    });

    await page.route("**/api/users**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("skip") === "20") {
        await held;
        return fulfill(route, { users: [makePlayer({ id: "player-batch2-0", name: "Second Player 0" })], total: 1, limit: 20, skip: 20 });
      }
      return fulfill(route, { users: firstBatch, total: firstBatch.length, limit: 20, skip: 0 });
    });
    await page.route("**/api/**", async (route) => {
      if (route.request().url().includes("/api/users")) return route.fallback();
      return fulfill(route, {});
    });

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const loadMoreButton = page.getByRole("button", { name: "Load More Players" });
    await expect(loadMoreButton).toBeVisible();
    await loadMoreButton.click();

    await expect(page.getByRole("button", { name: "Loading..." })).toBeVisible();
    releaseSecondBatch!();
    await expect(page.getByText("Second Player 0")).toBeVisible();
  });
});

test.describe("Player directory — malformed response safety", () => {
  test("a malformed row is dropped; the valid player renders with no email or unknown fields", async ({ page }) => {
    await installPlayersFixture(page, {
      users: [
        makePlayer({ id: "player-1" }),
        { id: "player-broken", stats: "not-an-object", unexpected: { email: "leak@example.test" } },
        null,
        "not-an-object",
      ],
    });

    let pageErrored = false;
    page.on("pageerror", () => {
      pageErrored = true;
    });

    await page.goto("/players", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText("Alpha Player")).toBeVisible();
    expect(pageErrored).toBe(false);

    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain(PRIVATE_EMAIL);
    expect(bodyText).not.toContain("leak@example.test");
    expect(bodyText).not.toContain("player-broken");
  });
});

test.describe("Player directory — responsive", () => {
  for (const vp of [
    { name: "320x710", width: 320, height: 710 },
    { name: "390x844", width: 390, height: 844 },
    { name: "1440x900", width: 1440, height: 900 },
  ]) {
    test(`${vp.name}: no overflow, search and sort reachable, no email`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await installPlayersFixture(page);

      await page.goto("/players", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      await expectNoHorizontalOverflow(page);
      await expect(page.getByPlaceholder("Search players by name...")).toBeVisible();
      await expect(page.getByRole("button", { name: "Points" })).toBeVisible();
      await expect(page.getByText("Alpha Player")).toBeVisible();
      await expect(page.getByText("120")).toBeVisible();
      await expect(page.locator('a[href="/profile/player-1"]')).toBeVisible();

      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).not.toContain(PRIVATE_EMAIL);
    });
  }
});
