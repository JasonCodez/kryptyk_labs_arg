import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const PUZZLE_ID = "e2e-jigsaw";
const IMAGE = "/e2e-jigsaw.svg";
const IMAGE_BODY = "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><rect width='800' height='500' fill='#1d4ed8'/><circle cx='400' cy='250' r='150' fill='#fde74c'/></svg>";

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({ secret, maxAge: 3600, token: { sub: "e2e-user", id: "e2e-user", name: "Jigsaw Tester", email: "jigsaw@example.test", role: "user", betaApproved: true } });
  await page.context().addCookies([{ name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
}

async function installDailyFixture(page: Page, failCompletions = 0, grid = { rows: 2, cols: 2 }) {
  let completed = false;
  let requests = 0;
  let successfulRecords = 0;
  await page.route("**/e2e-jigsaw.svg*", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE_BODY }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: { id: "e2e-user", name: "Jigsaw Tester", email: "jigsaw@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    if (path === "/api/daily/jigsaw/content") return fulfill({ available: true, dayNumber: 212, puzzleId: PUZZLE_ID, imageUrl: IMAGE, gridRows: grid.rows, gridCols: grid.cols, rotationEnabled: false });
    if (path === "/api/daily/jigsaw/complete") {
      if (method === "POST") {
        requests += 1;
        if (failCompletions > 0) { failCompletions -= 1; return fulfill({ success: false, error: "Temporary completion failure" }, 503); }
        if (!completed) successfulRecords += 1;
        completed = true;
        return fulfill({ success: true, reward: { points: 40, xp: 20, streakDay: 4 } });
      }
      return fulfill({ completedToday: completed, streak: completed ? 4 : 3, streakDay: completed ? 4 : 3, nextReward: { points: 40, xp: 20, streakDay: 4 }, streakShields: 0, skipTokens: 0 });
    }
    return fulfill({});
  });
  return { requests: () => requests, successfulRecords: () => successfulRecords };
}

async function installCatalogFixture(page: Page, failCompletions = 0) {
  let solved = false;
  let attempts = 0;
  const progress = () => ({ id: "jigsaw-progress", userId: "e2e-user", puzzleId: PUZZLE_ID, solved, attempts, pointsEarned: solved ? 100 : 0, successfulAttempts: solved ? 1 : 0, completionPercentage: solved ? 100 : 0, sessionLogs: [], partProgress: [] });
  await page.route("**/e2e-jigsaw.svg*", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE_BODY }));
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/\/$/, ""); const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: { id: "e2e-user", name: "Jigsaw Tester", email: "jigsaw@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    if (path === `/api/puzzles/${PUZZLE_ID}`) return fulfill({ id: PUZZLE_ID, title: "Catalog Jigsaw E2E", description: "Deterministic fixture", content: "", difficulty: "easy", puzzleType: "jigsaw", xpReward: 50, data: {}, solutions: [{ points: 100 }], category: { name: "Visual" }, media: [], userHistory: [], jigsaw: { imageUrl: IMAGE, gridRows: 2, gridCols: 2, snapTolerance: 24, rotationEnabled: false } });
    if (path === `/api/puzzles/${PUZZLE_ID}/progress`) {
      if (method === "POST") {
        const body = request.postDataJSON() as { action?: string };
        if (body.action === "attempt_success") {
          attempts += 1;
          if (failCompletions > 0) { failCompletions -= 1; return fulfill({ error: "Temporary catalog failure" }, 503); }
          solved = true;
        }
      }
      return fulfill(progress());
    }
    if (path === `/api/puzzles/${PUZZLE_ID}/hints`) return fulfill({ hints: [], hintTokens: 0, skipTokens: 0 });
    if (path === `/api/puzzles/${PUZZLE_ID}/comparison-stats`) return fulfill({ percentile: 50, averageTime: 60, totalSolves: 1 });
    if (path === "/api/user/info") return fulfill({ id: "e2e-user", totalXp: 0, totalPoints: 1000, activeSkin: "default" });
    if (path === "/api/user/profile") return fulfill({ activeSkin: "default", activeCompletionAnimation: "default" });
    return fulfill({});
  });
  return { attempts: () => attempts };
}

async function installWarzFixture(page: Page) {
  await page.route("**/e2e-jigsaw.svg*", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE_BODY }));
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/\/$/, "");
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: { id: "e2e-user", name: "Jigsaw Tester", email: "jigsaw@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    if (path === `/api/puzzles/${PUZZLE_ID}`) return fulfill({ id: PUZZLE_ID, title: "Warz Jigsaw E2E", difficulty: "easy", puzzleType: "jigsaw", data: {}, jigsaw: { imageUrl: IMAGE, gridRows: 2, gridCols: 2, snapTolerance: 24, rotationEnabled: false } });
    if (path === "/api/user/info") return fulfill({ id: "e2e-user", totalPoints: 1000 });
    if (path === "/api/warz/check-eligible") return fulfill({ eligible: true });
    if (path === "/api/warz/create" && request.method() === "POST") return fulfill({ id: "challenge-e2e" });
    return fulfill({});
  });
}

