import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const PUZZLE_ID = "e2e-sudoku";
const SOLUTION = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9],
];
const GRID = SOLUTION.map((row, rowIndex) => row.map((value, colIndex) => ((rowIndex + colIndex) % 3 === 0 ? value : 0)));

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({ secret, maxAge: 3600, token: { sub: "e2e-user", id: "e2e-user", name: "Sudoku Tester", email: "sudoku@example.test", role: "user", betaApproved: true } });
  await page.context().addCookies([{ name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
}

async function installFixture(page: Page, options: { startedAt?: string; expiresAt?: string; attempts?: number; maxAttempts?: number; timeLimitSeconds?: number; failFirstStart?: boolean; solved?: boolean } = {}) {
  let attempts = options.attempts ?? 0; let solved = options.solved ?? false; let startedAt: string | null = options.startedAt ?? null; let expiresAt: string | null = options.expiresAt ?? null; let lockedAt: string | null = null; let lockReason: string | null = null; let completions = 0; let dailyCompletions = 0; let startFailures = options.failFirstStart ? 1 : 0; let timerStarts = 0;
  const completionBodies: Array<Record<string, unknown>> = [];
  const progress = () => ({ id: "sudoku-progress", userId: "e2e-user", puzzleId: PUZZLE_ID, solved, attempts, pointsEarned: solved ? 100 : 0, successfulAttempts: solved ? 1 : 0, completionPercentage: solved ? 100 : 0, sudokuStartedAt: startedAt, sudokuExpiresAt: expiresAt, sudokuLockedAt: lockedAt, sudokuLockReason: lockReason, sessionLogs: [], partProgress: [] });
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/\/$/, ""); const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: { id: "e2e-user", name: "Sudoku Tester", email: "sudoku@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    if (path === "/api/daily/sudoku/content") return fulfill({ available: true, dayNumber: 142, puzzleId: PUZZLE_ID, puzzleGrid: JSON.stringify(GRID), solutionGrid: JSON.stringify(SOLUTION), difficulty: "medium" });
    if (path === "/api/daily/sudoku/complete") {
      if (method === "POST") dailyCompletions += 1;
      return fulfill(method === "GET" ? { completedToday: false, streak: 7, streakDay: 7, nextReward: { points: 70, xp: 35, streakDay: 7 }, streakShields: 0, skipTokens: 0 } : { success: true, reward: { points: 70, xp: 35, streakDay: 7 } });
    }
    if (path === `/api/puzzles/${PUZZLE_ID}`) return fulfill({ id: PUZZLE_ID, title: "Sudoku E2E", description: "Deterministic Sudoku", content: "", difficulty: "medium", puzzleType: "sudoku", xpReward: 100, solutions: [{ points: 100 }], category: { name: "Logic" }, media: [], userHistory: [], sudoku: { puzzleGrid: JSON.stringify(GRID), solutionGrid: JSON.stringify(SOLUTION), difficulty: "medium", timeLimitSeconds: options.timeLimitSeconds ?? 900, maxAttempts: options.maxAttempts ?? 5 } });
    if (path === `/api/puzzles/${PUZZLE_ID}/progress`) {
      if (method === "POST") {
        const body = request.postDataJSON() as { action?: string; reason?: string; durationSeconds?: number };
        if (body.action === "start_sudoku_timer") {
          timerStarts += 1;
          if (startFailures > 0) { startFailures -= 1; return fulfill({ error: "Round start failed" }, 503); }
          startedAt = new Date().toISOString(); expiresAt = new Date(Date.now() + (options.timeLimitSeconds ?? 900) * 1000).toISOString(); lockedAt = null; lockReason = null;
        }
        if (body.action === "log_attempt") attempts += 1;
        if (body.action === "attempt_success") { completions += 1; completionBodies.push(body); solved = true; attempts += 1; }
        if (body.action === "lock_puzzle") { lockedAt = new Date().toISOString(); lockReason = body.reason ?? "given_up"; }
        if (body.action === "clear_state") { attempts = 0; startedAt = null; expiresAt = null; lockedAt = null; lockReason = null; }
      }
      return fulfill(progress());
    }
    if (path === `/api/puzzles/${PUZZLE_ID}/hints`) return fulfill({ hints: [], hintTokens: 1, skipTokens: 0 });
    if (path === `/api/puzzles/${PUZZLE_ID}/comparison-stats`) return fulfill({ percentile: 50, averageTime: 60, totalSolves: 1 });
    if (path === "/api/user/info") return fulfill({ id: "e2e-user", totalXp: 0, activeSkin: "default" });
    if (path === "/api/user/profile") return fulfill({ activeSkin: "default", activeCompletionAnimation: "default" });
    return fulfill({});
  });
  return { completionCount: () => completions, dailyCompletionCount: () => dailyCompletions, timerStartCount: () => timerStarts, completionBodies, attempts: () => attempts, startedAt: () => startedAt, expiresAt: () => expiresAt };
}

