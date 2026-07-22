import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const CROSSWORD_PUZZLE_ID = "e2e-daily-results-crossword";
const WORD_SEARCH_PUZZLE_ID = "e2e-daily-results-word-search";
const JIGSAW_IMAGE = "/e2e-daily-results-jigsaw.svg";
const JIGSAW_IMAGE_BODY =
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='#1d4ed8'/></svg>";

const SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];
const GRID = SOLUTION.map((row, rowIndex) =>
  row.map((value, colIndex) => (((rowIndex + colIndex) % 3 === 0 ? value : 0)))
);

const STATUS_FIXTURE = {
  completedToday: true,
  streak: 4,
  streakDay: 5,
  nextReward: { points: 125, xp: 60, streakDay: 5 },
  streakShields: 0,
  skipTokens: 0,
};

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: {
      sub: "e2e-user",
      id: "e2e-user",
      name: "Daily Results Tester",
      email: "daily-results@example.test",
      role: "user",
      betaApproved: true,
    },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

async function installFixture(page: Page) {
  await page.route(`**${JIGSAW_IMAGE}*`, (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: JIGSAW_IMAGE_BODY })
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(body),
      });

    if (path === "/api/auth/session") {
      return fulfill({
        user: { id: "e2e-user", name: "Daily Results Tester", email: "daily-results@example.test" },
        expires: "2099-01-01T00:00:00.000Z",
      });
    }

    if (path === "/api/daily/sudoku/content") {
      return fulfill({
        available: true,
        dayNumber: 42,
        puzzleGrid: JSON.stringify(GRID),
        solutionGrid: JSON.stringify(SOLUTION),
        difficulty: "medium",
      });
    }
    if (path === "/api/daily/sudoku/complete") {
      return fulfill(method === "GET" ? STATUS_FIXTURE : { success: true, reward: { points: 125, xp: 60 } });
    }

    if (path === "/api/daily/crossword/content") {
      return fulfill({ available: true, dayNumber: 42, puzzleId: CROSSWORD_PUZZLE_ID });
    }
    if (path === "/api/daily/crossword/complete") {
      return fulfill(method === "GET" ? STATUS_FIXTURE : { success: true, reward: { points: 125, xp: 60 } });
    }
    if (path === `/api/puzzles/${CROSSWORD_PUZZLE_ID}`) {
      return fulfill({
        id: CROSSWORD_PUZZLE_ID,
        title: "Daily Results Crossword E2E",
        puzzleType: "crossword",
        data: { rows: 3, cols: 3, clues: { across: [], down: [] } },
        category: { name: "Words" },
        media: [],
        userHistory: [],
        solutions: [{ points: 100 }],
      });
    }

    if (path === "/api/daily/word_search/content") {
      return fulfill({ available: true, dayNumber: 42, puzzleId: WORD_SEARCH_PUZZLE_ID });
    }
    if (path === "/api/daily/word_search/complete") {
      return fulfill(method === "GET" ? STATUS_FIXTURE : { success: true, reward: { points: 125, xp: 60 } });
    }
    if (path === `/api/puzzles/${WORD_SEARCH_PUZZLE_ID}`) {
      return fulfill({
        id: WORD_SEARCH_PUZZLE_ID,
        title: "Daily Results Word Trove E2E",
        puzzleType: "word_search",
        data: { grid: [["X"]], words: [] },
        category: { name: "Words" },
        media: [],
        userHistory: [],
        solutions: [{ points: 100 }],
      });
    }
    if (path === `/api/puzzles/${WORD_SEARCH_PUZZLE_ID}/hints`) {
      return fulfill({ hintTokens: 0 });
    }

    if (path === "/api/daily/jigsaw/content") {
      return fulfill({
        available: true,
        dayNumber: 42,
        puzzleId: "e2e-daily-results-jigsaw",
        imageUrl: JIGSAW_IMAGE,
        gridRows: 2,
        gridCols: 2,
        rotationEnabled: false,
      });
    }
    if (path === "/api/daily/jigsaw/complete") {
      return fulfill(method === "GET" ? STATUS_FIXTURE : { success: true, reward: { points: 125, xp: 60 } });
    }

    return fulfill({});
  });
}

const ROUTES: Array<{ path: string; puzzleName: string }> = [
  { path: "/daily/sudoku", puzzleName: "Sudoku" },
  { path: "/daily/crossword", puzzleName: "Crossword" },
  { path: "/daily/word-search", puzzleName: "Word Trove" },
  { path: "/daily/jigsaw", puzzleName: "Jigsaw" },
];

test.describe("Daily results — revisit state at 390x844", () => {
  for (const route of ROUTES) {
    test(`${route.path} shows the shared revisit result`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await authenticate(page);
      await installFixture(page);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      const heading = page.getByRole("heading", { level: 2 });
      await expect(heading).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Daily Challenge Complete", { exact: false })).toBeVisible();
      await expect(heading).toContainText(route.puzzleName);
      await expect(heading).toContainText("#42");
      await expect(heading).toBeFocused();
      const result = page.locator('section[aria-labelledby="daily-result-heading"]');
      await expect(page.getByText("You’ve already completed today’s challenge.")).toBeVisible();
      await expect(result.getByText("4 day streak", { exact: true })).toBeVisible();
      await expect(page.getByText("Next streak reward", { exact: false })).toBeVisible();
      await expect(page.getByText("Day 5")).toBeVisible();
      await expect(page.getByText("125 Points", { exact: false })).toBeVisible();
      await expect(page.getByText("60 XP", { exact: false })).toBeVisible();
      await expect(page.getByText("Reward earned", { exact: false })).toHaveCount(0);
      await expect(page.getByText("+125 Points", { exact: false })).toHaveCount(0);
      await expect(page.getByText("+60 XP", { exact: false })).toHaveCount(0);

      const backLink = page.getByRole("link", { name: /back to daily arena/i });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute("href", "/daily");
      const box = await backLink.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);

      await expect(page.getByText("Solved for today!")).toHaveCount(0);

      const sizes = await page.evaluate(() => ({
        width: window.innerWidth,
        docWidth: document.documentElement.scrollWidth,
      }));
      expect(sizes.docWidth).toBeLessThanOrEqual(sizes.width + 1);
    });
  }
});

test.describe("Daily results — desktop and landscape coverage", () => {
  const viewports = [
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    for (const route of [ROUTES[0], ROUTES[3]]) {
      test(`${route.path} result remains usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await authenticate(page);
        await installFixture(page);
        await page.goto(route.path, { waitUntil: "domcontentloaded" });

        const heading = page.getByRole("heading", { level: 2 });
        await expect(heading).toBeVisible({ timeout: 15_000 });
        await expect(heading).toContainText(route.puzzleName);

        const backLink = page.getByRole("link", { name: /back to daily arena/i });
        await expect(backLink).toBeVisible();

        const sizes = await page.evaluate(() => ({
          width: window.innerWidth,
          docWidth: document.documentElement.scrollWidth,
        }));
        expect(sizes.docWidth).toBeLessThanOrEqual(sizes.width + 1);
      });
    }
  }
});

test.describe("Daily results — reduced motion", () => {
  test("Sudoku result appears fully visible without an entrance transform", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await installFixture(page);
    await page.goto("/daily/sudoku", { waitUntil: "domcontentloaded" });

    const heading = page.getByRole("heading", { level: 2 });
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expect(heading).toContainText("Sudoku");

    const backLink = page.getByRole("link", { name: /back to daily arena/i });
    await expect(backLink).toBeVisible();
  });
});
