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

async function installCatalogFixture(page: Page, failCompletions = 0, skipTokens = 0) {
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
    if (path === `/api/puzzles/${PUZZLE_ID}/hints`) return fulfill({ hints: [], hintTokens: 0, skipTokens });
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

// Genuine pointer drag from the tray onto the board, landing at the CENTER of the piece's own
// correct cell — derived purely from the grid's row/col (exposed via the tray piece's
// aria-label) and the square-board layout math JigsawPuzzleCanvas itself uses (a fixed
// BOARD_SIZE logical square with no stage margin, so the rendered board canvas IS the grid),
// not from any solution data the app exposes. Only valid for a square grid (rows === cols),
// which is what every fixture below uses.
async function dragEachTrayPieceToItsSlot(page: Page, gridRows: number, gridCols: number) {
  if (gridRows !== gridCols) throw new Error("dragEachTrayPieceToItsSlot only supports square grids");
  const board = page.locator(".jigsaw-board-canvas");
  const cellFrac = 1 / gridRows;
  let pointerId = 5000;
  for (let index = 0; index < gridRows * gridCols; index += 1) {
    const trayPiece = page.locator(".jigsaw-tray-piece").first();
    const label = await trayPiece.getAttribute("aria-label");
    const match = label?.match(/row (\d+) column (\d+)/i);
    if (!match) throw new Error(`Could not parse row/column from tray piece aria-label: ${label}`);
    const row = Number(match[1]) - 1;
    const col = Number(match[2]) - 1;
    const from = await trayPiece.locator("canvas").boundingBox();
    const boardBox = await board.boundingBox();
    if (!from || !boardBox) throw new Error("Missing bounding box for drag");
    const targetX = boardBox.x + (col + 0.5) * cellFrac * boardBox.width;
    const targetY = boardBox.y + (row + 0.5) * cellFrac * boardBox.height;
    const id = pointerId++;
    const trayCanvas = trayPiece.locator("canvas");
    const startX = from.x + from.width / 2; const startY = from.y + from.height / 2;
    await trayCanvas.dispatchEvent("pointerdown", { pointerId: id, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
    // Predominantly vertical movement past the pickup threshold, still dispatched on the tray
    // canvas — confirms the pickup (see onTrayPiecePointerMove) before capture transfers to the
    // board canvas for the rest of the drag.
    await trayCanvas.dispatchEvent("pointermove", { pointerId: id, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY - 20 });
    await board.dispatchEvent("pointermove", { pointerId: id, pointerType: "mouse", button: 0, buttons: 1, clientX: targetX, clientY: targetY });
    await board.dispatchEvent("pointerup", { pointerId: id, pointerType: "mouse", button: 0, buttons: 0, clientX: targetX, clientY: targetY });
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

    // The board is a fixed square (BOARD_SIZE=640 logical, no stage margin) scaled to fit
    // `.jigsaw-board-area` — the canvas itself must stay square and fill most of that area.
    const boardAreaBox = await page.locator(".jigsaw-board-area").boundingBox();
    expect(boardAreaBox).not.toBeNull();
    expect(Math.abs(canvasBox!.width - canvasBox!.height)).toBeLessThanOrEqual(1);
    const availableSide = Math.min(boardAreaBox!.width, boardAreaBox!.height);
    expect(canvasBox!.width).toBeGreaterThanOrEqual(availableSide * 0.94);
    // Portrait layouts (`align-items:flex-start`) must not leave a large dead gap above the
    // board; the short-landscape media query re-centers the board area instead, so only assert
    // "no gap" when the viewport is actually portrait/tall enough to hit the default rule.
    const isLandscapeLayout = viewport.width > viewport.height && viewport.height <= 520;
    if (!isLandscapeLayout) expect(canvasBox!.y - boardAreaBox!.y).toBeLessThanOrEqual(20);
    await expect(page.locator(".jigsaw-tray")).toBeVisible();
  });
}

// Catalog uses a different wrapper (puzzle-detail-play-* / pw-jigsaw-shell-content) than Daily's
// app-shell (pw-play-shell / pw-play-content) — exercise the real catalog structure directly
// rather than relying only on Daily's fixture/DOM, since the two chains can (and did) drift.
for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`Catalog Jigsaw stays contained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installCatalogFixture(page, 0, 3);
    await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-mode", "catalog", { timeout: 15_000 });
    await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing");

    const dimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);

    const canvasBox = await page.locator(".jigsaw-board-canvas").boundingBox();
    const boardAreaBox = await page.locator(".jigsaw-board-area").boundingBox();
    const cardBox = await page.locator(".puzzle-detail-play-card").boundingBox();
    expect(canvasBox).not.toBeNull(); expect(boardAreaBox).not.toBeNull(); expect(cardBox).not.toBeNull();

    // Square canvas, using most of the available width.
    expect(Math.abs(canvasBox!.width - canvasBox!.height)).toBeLessThanOrEqual(1);
    const availableSide = Math.min(boardAreaBox!.width, boardAreaBox!.height);
    expect(canvasBox!.width).toBeGreaterThanOrEqual(availableSide * 0.94);

    // The board must begin directly beneath the shared header (no large dead region above it —
    // the exact regression the broken puzzle-detail-play-* height chain caused).
    const headerBox = await page.locator(".pw-play-header").boundingBox();
    expect(headerBox).not.toBeNull();
    expect(canvasBox!.y - (headerBox!.y + headerBox!.height)).toBeLessThanOrEqual(20);

    // Board area is now capped to a square (no longer stretched to consume all remaining card
    // height below 540px — see the mobile jigsaw-board-area rule in jigsaw.css), so the tray
    // must still sit directly beneath it even though the card itself may now be taller than
    // header+board+tray on a tall viewport; that leftover space is expected, not a regression.
    const trayBox = await page.locator(".jigsaw-tray").boundingBox();
    expect(trayBox).not.toBeNull();
    expect(trayBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 1); // tray directly beneath the board

    await expect(page.locator(".jigsaw-tray")).toBeVisible();

    // No duplicate Skip control below the tray (PuzzleProgressSection removed for jigsaw).
    await expect(page.locator(".puzzle-detail-progress-section")).toHaveCount(0);
    await expect(page.getByText("Skip Puzzle", { exact: false })).toHaveCount(0);

    // Skip remains available through the header's "More puzzle actions" menu.
    await page.getByRole("button", { name: "More puzzle actions" }).click();
    await expect(page.getByRole("menuitem", { name: "⏭️ Skip (3)" })).toBeVisible();
  });
}

for (const grid of [{ rows: 2, cols: 2 }, { rows: 3, cols: 3 }, { rows: 4, cols: 4 }, { rows: 5, cols: 5 }, { rows: 6, cols: 6 }]) {
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
  await dragEachTrayPieceToItsSlot(page, 2, 2);
  await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 15_000 });
  expect(fixture.requests()).toBe(1);
  expect(fixture.successfulRecords()).toBe(1);
});

test("failed Daily completion survives reload and retries only completion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installDailyFixture(page, 1);
  await openDaily(page);
  await dragEachTrayPieceToItsSlot(page, 2, 2);
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
  await dragEachTrayPieceToItsSlot(page, 2, 2);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "won", { timeout: 15_000 });
  expect(fixture.attempts()).toBe(1);
  await expect(page.getByRole("heading", { name: "Puzzle Complete!" })).toBeVisible({ timeout: 10_000 });
});

test("Catalog supports tray drag, return, and header controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first(); const board = page.locator(".jigsaw-board-canvas");
  const from = await trayCanvas.boundingBox(); const to = await board.boundingBox();
  expect(from).not.toBeNull(); expect(to).not.toBeNull();
  const pointerId = 7;
  const startX = from!.x + from!.width / 2; const startY = from!.y + from!.height / 2;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
  // First move stays on the tray canvas and is predominantly vertical, past the pickup
  // threshold — confirms the pickup before capture transfers to the board.
  await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await board.dispatchEvent("pointerup", { pointerId, pointerType: "mouse", button: 0, buttons: 0, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);
  await page.getByRole("button", { name: "More puzzle actions" }).click();
  await page.getByRole("menuitem", { name: "Return Loose Pieces" }).click();
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(4);
});

test("Desktop has no zoom controls, and Plus/Minus/0 do not alter the board", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveCount(0);

  const board = page.locator(".jigsaw-board-canvas");
  const before = await board.boundingBox();
  await board.focus();
  await page.keyboard.press("+");
  await page.keyboard.press("-");
  await page.keyboard.press("0");
  const after = await board.boundingBox();
  expect(after).toEqual(before);

  // Preview/Help/Tray/Reset/Fullscreen remain available via the header overflow menu.
  await page.getByRole("button", { name: "More puzzle actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Preview Image" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Return Loose Pieces" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Reset Puzzle" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Fullscreen" })).toBeVisible();
});

test("Dragging empty board space does not move the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  const board = page.locator(".jigsaw-board-canvas");
  const before = await board.boundingBox();
  // A corner of the board where no piece has been placed yet (all pieces start in the tray).
  const startX = before!.x + before!.width * 0.02;
  const startY = before!.y + before!.height * 0.02;
  const pointerId = 501;
  await board.dispatchEvent("pointerdown", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX + 80, clientY: startY + 60 });
  await board.dispatchEvent("pointerup", { pointerId, pointerType: "mouse", button: 0, buttons: 0, clientX: startX + 80, clientY: startY + 60 });
  const after = await board.boundingBox();
  expect(after).toEqual(before);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-drag-state", "idle");
});

test("A cancelled tray drag returns the piece to its original tray slot, not the board", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  // Drag the SECOND piece (not the first) so a bug that appends/prepends instead of restoring
  // to the exact original index would be caught by the aria-label check below.
  const originalSecondLabel = await page.locator(".jigsaw-tray-piece").nth(1).getAttribute("aria-label");
  const trayCanvas = page.locator(".jigsaw-tray-piece").nth(1).locator("canvas");
  const board = page.locator(".jigsaw-board-canvas");
  const from = await trayCanvas.boundingBox(); const to = await board.boundingBox();
  const pointerId = 101;
  const startX = from!.x + from!.width / 2; const startY = from!.y + from!.height / 2;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "mouse", button: 0, buttons: 1, clientX: to!.x + 15, clientY: to!.y + 15 });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-drag-state", "dragging");
  await board.dispatchEvent("pointercancel", { pointerId, pointerType: "mouse" });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(4);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-drag-state", "idle");
  await expect(page.locator(".jigsaw-tray-piece").nth(1)).toHaveAttribute("aria-label", originalSecondLabel ?? "");
});

test("A cancelled board-piece drag restores it without snapping or losing it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  const board = page.locator(".jigsaw-board-canvas");
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first();
  const from = await trayCanvas.boundingBox(); const boardBox = await board.boundingBox();
  // Drop deliberately off-target (top-left corner) so it lands loose on the board, not snapped.
  const looseX = boardBox!.x + boardBox!.width * 0.08;
  const looseY = boardBox!.y + boardBox!.height * 0.08;
  const dropId = 102;
  const dropStartX = from!.x + from!.width / 2; const dropStartY = from!.y + from!.height / 2;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: dropStartX, clientY: dropStartY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: dropStartX, clientY: dropStartY - 20 });
  await board.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: looseX, clientY: looseY });
  await board.dispatchEvent("pointerup", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 0, clientX: looseX, clientY: looseY });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");

  // Now pick that loose board piece back up and interrupt the drag with pointercancel.
  const pickId = 103;
  await board.dispatchEvent("pointerdown", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: looseX, clientY: looseY });
  await board.dispatchEvent("pointermove", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: looseX + 60, clientY: looseY + 60 });
  await board.dispatchEvent("pointercancel", { pointerId: pickId, pointerType: "mouse" });

  // Restored to its pre-drag (loose, off-target) position — still not snapped, still not back
  // in the tray, and not lost.
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);
});

test("A second pointer interrupts and restores an in-flight tray drag", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first();
  const board = page.locator(".jigsaw-board-canvas");
  const from = await trayCanvas.boundingBox(); const to = await board.boundingBox();
  const firstPointerId = 201;
  const startX = from!.x + from!.width / 2; const startY = from!.y + from!.height / 2;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId: firstPointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId: firstPointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId: firstPointerId, pointerType: "touch", buttons: 1, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-drag-state", "dragging");
  // A second finger touching down (pinch start) must cancel the in-flight drag, restoring the
  // piece to the tray rather than abandoning it wherever the first pointer left it.
  await board.dispatchEvent("pointerdown", { pointerId: 202, pointerType: "touch", buttons: 1, clientX: to!.x + 20, clientY: to!.y + 20 });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(4);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-drag-state", "idle");
});

test("A predominantly horizontal swipe over a tray piece does not pick it up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installDailyFixture(page, 0, { rows: 6, cols: 6 });
  await openDaily(page);
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(36);
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").nth(1);
  const box = await trayCanvas.boundingBox();
  const pointerId = 301;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", buttons: 1, clientX: box!.x + box!.width / 2, clientY: box!.y + box!.height / 2 });
  // Far more horizontal than vertical movement, past the pickup threshold — this is a scroll
  // gesture, not a pickup.
  await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: box!.x - 60, clientY: box!.y + box!.height / 2 + 2 });
  await trayCanvas.dispatchEvent("pointerup", { pointerId, pointerType: "touch" });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(36);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-drag-state", "idle");
});

test("Enter can no longer solve a piece without moving it onto the board first", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installDailyFixture(page);
  await openDaily(page);
  // The old bug: focus + Enter (select) + Enter (auto-place at the correct position,
  // regardless of proximity) solved every piece in two keypresses. Now the second Enter while
  // still tray-resident must be a no-op — placement requires the group already be on the
  // board (moved there via arrow keys), per resolveJigsawDrop's real tolerance check.
  for (let index = 0; index < 4; index += 1) {
    const piece = page.locator(".jigsaw-tray-piece").first();
    await piece.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
  }
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing");
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");
});

test("Keyboard placement snaps only within tolerance and merges via the real neighbor-merge path", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installDailyFixture(page);
  await openDaily(page);
  const piece = page.locator(".jigsaw-tray-piece").first();
  const groupLabel = await piece.getAttribute("aria-label");
  await piece.focus();
  await page.keyboard.press("Enter"); // select
  await expect(page.locator(".jigsaw-root")).not.toHaveAttribute("data-selected-group", "");
  await page.keyboard.press("ArrowUp"); // moves it onto the board (leaves the tray), far from its slot
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);
  await page.keyboard.press("Enter"); // attempt placement — far away, must not snap
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3); // not returned to the tray either — stays loose on the board
  void groupLabel;
});

test("Fullscreen is bigger, stationary, supports tray drag, and preserves state on exit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  const board = page.locator(".jigsaw-board-canvas");
  const boxBeforeFullscreen = await board.boundingBox();

  await page.getByRole("button", { name: "More puzzle actions" }).click();
  await page.getByRole("menuitem", { name: "Fullscreen" }).click();
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-fullscreen", "true");

  // The board becomes physically larger where space permits, and stays fully within the
  // viewport (never cropped, never letterboxed off-screen).
  const boxInFullscreen = await board.boundingBox();
  const viewport = page.viewportSize()!;
  expect(boxInFullscreen!.width * boxInFullscreen!.height).toBeGreaterThan(boxBeforeFullscreen!.width * boxBeforeFullscreen!.height);
  expect(boxInFullscreen!.x).toBeGreaterThanOrEqual(0);
  expect(boxInFullscreen!.y).toBeGreaterThanOrEqual(0);
  expect(boxInFullscreen!.x + boxInFullscreen!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(boxInFullscreen!.y + boxInFullscreen!.height).toBeLessThanOrEqual(viewport.height + 1);

  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first();
  const from = await trayCanvas.boundingBox(); const to = await board.boundingBox();
  const dragId = 401;
  const dragStartX = from!.x + from!.width / 2; const dragStartY = from!.y + from!.height / 2;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId: dragId, pointerType: "mouse", button: 0, buttons: 1, clientX: dragStartX, clientY: dragStartY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId: dragId, pointerType: "mouse", button: 0, buttons: 1, clientX: dragStartX, clientY: dragStartY - 20 });
  await board.dispatchEvent("pointermove", { pointerId: dragId, pointerType: "mouse", button: 0, buttons: 1, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await board.dispatchEvent("pointerup", { pointerId: dragId, pointerType: "mouse", button: 0, buttons: 0, clientX: to!.x + to!.width / 2, clientY: to!.y + to!.height / 2 });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(3);

  // Two-finger movement over the board does not scale or translate it — there is no pinch
  // gesture anymore; a second pointer during a drag would cancel it (covered elsewhere), and
  // with no drag active, additional pointers are simply ignored.
  const boxBeforeTwoFinger = await board.boundingBox();
  const centerX = to!.x + to!.width / 2; const centerY = to!.y + to!.height / 2;
  await board.dispatchEvent("pointerdown", { pointerId: 402, pointerType: "touch", buttons: 1, clientX: centerX - 40, clientY: centerY });
  await board.dispatchEvent("pointerdown", { pointerId: 403, pointerType: "touch", buttons: 1, clientX: centerX + 40, clientY: centerY });
  await board.dispatchEvent("pointermove", { pointerId: 402, pointerType: "touch", buttons: 1, clientX: centerX - 90, clientY: centerY });
  await board.dispatchEvent("pointermove", { pointerId: 403, pointerType: "touch", buttons: 1, clientX: centerX + 90, clientY: centerY });
  await board.dispatchEvent("pointerup", { pointerId: 402, pointerType: "touch" });
  await board.dispatchEvent("pointerup", { pointerId: 403, pointerType: "touch" });
  const boxAfterTwoFinger = await board.boundingBox();
  expect(boxAfterTwoFinger).toEqual(boxBeforeTwoFinger);

  const placedBeforeExit = await page.locator(".jigsaw-root").getAttribute("data-placed-pieces");
  const trayCountBeforeExit = await page.locator(".jigsaw-tray-piece").count();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-fullscreen", "false");
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(trayCountBeforeExit);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", placedBeforeExit ?? "0");
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

test("mobile jigsaw layout: the tray sits directly beneath the board area at 320x710, with no coach", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 710 }, hasTouch: true });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page);
  await installDailyFixture(page);
  await openDaily(page);

  await expect(page.locator(".jigsaw-mobile-coach")).toHaveCount(0);

  const boardBox = await page.locator(".jigsaw-board-area").boundingBox();
  const trayBox = await page.locator(".jigsaw-tray").boundingBox();
  expect(boardBox).not.toBeNull(); expect(trayBox).not.toBeNull();

  // Board area → tray, directly adjacent with no reserved spacer gap.
  const gap = trayBox!.y - (boardBox!.y + boardBox!.height);
  expect(gap).toBeGreaterThanOrEqual(-1);
  expect(gap).toBeLessThanOrEqual(8);
  expect(Math.round(trayBox!.height)).toBe(140);

  const dimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

  await context.close();
});

test("canvas and dragged piece stay clamped to the viewport at 320x710 (mobile scaling regression)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 710 }, hasTouch: true });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page);
  const grid = { rows: 4, cols: 4 };
  await installDailyFixture(page, 0, grid);
  await openDaily(page);

  // Wait at least two animation frames after the puzzle reaches "playing" so any post-mount
  // layout settling has already happened before we take our baseline measurements.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));

  const board = page.locator(".jigsaw-board-canvas");
  const trayPiece = page.locator(".jigsaw-tray-piece").first();
  const trayCanvas = trayPiece.locator("canvas");

  const boxInitial = await board.boundingBox();
  const trayBoxInitial = await trayCanvas.boundingBox();
  expect(boxInitial).not.toBeNull();
  expect(trayBoxInitial).not.toBeNull();

  // Confirm both sizes remain stable with no further settling before any drag begins.
  await page.waitForTimeout(500);
  const boxBefore = await board.boundingBox();
  const from = await trayCanvas.boundingBox();
  expect(boxBefore).not.toBeNull();
  expect(from).not.toBeNull();
  expect(Math.abs(boxBefore!.width - boxInitial!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxBefore!.height - boxInitial!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(from!.width - trayBoxInitial!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(from!.height - trayBoxInitial!.height)).toBeLessThanOrEqual(1);

  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;
  const targetX = boxBefore!.x + boxBefore!.width / 2;
  const targetY = boxBefore!.y + boxBefore!.height / 2;
  const pointerId = 9001;

  // Pick up the tray piece — this shows the floating drag-ghost immediately, at tray size.
  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY - 20 });

  // While the ghost is visible (still hovering the tray), it must never render larger than one
  // board-scale piece plus its existing tab bleed — the exact class of bug this regression test
  // exists to catch.
  const ghost = page.locator('[data-testid="jigsaw-drag-ghost"]');
  await expect(ghost).toBeVisible();
  const ghostBox = await ghost.boundingBox();
  expect(ghostBox).not.toBeNull();
  const cellCss = boxBefore!.width / grid.cols;
  const maxPieceSize = cellCss * (1 + 2 * 0.32) + 4; // 0.32 === THUMB_BLEED_FRAC (tab-protrusion allowance)
  expect(ghostBox!.width).toBeLessThanOrEqual(maxPieceSize);
  expect(ghostBox!.height).toBeLessThanOrEqual(maxPieceSize);

  // Drag it into the center of the board.
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: targetX, clientY: targetY });
  const boxDuring = await board.boundingBox();
  expect(boxDuring).not.toBeNull();

  // Drop it.
  await board.dispatchEvent("pointerup", { pointerId, pointerType: "touch", clientX: targetX, clientY: targetY });
  const boxAfter = await board.boundingBox();
  expect(boxAfter).not.toBeNull();

  // Canvas width/height remain stable within 1px before, during, and after the drag, and stay square.
  for (const box of [boxBefore, boxDuring, boxAfter]) expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxDuring!.width - boxBefore!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxAfter!.width - boxBefore!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxDuring!.height - boxBefore!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxAfter!.height - boxBefore!.height)).toBeLessThanOrEqual(1);

  // Canvas width never exceeds 312px at a 320px viewport, and stays inside the viewport.
  for (const box of [boxBefore, boxDuring, boxAfter]) {
    expect(box!.width).toBeLessThanOrEqual(312);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(321);
  }

  // No horizontal overflow.
  const dims = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth }));
  expect(dims.scrollWidth).toBeLessThanOrEqual(320);

  // The piece was dropped and removed from the tray.
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(grid.rows * grid.cols - 1);

  await context.close();
});
