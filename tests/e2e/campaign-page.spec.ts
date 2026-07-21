import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

// Pass 5 campaign progression shell coverage for /puzzles/type/[puzzleType].
// Run via `npx playwright test`, not Jest (excluded from jest.config.js).

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const sessionToken = await encode({
    secret,
    maxAge: 60 * 60,
    token: { sub: "e2e-user", id: "e2e-user", name: "Campaign Tester", email: "campaign@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: sessionToken, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

type FixturePuzzle = Record<string, unknown>;

const CATEGORY = { id: "cat-sudoku", name: "Sudoku", puzzleCount: 4 };

// The exact 4-challenge Sudoku fixture required by the pass: one solved, one
// playable (recommended next), one locked behind it, and a locked boss finale.
const SUDOKU_FIXTURE: FixturePuzzle[] = [
  {
    id: "sudoku-1",
    title: "First Steps",
    description: "Warm up with a gentle 4x4 grid.",
    difficulty: "easy",
    order: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    pointsReward: 10,
    xpReward: 25,
    puzzleType: "sudoku",
    category: CATEGORY,
    locked: false,
    unlocksAfterTitle: null,
    isBossPuzzle: false,
    isTeamPuzzle: false,
    userProgress: [{ solved: true }],
  },
  {
    id: "sudoku-2",
    title: "The Next Grid",
    description: "A standard 9x9 grid.",
    difficulty: "medium",
    order: 2,
    createdAt: "2024-01-02T00:00:00.000Z",
    pointsReward: 15,
    xpReward: 35,
    puzzleType: "sudoku",
    category: CATEGORY,
    locked: false,
    unlocksAfterTitle: null,
    isBossPuzzle: false,
    isTeamPuzzle: false,
    userProgress: [{ solved: false }],
  },
  {
    id: "sudoku-3",
    title: "Hidden Pattern",
    description: "Find the diagonal constraint.",
    difficulty: "hard",
    order: 3,
    createdAt: "2024-01-03T00:00:00.000Z",
    pointsReward: 20,
    xpReward: 45,
    puzzleType: "sudoku",
    category: CATEGORY,
    locked: true,
    unlocksAfterTitle: "The Next Grid",
    isBossPuzzle: false,
    isTeamPuzzle: false,
    userProgress: [{ solved: false }],
  },
  {
    id: "sudoku-4",
    title: "Master Grid",
    description: "The campaign finale.",
    difficulty: "expert",
    order: 4,
    createdAt: "2024-01-04T00:00:00.000Z",
    pointsReward: 50,
    xpReward: 100,
    puzzleType: "sudoku",
    category: CATEGORY,
    locked: true,
    unlocksAfterTitle: "Hidden Pattern",
    isBossPuzzle: true,
    isTeamPuzzle: false,
    userProgress: [{ solved: false }],
  },
];

async function installApiMocks(page: Page, puzzles: FixturePuzzle[]) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, "");

    if (path === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({
          user: { id: "e2e-user", name: "Campaign Tester", email: "campaign@example.test" },
          expires: "2099-01-01T00:00:00.000Z",
        }),
      });
      return;
    }

    if (path === "/api/puzzles") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(puzzles) });
      return;
    }

    if (path === "/api/puzzle-categories") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([CATEGORY]) });
      return;
    }

    if (path === "/api/users/count") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: 4200 }) });
      return;
    }

    await route.continue();
  });
}

async function gotoCampaign(page: Page, puzzles: FixturePuzzle[], puzzleType = "sudoku") {
  await authenticate(page);
  await installApiMocks(page, puzzles);
  await page.goto(`/puzzles/type/${puzzleType}`, { waitUntil: "domcontentloaded" });
}