async function openDaily(page: Page) {
  await page.goto("/daily/jigsaw", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", /playing|completion-pending/, { timeout: 15_000 });
  await expect(page.locator("html")).toHaveAttribute("data-app-mode", "play");
}

async function completeWithKeyboard(page: Page) {
  for (let index = 0; index < 4; index += 1) {
    const piece = page.locator(".jigsaw-tray-piece").first();
    await piece.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
  }
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`Daily Jigsaw stays contained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installDailyFixture(page);
    await openDaily(page);
    const dimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight, overflow: getComputedStyle(document.documentElement).overflow }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    if (viewport.width < 1032) expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
    else expect(dimensions.overflow).toBe("hidden");
    const rootBox = await page.locator(".jigsaw-root").boundingBox(); const canvasBox = await page.locator(".jigsaw-board-canvas").boundingBox();
    expect(rootBox).not.toBeNull(); expect(canvasBox).not.toBeNull();
    expect(canvasBox!.x).toBeGreaterThanOrEqual(rootBox!.x - 1); expect(canvasBox!.y).toBeGreaterThanOrEqual(rootBox!.y - 1);
    expect(canvasBox!.x + canvasBox!.width).toBeLessThanOrEqual(rootBox!.x + rootBox!.width + 1);
    expect(canvasBox!.y + canvasBox!.height).toBeLessThanOrEqual(rootBox!.y + rootBox!.height + 1);
    const targets = await page.locator(".jigsaw-controls button,.jigsaw-tray-piece").evaluateAll((elements) => elements.map((element) => { const rect = element.getBoundingClientRect(); return [rect.width, rect.height]; }));
    for (const [width, height] of targets) { expect(width).toBeGreaterThanOrEqual(44); expect(height).toBeGreaterThanOrEqual(44); }
  });
}

for (const grid of [{ rows: 3, cols: 4 }, { rows: 4, cols: 6 }, { rows: 6, cols: 8 }]) {
  test(`${grid.rows}x${grid.cols} board preserves every tray piece`, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await installDailyFixture(page, 0, grid);
    await openDaily(page);
    await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(grid.rows * grid.cols);
  });
}

test("Preview is an accessible, focus-restoring dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installDailyFixture(page);
  await openDaily(page);
  await page.locator(".jigsaw-board-canvas").focus();
  await page.keyboard.press("p");
  const dialog = page.getByRole("dialog", { name: "Puzzle preview" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: /Completed image/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".jigsaw-board-canvas")).toBeFocused();
});

test("Daily completion is recorded once after the celebration", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installDailyFixture(page);
  await openDaily(page);
  await completeWithKeyboard(page);
  await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 15_000 });
  expect(fixture.requests()).toBe(1);
  expect(fixture.successfulRecords()).toBe(1);
});

test("failed Daily completion survives reload and retries only completion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installDailyFixture(page, 1);
  await openDaily(page);
  await completeWithKeyboard(page);
  await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Retry Completion" }).click();
  await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 10_000 });
  expect(fixture.requests()).toBe(2);
  expect(fixture.successfulRecords()).toBe(1);
});

test("Catalog sends attempt_success once and delays its result UI until celebration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-mode", "catalog", { timeout: 15_000 });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing");
  await completeWithKeyboard(page);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "won", { timeout: 15_000 });
  expect(fixture.attempts()).toBe(1);
  await expect(page.getByRole("heading", { name: "Puzzle Complete!" })).toBeVisible({ timeout: 10_000 });
});

test("Catalog supports tray drag, return, zoom, and header controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first(); const board = page.locator(".jigsaw-board-canvas");
  const from = await trayCanvas.boundingBox(); const to = await board.boundingBox();
  expect(from).not.toBeNull(); expect(to).not.toBeNull();
  const pointerId = 7;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: from!.x + from!.width / 2, clientY: from!.y + from!.height / 2 });
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await board.dispatchEvent("pointerup", { pointerId, pointerType: "mouse", button: 0, buttons: 0, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);
  await page.getByRole("button", { name: "More puzzle actions" }).click();
  await page.getByRole("menuitem", { name: "Return Loose Pieces" }).click();
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(4);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("125%");
  await page.getByRole("button", { name: "Reset zoom" }).click();
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("100%");
});

test("Warz mounts without restoring or writing Catalog and Daily progress", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await installWarzFixture(page);
  await page.addInitScript(() => {
    localStorage.setItem("jigsaw-progress:v2:catalog:e2e-jigsaw", "catalog-sentinel");
    localStorage.setItem("jigsaw-progress:v2:daily:212:e2e-jigsaw", "daily-sentinel");
  });
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-mode", "warz", { timeout: 15_000 });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(4);
  const piece = page.locator(".jigsaw-tray-piece").first(); await piece.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("ArrowUp");
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("jigsaw-progress")));
  expect(keys.sort()).toEqual(["jigsaw-progress:v2:catalog:e2e-jigsaw", "jigsaw-progress:v2:daily:212:e2e-jigsaw"]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(4);
});