async function restoreCompletedGrid(page: Page) {
  await page.addInitScript(({ puzzleId, solution }) => {
    localStorage.setItem(`sudoku-state:v2:${puzzleId}`, JSON.stringify({ version: 2, grid: solution, notes: {} }));
    localStorage.setItem("sudoku-state:v2:daily-sudoku-142", JSON.stringify({ version: 2, grid: solution, notes: {} }));
  }, { puzzleId: PUZZLE_ID, solution: SOLUTION });
}

async function expectFit(page: Page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight }));
  expect(sizes.docWidth).toBeLessThanOrEqual(sizes.width + 1); expect(sizes.docHeight).toBeLessThanOrEqual(sizes.height + 1);
  for (const selector of [".sudoku-grid", ".sudoku-utility-bar", ".sudoku-number-pad", ".sudoku-validation-row"]) {
    const box = await page.locator(selector).boundingBox(); expect(box).not.toBeNull(); expect(box!.y + box!.height).toBeLessThanOrEqual(sizes.height + 1);
  }
  const keys = await page.locator(".sudoku-number-key").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  keys.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));
}

const mobileViewports = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }];
for (const viewport of mobileViewports) {
  test(`daily Sudoku fits and supports input at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await authenticate(page); await installFixture(page); await page.goto("/daily/sudoku", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sudoku-root")).toBeVisible({ timeout: 15_000 }); await expect(page.locator("input")).toHaveCount(0); await expectFit(page);
    const cell = page.getByRole("gridcell", { name: /Row 1, column 2, editable, empty/ }); await cell.click(); await page.getByRole("button", { name: "Enter 3" }).click(); await expect(page.getByRole("gridcell", { name: /Row 1, column 2, editable, value 3/ })).toBeVisible();
    await page.getByRole("button", { name: "Notes mode off" }).click(); await page.getByRole("button", { name: "Enter 4" }).click(); await page.getByRole("button", { name: "Undo last move" }).click();
  });
}

test("catalog Sudoku resumes timer, keeps bug dialog mounted, and uses hardware keys", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await authenticate(page); await installFixture(page); await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("sudoku-root")).toBeVisible({ timeout: 15_000 }); await expect(page.locator("input")).toHaveCount(0);
  const cell = page.getByRole("gridcell", { name: /Row 1, column 2, editable, empty/ }); await cell.click(); await page.getByTestId("sudoku-game-surface").focus(); await page.keyboard.press("3"); await expect(page.getByRole("gridcell", { name: /Row 1, column 2, editable, value 3/ })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByRole("gridcell", { name: /Row 1, column 2, editable, value 3/ })).toBeVisible();
  await page.getByRole("button", { name: "More puzzle actions" }).click(); await page.getByRole("menuitem", { name: "Report Bug" }).click(); await expect(page.getByRole("dialog", { name: "Report a bug" })).toBeVisible(); await expect(page.getByRole("menu")).toHaveCount(0);
});

test("brand-new catalog Sudoku mounts and starts one authoritative timer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); const fixture = await installFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("sudoku-root")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Loading your Sudoku round…")).toHaveCount(0);
  await expect.poll(fixture.timerStartCount).toBe(1);
  await page.waitForTimeout(500); expect(fixture.timerStartCount()).toBe(1);
});

test("completing Daily Sudoku sends exactly one daily completion request", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); await restoreCompletedGrid(page);
  const fixture = await installFixture(page); await page.goto("/daily/sudoku", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Check Puzzle" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Check Puzzle" }).click();
  await expect.poll(fixture.dailyCompletionCount, { timeout: 10_000 }).toBe(1);
});

test("catalog completion sends one authoritative success with elapsed duration", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); await restoreCompletedGrid(page);
  const startedAt = new Date(Date.now() - 30_000).toISOString();
  const fixture = await installFixture(page, { startedAt, expiresAt: new Date(Date.now() + 870_000).toISOString() });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Check Puzzle" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Check Puzzle" }).click();
  await expect.poll(fixture.completionCount).toBe(1);
  const duration = Number(fixture.completionBodies[0]?.durationSeconds);
  expect(duration).toBeGreaterThanOrEqual(29); expect(duration).toBeLessThanOrEqual(35);
});

test("catalog board remains mounted until celebration hands off to XP", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); await restoreCompletedGrid(page);
  const fixture = await installFixture(page, { startedAt: new Date(Date.now() - 30_000).toISOString(), expiresAt: new Date(Date.now() + 870_000).toISOString() });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Check Puzzle" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Check Puzzle" }).click(); await expect.poll(fixture.completionCount).toBe(1);
  await expect(page.getByTestId("sudoku-root")).toHaveAttribute("data-status", "won");
  await expect(page.getByRole("heading", { name: "Sudoku solved!" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("heading", { name: "Sudoku solved!" })).toBeVisible();
  expect(fixture.completionCount()).toBe(1);
});

test("incorrect catalog attempt locks at the maximum and retry starts from zero", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page);
  const wrong = SOLUTION.map((row) => [...row]); [wrong[0][1], wrong[0][2]] = [wrong[0][2], wrong[0][1]];
  await page.addInitScript(({ puzzleId, grid }) => localStorage.setItem(`sudoku-state:v2:${puzzleId}`, JSON.stringify({ version: 2, grid, notes: {} })), { puzzleId: PUZZLE_ID, grid: wrong });
  const fixture = await installFixture(page, { startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900_000).toISOString(), maxAttempts: 1 });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Check Puzzle" })).toBeEnabled({ timeout: 15_000 }); await page.getByRole("button", { name: "Check Puzzle" }).click();
  await expect(page.getByRole("heading", { name: "Round over" })).toBeVisible(); expect(fixture.attempts()).toBe(1);
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page.getByTestId("sudoku-root")).toHaveAttribute("data-status", "playing"); await expect.poll(fixture.attempts).toBe(0);
});

test("timeout is locked before Try Again starts a fresh countdown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page);
  const fixture = await installFixture(page, { startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 800).toISOString(), timeLimitSeconds: 2 });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Round over" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "More puzzle actions" }).click(); await expect(page.getByRole("menuitem", { name: "Give Up" })).toHaveCount(0); await page.keyboard.press("Escape");
  const retry = page.getByRole("button", { name: "Try Again" }); await expect(retry).toBeEnabled(); await retry.click();
  await expect(page.getByTestId("sudoku-root")).toHaveAttribute("data-status", "playing");
  expect(new Date(fixture.expiresAt()!).getTime()).toBeGreaterThan(Date.now());
});

test("already-solved catalog Sudoku renders static result without Give Up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); await installFixture(page, { solved: true });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sudoku solved!" })).toBeVisible({ timeout: 15_000 }); await expect(page.getByTestId("sudoku-root")).toHaveCount(0);
  await page.getByRole("button", { name: "More puzzle actions" }).click(); await expect(page.getByRole("menuitem", { name: "Give Up" })).toHaveCount(0);
});

test("failed catalog start exposes Retry Start and recovers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); await installFixture(page, { failFirstStart: true });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Round start failed")).toBeVisible({ timeout: 15_000 }); await expect(page.getByTestId("sudoku-game-surface")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry Start" }).click();
  await expect(page.getByTestId("sudoku-root")).toHaveAttribute("data-status", "playing");
});

test("refresh resumes the same grid, attempt count, and deadline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page);
  const wrong = SOLUTION.map((row) => [...row]); [wrong[0][1], wrong[0][2]] = [wrong[0][2], wrong[0][1]];
  await page.addInitScript(({ puzzleId, grid }) => localStorage.setItem(`sudoku-state:v2:${puzzleId}`, JSON.stringify({ version: 2, grid, notes: {} })), { puzzleId: PUZZLE_ID, grid: wrong });
  const deadline = new Date(Date.now() + 900_000).toISOString();
  const fixture = await installFixture(page, { startedAt: new Date().toISOString(), expiresAt: deadline });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Check Puzzle" })).toBeEnabled({ timeout: 15_000 }); await page.getByRole("button", { name: "Check Puzzle" }).click();
  await expect.poll(fixture.attempts).toBe(1); await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("4 attempts left")).toBeVisible(); await expect(page.getByRole("gridcell", { name: /Row 1, column 2, editable, value 4/ })).toBeVisible();
  expect(fixture.expiresAt()).toBe(deadline);
});

test("Help and Give Up dialogs trap, close, and restore focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); await installFixture(page, { startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900_000).toISOString() });
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" }); await expect(page.getByTestId("sudoku-root")).toBeVisible({ timeout: 15_000 });
  const help = page.getByRole("button", { name: "How to play Sudoku" }); await help.focus(); await help.click();
  await expect(page.getByRole("dialog", { name: "How to play Sudoku" })).toBeVisible(); await expect(page.getByRole("button", { name: "Close help" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(help).toBeFocused();
  const more = page.getByRole("button", { name: "More puzzle actions" }); await more.click(); await page.getByRole("menuitem", { name: "Give Up" }).click();
  await expect(page.getByRole("dialog", { name: "Give up this round?" })).toBeVisible(); await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(more).toBeFocused();
});