const MOBILE_VIEWPORTS = [
  { label: "320x710", width: 320, height: 710 },
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
];

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`campaign page @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("header, overview, path ordering, and bottom-nav clearance", async ({ page }) => {
      await gotoCampaign(page, SUDOKU_FIXTURE);

      await expect(page.getByRole("heading", { level: 1, name: "Sudoku" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("link", { name: /Puzzle Library/ })).toBeAttached();
      await expectNoHorizontalOverflow(page);

      const clearedStat = page.getByText("Cleared").locator("xpath=ancestor::div[1]");
      await expect(clearedStat.getByText("1", { exact: true })).toBeVisible();
      const bar = page.getByRole("progressbar");
      await expect(bar).toHaveAttribute("aria-valuenow", "1");
      await expect(bar).toHaveAttribute("aria-valuemax", "4");

      await expect(page.getByText("Boss finale")).toBeVisible();

      const path = page.getByTestId("campaign-challenge-path");
      await expect(path.getByRole("button", { name: /The Next Grid — Up next/ })).toBeVisible();

      const lockedCard = path
        .locator('div[aria-disabled="true"]')
        .filter({ has: page.getByRole("heading", { name: "Hidden Pattern", exact: true }) });
      await expect(lockedCard).toBeVisible();
      await expect(lockedCard.getByText("Locked")).toBeVisible();

      const bossCard = path
        .locator('div[aria-disabled="true"]')
        .filter({ has: page.getByRole("heading", { name: "Master Grid", exact: true }) });
      await expect(bossCard).toContainText("Boss");

      // Vertical ordering: each subsequent card sits below the previous one.
      const boxes = await Promise.all(
        ["First Steps", "The Next Grid", "Hidden Pattern", "Master Grid"].map((title) =>
          path.getByText(title, { exact: true }).first().boundingBox()
        )
      );
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
      }

      await expectNoHorizontalOverflow(page);

      const upNextButton = path.getByRole("button", { name: /The Next Grid — Up next/ });
      const box = await upNextButton.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const nav = await page.locator(".pw-bottom-nav").boundingBox();
      const lastCard = await path.getByText("Master Grid").first().boundingBox();
      if (nav) {
        expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(nav.y + 40);
      }
    });
  });
}

test.describe("campaign page continue action", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Continue campaign begins navigation toward the recommended puzzle", async ({ page }) => {
    await gotoCampaign(page, SUDOKU_FIXTURE);
    const continueButton = page.getByRole("button", { name: "Continue campaign" });
    await expect(continueButton).toBeVisible({ timeout: 10000 });

    await continueButton.click();
    await page.waitForURL(/\/puzzles\/sudoku-2/, { timeout: 20000, waitUntil: "commit" }).catch(async () => {
      // Individual puzzle route may require further unmocked APIs to fully
      // load; a committed URL change is sufficient evidence of navigation.
      await expect(page).toHaveURL(/\/puzzles\/sudoku-2/);
    });
  });
});

test.describe("campaign page completed-challenge activation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens the existing Already Completed modal and stays on the campaign route", async ({ page }) => {
    await gotoCampaign(page, SUDOKU_FIXTURE);
    const path = page.getByTestId("campaign-challenge-path");
    await expect(path.getByRole("button", { name: /First Steps — Completed/ })).toBeVisible({ timeout: 10000 });

    await path.getByRole("button", { name: /First Steps — Completed/ }).click();

    await expect(page.getByRole("heading", { name: "Already Completed" })).toBeVisible();
    await expect(page.getByText("You've already completed and claimed the rewards for this puzzle.")).toBeVisible();

    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("heading", { name: "Already Completed" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/puzzles\/type\/sudoku/);
  });
});

test.describe("campaign page locked challenge", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("is not a button, shows the unlock requirement, and keyboard focus skips it", async ({ page }) => {
    await gotoCampaign(page, SUDOKU_FIXTURE);
    const path = page.getByTestId("campaign-challenge-path");
    await expect(path.getByRole("heading", { name: "Hidden Pattern", exact: true })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("button", { name: /Hidden Pattern/ })).toHaveCount(0);
    await expect(page.getByText('Complete "The Next Grid" first')).toBeVisible();

    const startUrl = page.url();

    // The two locked cards (Hidden Pattern, Master Grid) render as plain,
    // non-focusable <div>s — confirm nothing in the tab order exposes them.
    const focusableNames: string[] = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return el.getAttribute("aria-label") || el.textContent || "";
      });
      if (name === null) break;
      focusableNames.push(name);
    }
    expect(focusableNames.some((name) => name.includes("Hidden Pattern"))).toBe(false);
    expect(focusableNames.some((name) => name.includes("Master Grid"))).toBe(false);
    expect(page.url()).toBe(startUrl);
  });
});

test.describe("campaign page desktop @ 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("stays inside the catalog width, no legacy grid/list controls, no overflow", async ({ page }) => {
    await gotoCampaign(page, SUDOKU_FIXTURE);
    await expect(page.getByRole("heading", { level: 1, name: "Sudoku" })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("button", { name: "Grid", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "List", exact: true })).toHaveCount(0);
    await expect(page.getByText(/results?$/i)).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("campaign page landscape @ 844x390", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("header not clipped, overview reachable, vertical scroll works, no sideways path", async ({ page }) => {
    await gotoCampaign(page, SUDOKU_FIXTURE);
    await expect(page.getByRole("heading", { level: 1, name: "Sudoku" })).toBeVisible({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);

    const bar = page.getByRole("progressbar");
    await bar.scrollIntoViewIfNeeded();
    await expect(bar).toBeVisible();

    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(innerHeight);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("campaign page open-collection fixture", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders Open collection with a playable challenge selected Up next", async ({ page }) => {
    const openCollection: FixturePuzzle[] = [
      {
        id: "riddle-1",
        title: "Warm Riddle",
        difficulty: "easy",
        order: 1,
        pointsReward: 10,
        xpReward: 20,
        puzzleType: "riddle",
        category: CATEGORY,
        locked: false,
        isBossPuzzle: false,
        isTeamPuzzle: false,
        userProgress: [{ solved: false }],
      },
      {
        id: "riddle-2",
        title: "Second Riddle",
        difficulty: "medium",
        order: 2,
        pointsReward: 15,
        xpReward: 25,
        puzzleType: "riddle",
        category: CATEGORY,
        locked: false,
        isBossPuzzle: false,
        isTeamPuzzle: false,
        userProgress: [{ solved: false }],
      },
    ];
    await gotoCampaign(page, openCollection, "riddle");

    await expect(page.getByRole("heading", { level: 1, name: "Riddle" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Open collection")).toBeVisible();
    await expect(page.getByText("Boss finale")).toHaveCount(0);

    const path = page.getByTestId("campaign-challenge-path");
    await expect(path.getByRole("button", { name: /Warm Riddle — Up next/ })).toBeVisible();
  });
});

test.describe("campaign page complete-campaign fixture", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows Campaign complete, hides Start/Continue, and keeps the list visible", async ({ page }) => {
    const complete: FixturePuzzle[] = [
      {
        id: "jigsaw-1",
        title: "Piece One",
        difficulty: "easy",
        order: 1,
        pointsReward: 10,
        xpReward: 20,
        puzzleType: "jigsaw",
        category: CATEGORY,
        locked: false,
        isBossPuzzle: false,
        isTeamPuzzle: false,
        userProgress: [{ solved: true }],
      },
      {
        id: "jigsaw-2",
        title: "Piece Two",
        difficulty: "medium",
        order: 2,
        pointsReward: 15,
        xpReward: 25,
        puzzleType: "jigsaw",
        category: CATEGORY,
        locked: false,
        isBossPuzzle: false,
        isTeamPuzzle: false,
        userProgress: [{ solved: true }],
      },
    ];
    await gotoCampaign(page, complete, "jigsaw");

    await expect(page.getByText("Campaign complete")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Start campaign" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue campaign" })).toHaveCount(0);

    const path = page.getByTestId("campaign-challenge-path");
    await expect(path.getByText("Piece One")).toBeVisible();
    await expect(path.getByText("Piece Two")).toBeVisible();
  });
});

test.describe("campaign page empty-campaign fixture", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows the empty state and links back to Puzzle Library", async ({ page }) => {
    await gotoCampaign(page, [], "crossword");

    await expect(page.getByText("No challenges available")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: "Back to Puzzle Library" })).toHaveAttribute("href", "/puzzles");
    await expect(page.getByRole("button", { name: "Grid", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "List", exact: true })).toHaveCount(0);
  });
});

test.describe("flat-list regression", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("/puzzles?category=all keeps the legacy flat-list experience unchanged", async ({ page }) => {
    await authenticate(page);
    await installApiMocks(page, SUDOKU_FIXTURE);
    await page.goto("/puzzles?category=all", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Puzzles" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Grid", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "List", exact: true })).toBeVisible();
    await expect(page.getByText("PUZZLE CAMPAIGN")).toHaveCount(0);
  });
});

test.describe("puzzle library regression", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("/puzzles hub still links to the campaign route and has no campaign-page shell", async ({ page }) => {
    await authenticate(page);
    await installApiMocks(page, SUDOKU_FIXTURE);
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Find your next challenge" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/puzzles/type/sudoku"]').first()).toBeAttached();
    await expect(page.getByText("PUZZLE CAMPAIGN")).toHaveCount(0);
  });
});
