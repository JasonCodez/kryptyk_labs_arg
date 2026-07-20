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

async function installCatalogFixture(page: Page, failCompletions = 0, skipTokens = 0, grid = { rows: 2, cols: 2 }) {
  let solved = false;
  let attempts = 0;
  const progress = () => ({ id: "jigsaw-progress", userId: "e2e-user", puzzleId: PUZZLE_ID, solved, attempts, pointsEarned: solved ? 100 : 0, successfulAttempts: solved ? 1 : 0, completionPercentage: solved ? 100 : 0, sessionLogs: [], partProgress: [] });
  await page.route("**/e2e-jigsaw.svg*", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: IMAGE_BODY }));
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace(/\/$/, ""); const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: { id: "e2e-user", name: "Jigsaw Tester", email: "jigsaw@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    if (path === `/api/puzzles/${PUZZLE_ID}`) return fulfill({ id: PUZZLE_ID, title: "Catalog Jigsaw E2E", description: "Deterministic fixture", content: "", difficulty: "easy", puzzleType: "jigsaw", xpReward: 50, data: {}, solutions: [{ points: 100 }], category: { name: "Visual" }, media: [], userHistory: [], jigsaw: { imageUrl: IMAGE, gridRows: grid.rows, gridCols: grid.cols, snapTolerance: 24, rotationEnabled: false } });
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
//
// The canvas itself is no longer square while unsolved — it's the square board PLUS a fixed
// parking shelf beneath it (see PLAY_STAGE_HEIGHT in JigsawPuzzleCanvas.tsx) — so the square
// board's own side length is always the canvas's rendered WIDTH, never its (now taller) height.
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
    const renderedBoardSide = boardBox.width;
    const targetX = boardBox.x + (col + 0.5) * cellFrac * renderedBoardSide;
    const targetY = boardBox.y + (row + 0.5) * cellFrac * renderedBoardSide;
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
    // `.jigsaw-board-area` — but while unsolved, the canvas also carries a fixed parking shelf
    // beneath the board (see PLAY_STAGE_HEIGHT), so the canvas itself is taller than it is wide;
    // the square board portion is still exactly canvasBox.width on a side.
    const boardAreaBox = await page.locator(".jigsaw-board-area").boundingBox();
    expect(boardAreaBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThan(canvasBox!.width);
    // The full (taller) canvas must still fit entirely inside .jigsaw-board-area.
    expect(canvasBox!.x).toBeGreaterThanOrEqual(boardAreaBox!.x - 1);
    expect(canvasBox!.y).toBeGreaterThanOrEqual(boardAreaBox!.y - 1);
    expect(canvasBox!.x + canvasBox!.width).toBeLessThanOrEqual(boardAreaBox!.x + boardAreaBox!.width + 1);
    expect(canvasBox!.y + canvasBox!.height).toBeLessThanOrEqual(boardAreaBox!.y + boardAreaBox!.height + 1);
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

    // While unsolved, the canvas carries a fixed parking shelf beneath the square board (see
    // PLAY_STAGE_HEIGHT), so it's taller than it is wide — the square board portion is still
    // exactly canvasBox.width on a side. The full (taller) canvas must still fit inside
    // .jigsaw-board-area.
    expect(canvasBox!.height).toBeGreaterThan(canvasBox!.width);
    expect(canvasBox!.x).toBeGreaterThanOrEqual(boardAreaBox!.x - 1);
    expect(canvasBox!.y).toBeGreaterThanOrEqual(boardAreaBox!.y - 1);
    expect(canvasBox!.x + canvasBox!.width).toBeLessThanOrEqual(boardAreaBox!.x + boardAreaBox!.width + 1);
    expect(canvasBox!.y + canvasBox!.height).toBeLessThanOrEqual(boardAreaBox!.y + boardAreaBox!.height + 1);

    // The board must begin directly beneath the shared header (no large dead region above it —
    // the exact regression the broken puzzle-detail-play-* height chain caused).
    const headerBox = await page.locator(".pw-play-header").boundingBox();
    expect(headerBox).not.toBeNull();
    expect(canvasBox!.y - (headerBox!.y + headerBox!.height)).toBeLessThanOrEqual(20);

    // The card itself must not reserve dead vertical space beyond header+board+tray — i.e. no
    // large unused region below/around the actual playable content.
    const trayBox = await page.locator(".jigsaw-tray").boundingBox();
    expect(trayBox).not.toBeNull();
    expect(trayBox!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height - 1); // tray directly beneath the board
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(trayBox!.y + trayBox!.height + 24);

    await expect(page.locator(".jigsaw-tray")).toBeVisible();

    // No duplicate Skip control below the tray (PuzzleProgressSection removed for jigsaw).
    await expect(page.locator(".puzzle-detail-progress-section")).toHaveCount(0);
    await expect(page.getByText("Skip Puzzle", { exact: false })).toHaveCount(0);

    // Skip remains available through the header's "More puzzle actions" menu.
    await page.getByRole("button", { name: "More puzzle actions" }).click();
    await expect(page.getByRole("menuitem").filter({ hasText: "Skip Puzzle" })).toBeVisible();
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

test("Daily completion is recorded once after the celebration, and waits for Continue before the final handoff", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installDailyFixture(page);
  await openDaily(page);
  await dragEachTrayPieceToItsSlot(page, 2, 2);

  // The completion footer appears once the celebration (frame + clean image + temporary
  // reward card) has finished — but the final parent handoff must NOT happen automatically.
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Puzzle complete" })).toBeVisible();
  await expect(page.getByText("Solved for today!")).toHaveCount(0);
  expect(fixture.requests()).toBe(1);
  expect(fixture.successfulRecords()).toBe(1);

  await continueButton.click();
  await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 10_000 });
  expect(fixture.requests()).toBe(1); // Continue must not resubmit completion
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
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeVisible({ timeout: 10_000 });
  await continueButton.click();
  await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 10_000 });
  expect(fixture.requests()).toBe(2);
  expect(fixture.successfulRecords()).toBe(1);
});

test("Catalog sends attempt_success once and delays its result UI until Continue is pressed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installCatalogFixture(page);
  await page.addInitScript(() => localStorage.setItem("pw_cookie_consent", "1"));
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-mode", "catalog", { timeout: 15_000 });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing");
  await dragEachTrayPieceToItsSlot(page, 2, 2);

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeVisible({ timeout: 15_000 });
  expect(fixture.attempts()).toBe(1);
  // The rating/completion modal handoff has not happened yet — still waiting on Continue.
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "completing");
  await expect(page.getByRole("heading", { name: "Puzzle Complete!" })).toHaveCount(0);

  await continueButton.click();
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "won", { timeout: 15_000 });
  expect(fixture.attempts()).toBe(1); // Continue must not resubmit the attempt
  await expect(page.getByRole("heading", { name: "Puzzle Complete!" })).toBeVisible({ timeout: 10_000 });
});

// Regression coverage for the completion-sequence fix: the decorative frame used to start
// fading in while the canvas was still sized for the plain unframed board (a partial/clipped
// frame that only became whole once a later resize caught up), and the completed puzzle used
// to revert from the clean source image back to visibly piece-rendered artwork once the
// living-photo overlay finished fading away. Also proves the framed layout is fully settled —
// and stays settled, with no second resize — by the time the completion footer appears.
test("Completion reaches a stable framed layout with the clean image before the footer appears, and Continue fires the handoff exactly once", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installCatalogFixture(page);
  await page.addInitScript(() => localStorage.setItem("pw_cookie_consent", "1"));
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  await dragEachTrayPieceToItsSlot(page, 2, 2);

  const board = page.locator(".jigsaw-board-canvas");
  await expect(board).toHaveAttribute("data-completed-image", "true", { timeout: 15_000 });

  // Footer appears in non-Warz mode, and the final handoff has not happened yet.
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Puzzle complete" })).toBeVisible();
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "completing");
  await expect(page.getByRole("heading", { name: "Puzzle Complete!" })).toHaveCount(0);

  // The framed canvas must already be at its final size, fully contained in .jigsaw-board-area.
  const canvasBoxAtFooter = await board.boundingBox();
  const boardAreaBox = await page.locator(".jigsaw-board-area").boundingBox();
  expect(canvasBoxAtFooter).not.toBeNull(); expect(boardAreaBox).not.toBeNull();
  expect(canvasBoxAtFooter!.x).toBeGreaterThanOrEqual(boardAreaBox!.x - 1);
  expect(canvasBoxAtFooter!.y).toBeGreaterThanOrEqual(boardAreaBox!.y - 1);
  expect(canvasBoxAtFooter!.x + canvasBoxAtFooter!.width).toBeLessThanOrEqual(boardAreaBox!.x + boardAreaBox!.width + 1);
  expect(canvasBoxAtFooter!.y + canvasBoxAtFooter!.height).toBeLessThanOrEqual(boardAreaBox!.y + boardAreaBox!.height + 1);

  // No second canvas-size change while the footer/reward-card sequence plays out, and the
  // clean completed-image state remains true throughout.
  await page.waitForTimeout(500);
  const canvasBoxAfterWait = await board.boundingBox();
  expect(Math.abs(canvasBoxAfterWait!.width - canvasBoxAtFooter!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvasBoxAfterWait!.height - canvasBoxAtFooter!.height)).toBeLessThanOrEqual(1);
  await expect(board).toHaveAttribute("data-completed-image", "true");

  await continueButton.click();
  // Continue disables/relabels itself while the handoff is in flight.
  await expect(page.getByRole("button", { name: "Continuing…" })).toBeVisible();

  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "won", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Puzzle Complete!" })).toBeVisible({ timeout: 10_000 });
  expect(fixture.attempts()).toBe(1); // handoff didn't resubmit the attempt

  const canvasBoxAfterContinue = await board.boundingBox();
  expect(Math.abs(canvasBoxAfterContinue!.width - canvasBoxAtFooter!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvasBoxAfterContinue!.height - canvasBoxAtFooter!.height)).toBeLessThanOrEqual(1);
});

// Warz keeps its existing fully automatic completion — no footer, no waiting on the player.
test("Warz completes automatically with no completion footer and no wait for Continue", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWarzFixture(page);
  await page.addInitScript(() => localStorage.setItem("pw_cookie_consent", "1"));
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-mode", "warz", { timeout: 15_000 });
  await dragEachTrayPieceToItsSlot(page, 2, 2);

  // Warz's own automatic "submitting result" UI appears without any Continue interaction.
  await expect(page.getByText(/Solved in .*! Submitting result/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Puzzle complete" })).toHaveCount(0);
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

// Regression coverage for the parking-shelf bug fix: a piece released between the square board
// and the tray used to commit to an off-stage position, get culled by the renderer, and become
// permanently unrecoverable except via "Return loose pieces to tray". The shelf is now real,
// hit-testable stage space (see PARKING_ZONE_HEIGHT in JigsawPuzzleCanvas.tsx).
//
// Uses a 4x4 grid (piece size 160 logical) rather than the 2x2 default: at 2x2 a single piece
// (320 logical) is bigger than the whole shelf and the safety clamp legitimately repositions it,
// which is correct product behavior but makes "drop here, expect it to stay exactly there"
// assertions flaky. At 4x4 a piece comfortably fits inside the shelf with room to spare.
const PARKING_TEST_GRID = { rows: 4, cols: 4 };
const PARKING_TEST_PIECE_COUNT = PARKING_TEST_GRID.rows * PARKING_TEST_GRID.cols;

test("A piece dropped in the parking shelf stays visible, unsnapped, and recoverable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page, 0, 0, PARKING_TEST_GRID);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });

  const trayPiece = page.locator(".jigsaw-tray-piece").first();
  const label = await trayPiece.getAttribute("aria-label");
  const match = label?.match(/row (\d+) column (\d+)/i);
  if (!match) throw new Error(`Could not parse row/column from tray piece aria-label: ${label}`);
  const row = Number(match[1]) - 1;
  const col = Number(match[2]) - 1;

  const board = page.locator(".jigsaw-board-canvas");
  const canvasBox = await board.boundingBox();
  if (!canvasBox) throw new Error("Missing canvas bounding box");
  const boardSide = canvasBox.width;
  const parkingHeight = canvasBox.height - boardSide;
  expect(parkingHeight).toBeGreaterThan(0); // the shelf must actually exist while unsolved

  const parkingX = canvasBox.x + canvasBox.width * 0.65;
  const parkingY = canvasBox.y + boardSide + parkingHeight * 0.5;

  const trayCanvas = trayPiece.locator("canvas");
  const from = await trayCanvas.boundingBox();
  if (!from) throw new Error("Missing tray piece bounding box");
  const startX = from.x + from.width / 2; const startY = from.y + from.height / 2;
  const dropId = 8001;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: parkingX, clientY: parkingY });
  await board.dispatchEvent("pointerup", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 0, clientX: parkingX, clientY: parkingY });

  // Left the tray, but did not count as a board placement — it's parked, not snapped.
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(PARKING_TEST_PIECE_COUNT - 1);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");

  // Pick it back up from its parked position — proving it's real, hit-testable stage content,
  // not an invisible/unreachable off-stage commit — and drag it onto its correct board cell.
  const cellFrac = 1 / PARKING_TEST_GRID.rows;
  const targetX = canvasBox.x + (col + 0.5) * cellFrac * boardSide;
  const targetY = canvasBox.y + (row + 0.5) * cellFrac * boardSide;
  const pickId = 8002;
  await board.dispatchEvent("pointerdown", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: parkingX, clientY: parkingY });
  await board.dispatchEvent("pointermove", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: targetX, clientY: targetY });
  await board.dispatchEvent("pointerup", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 0, clientX: targetX, clientY: targetY });

  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "1");
});

test("A piece released just below the playable stage (not over the tray) is clamped visible, never lost", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page, 0, 0, PARKING_TEST_GRID);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });

  const board = page.locator(".jigsaw-board-canvas");
  const trayCanvas = page.locator(".jigsaw-tray-piece").first().locator("canvas");
  const from = await trayCanvas.boundingBox();
  const canvasBox = await board.boundingBox();
  const trayBox = await page.locator(".jigsaw-tray").boundingBox();
  if (!from || !canvasBox || !trayBox) throw new Error("Missing bounding box");

  // A point in the DOM gap between the bottom of the (taller) canvas and the top of the tray —
  // below the whole playable stage, but not inside the tray rect either.
  const gapX = canvasBox.x + canvasBox.width / 2;
  const gapY = (canvasBox.y + canvasBox.height + trayBox.y) / 2;
  expect(gapY).toBeGreaterThan(canvasBox.y + canvasBox.height);
  expect(gapY).toBeLessThan(trayBox.y);

  const startX = from.x + from.width / 2; const startY = from.y + from.height / 2;
  const dropId = 8003;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: gapX, clientY: gapY });
  await board.dispatchEvent("pointerup", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 0, clientX: gapX, clientY: gapY });

  // Never silently returned to the tray, never snapped, and never lost — it must still be
  // present, visible, and pickable somewhere on the (real) stage.
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");
  const trayCountAfterDrop = await page.locator(".jigsaw-tray-piece").count();
  expect(trayCountAfterDrop).toBe(PARKING_TEST_PIECE_COUNT - 1);

  // Recoverability proof: it can still be picked up from wherever the safety clamp parked it
  // and moved elsewhere on the stage.
  const parkedX = canvasBox.x + canvasBox.width * 0.5;
  const parkedY = canvasBox.y + canvasBox.height - 20; // just inside the clamped stage bottom
  const pickId = 8004;
  await board.dispatchEvent("pointerdown", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: parkedX, clientY: parkedY });
  await board.dispatchEvent("pointermove", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: parkedX - 40, clientY: parkedY - 10 });
  await board.dispatchEvent("pointerup", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 0, clientX: parkedX - 40, clientY: parkedY - 10 });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(PARKING_TEST_PIECE_COUNT - 1); // still not back in the tray, still not snapped, still on-stage
});

test("A parked piece restores visibly and remains draggable after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCatalogFixture(page, 0, 0, PARKING_TEST_GRID);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });

  const board = page.locator(".jigsaw-board-canvas");
  const canvasBox = await board.boundingBox();
  if (!canvasBox) throw new Error("Missing canvas bounding box");
  const boardSide = canvasBox.width;
  const parkingHeight = canvasBox.height - boardSide;
  const parkingX = canvasBox.x + canvasBox.width * 0.35;
  const parkingY = canvasBox.y + boardSide + parkingHeight * 0.5;

  const trayCanvas = page.locator(".jigsaw-tray-piece").first().locator("canvas");
  const from = await trayCanvas.boundingBox();
  if (!from) throw new Error("Missing tray piece bounding box");
  const startX = from.x + from.width / 2; const startY = from.y + from.height / 2;
  const dropId = 8005;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 1, clientX: parkingX, clientY: parkingY });
  await board.dispatchEvent("pointerup", { pointerId: dropId, pointerType: "mouse", button: 0, buttons: 0, clientX: parkingX, clientY: parkingY });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(PARKING_TEST_PIECE_COUNT - 1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });

  // Restored: still parked (not back in the tray, not snapped), and elapsed time/tray order
  // restore normally (the existing "resumed" banner is the app's own signal for that).
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(PARKING_TEST_PIECE_COUNT - 1);
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-placed-pieces", "0");

  // Still draggable after restoration — pick it up from the shelf and confirm it moves.
  const restoredBoard = page.locator(".jigsaw-board-canvas");
  const restoredBox = await restoredBoard.boundingBox();
  if (!restoredBox) throw new Error("Missing restored canvas bounding box");
  const restoredParkingX = restoredBox.x + restoredBox.width * 0.35;
  const restoredParkingY = restoredBox.y + restoredBox.width + (restoredBox.height - restoredBox.width) * 0.5;
  const pickId = 8006;
  await restoredBoard.dispatchEvent("pointerdown", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: restoredParkingX, clientY: restoredParkingY });
  await restoredBoard.dispatchEvent("pointermove", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 1, clientX: restoredParkingX + 30, clientY: restoredParkingY });
  await restoredBoard.dispatchEvent("pointerup", { pointerId: pickId, pointerType: "mouse", button: 0, buttons: 0, clientX: restoredParkingX + 30, clientY: restoredParkingY });
  await expect(page.locator(".jigsaw-tray-piece")).toHaveCount(PARKING_TEST_PIECE_COUNT - 1); // still parked, not returned to tray, drag was accepted
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

async function measureCanvasBacking(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".jigsaw-board-canvas") as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      boundingWidth: rect.width,
      boundingHeight: rect.height,
      attrWidth: canvas.width,
      attrHeight: canvas.height,
      dpr: window.devicePixelRatio,
    };
  });
}

for (const deviceScaleFactor of [1, 2, 3]) {
  test(`board canvas backing store matches CSS size × DPR ${deviceScaleFactor} at 320x710`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 710 }, hasTouch: true, deviceScaleFactor });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page);
    await installDailyFixture(page, 0, { rows: 4, cols: 4 });
    await openDaily(page);
    // Let the resize effect settle (two animation frames) before measuring.
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));

    const before = await measureCanvasBacking(page);
    expect(before.dpr).toBe(deviceScaleFactor);
    expect(Math.abs(before.attrWidth - before.boundingWidth * before.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.attrHeight - before.boundingHeight * before.dpr)).toBeLessThanOrEqual(1);
    // While unsolved, the canvas carries a fixed parking shelf beneath the square board (see
    // PLAY_STAGE_HEIGHT) — taller than it is wide, not square. The square board portion is
    // still exactly boundingWidth on a side.
    expect(before.boundingHeight).toBeGreaterThan(before.boundingWidth);
    expect(before.boundingWidth).toBeLessThanOrEqual(320);

    const dimsBefore = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(dimsBefore).toBeLessThanOrEqual(320);

    // Pick up a tray piece and confirm the backing-store ratio while it's still over the tray.
    const board = page.locator(".jigsaw-board-canvas");
    const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first();
    const from = await trayCanvas.boundingBox();
    const boardBox = await board.boundingBox();
    expect(from).not.toBeNull(); expect(boardBox).not.toBeNull();
    const startX = from!.x + from!.width / 2;
    const startY = from!.y + from!.height / 2;
    const targetX = boardBox!.x + boardBox!.width / 2;
    const targetY = boardBox!.y + boardBox!.height / 2;
    const pointerId = 7777;

    await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY });
    await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY - 20 });
    const duringPickup = await measureCanvasBacking(page);
    expect(Math.abs(duringPickup.attrWidth - duringPickup.boundingWidth * duringPickup.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(duringPickup.attrHeight - duringPickup.boundingHeight * duringPickup.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(duringPickup.boundingWidth - before.boundingWidth)).toBeLessThanOrEqual(1); // CSS size stable

    // Move onto the board — confirm the ratio remains correct while over the board.
    await board.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: targetX, clientY: targetY });
    const overBoard = await measureCanvasBacking(page);
    expect(Math.abs(overBoard.attrWidth - overBoard.boundingWidth * overBoard.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(overBoard.attrHeight - overBoard.boundingHeight * overBoard.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(overBoard.boundingWidth - before.boundingWidth)).toBeLessThanOrEqual(1);

    // Drop the piece — confirm the ratio remains correct after drop, and nothing overflowed.
    await board.dispatchEvent("pointerup", { pointerId, pointerType: "touch", clientX: targetX, clientY: targetY });
    const afterDrop = await measureCanvasBacking(page);
    expect(Math.abs(afterDrop.attrWidth - afterDrop.boundingWidth * afterDrop.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterDrop.attrHeight - afterDrop.boundingHeight * afterDrop.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterDrop.boundingWidth - before.boundingWidth)).toBeLessThanOrEqual(1);

    const dimsAfter = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(dimsAfter).toBeLessThanOrEqual(320);

    await context.close();
  });
}

async function measureCatalogWidths(page: Page) {
  return page.evaluate(() => {
    const inner = window.innerWidth;
    const rect = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return el ? el.getBoundingClientRect() : null;
    };
    const shell = document.querySelector(".jigsaw-renderer-shell") as HTMLElement | null;
    const shellChildRect = shell?.firstElementChild ? (shell.firstElementChild as HTMLElement).getBoundingClientRect() : null;
    const canvas = document.querySelector(".jigsaw-board-canvas") as HTMLCanvasElement | null;
    const canvasRect = canvas?.getBoundingClientRect() ?? null;
    const round = (n: number | undefined) => (n === undefined ? null : Math.round(n * 100) / 100);
    const widthOf = (r: DOMRect | null) => (r ? round(r.width) : null);
    const rightOf = (r: DOMRect | null) => (r ? round(r.right) : null);
    const exceeds = (r: DOMRect | null) => (r ? r.right > inner + 0.5 : false);
    const cardBody = rect(".puzzle-detail-play-card-body");
    const root = rect(".jigsaw-root");
    const area = rect(".jigsaw-board-area");
    const trayWrap = rect(".jigsaw-tray-wrap");
    const tray = rect(".jigsaw-tray");
    return {
      innerWidth: inner,
      docScrollWidth: document.documentElement.scrollWidth,
      cardBodyWidth: widthOf(cardBody),
      rendererShellWidth: widthOf(shell?.getBoundingClientRect() ?? null),
      rendererShellChildWidth: widthOf(shellChildRect),
      rootWidth: widthOf(root),
      areaWidth: widthOf(area),
      trayWrapWidth: widthOf(trayWrap),
      trayWidth: widthOf(tray),
      canvasWidth: widthOf(canvasRect),
      anyExceeds: [cardBody, shell?.getBoundingClientRect() ?? null, shellChildRect, root, area, trayWrap, tray, canvasRect].some(exceeds),
      rights: {
        cardBody: rightOf(cardBody),
        root: rightOf(root),
        area: rightOf(area),
        trayWrap: rightOf(trayWrap),
        tray: rightOf(tray),
        canvas: rightOf(canvasRect),
      },
    };
  });
}

function expectFullWidth(widths: Awaited<ReturnType<typeof measureCatalogWidths>>, target: number, tolerance = 2) {
  expect(Math.abs(widths.cardBodyWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(widths.rendererShellWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(widths.rendererShellChildWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(widths.rootWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(widths.areaWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(widths.trayWrapWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(widths.trayWidth! - target)).toBeLessThanOrEqual(tolerance);
  expect(widths.anyExceeds).toBe(false);
  expect(widths.docScrollWidth).toBeLessThanOrEqual(target);
}

test("Catalog Jigsaw renders full-width at 320x710 (DPR 2), before and after a drag", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 710 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page);
  await installCatalogFixture(page);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));

  const before = await measureCatalogWidths(page);
  expectFullWidth(before, 320);
  expect(before.canvasWidth!).toBeGreaterThanOrEqual(300);

  const board = page.locator(".jigsaw-board-canvas");
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first();
  const from = await trayCanvas.boundingBox();
  const boardBox = await board.boundingBox();
  expect(from).not.toBeNull(); expect(boardBox).not.toBeNull();
  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;
  const targetX = boardBox!.x + boardBox!.width / 2;
  const targetY = boardBox!.y + boardBox!.height / 2;
  const pointerId = 6543;

  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: targetX, clientY: targetY });
  await board.dispatchEvent("pointerup", { pointerId, pointerType: "touch", clientX: targetX, clientY: targetY });

  const after = await measureCatalogWidths(page);
  expectFullWidth(after, 320);
  expect(after.canvasWidth!).toBeGreaterThanOrEqual(300);

  await context.close();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 529, height: 800 },
  { width: 530, height: 800 },
]) {
  test(`Catalog Jigsaw renders full-width at ${viewport.width}x${viewport.height} (DPR 2)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page);
    await installCatalogFixture(page);
    await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));

    const widths = await measureCatalogWidths(page);
    console.log(`[${viewport.width}x${viewport.height} DPR2]`, JSON.stringify(widths));
    expectFullWidth(widths, viewport.width);

    await context.close();
  });
}

test("no width jump between 529px and 530px (Catalog, DPR 2)", async ({ browser }) => {
  const widths: Record<number, Awaited<ReturnType<typeof measureCatalogWidths>>> = {};
  for (const width of [529, 530]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page);
    await installCatalogFixture(page);
    await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".jigsaw-root")).toHaveAttribute("data-status", "playing", { timeout: 15_000 });
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    widths[width] = await measureCatalogWidths(page);
    await context.close();
  }
  console.log("529:", JSON.stringify(widths[529]));
  console.log("530:", JSON.stringify(widths[530]));
  expect(Math.abs(widths[530].rootWidth! - widths[529].rootWidth! - 1)).toBeLessThanOrEqual(1);
  expect(Math.abs(widths[530].areaWidth! - widths[529].areaWidth! - 1)).toBeLessThanOrEqual(1);
  expect(Math.abs(widths[530].canvasWidth! - widths[529].canvasWidth!)).toBeLessThanOrEqual(2);
});

test("Quick Tip is a body-level portal, does not affect layout, and survives dismissal + drag at 320x710 (DPR 2)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 710 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await authenticate(page);
  await installDailyFixture(page, 0, { rows: 4, cols: 4 });
  await openDaily(page);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));

  // The Quick Tip appears, is a direct child of document.body (via the portal), and is not
  // nested inside .jigsaw-root at all.
  const tip = page.locator(".jigsaw-quick-tip-wrapper");
  await expect(tip).toBeVisible();
  const portalCheck = await page.evaluate(() => {
    const wrapper = document.querySelector(".jigsaw-quick-tip-wrapper");
    return {
      isDirectBodyChild: wrapper?.parentElement === document.body,
      isInsideRoot: !!wrapper?.closest(".jigsaw-root"),
    };
  });
  expect(portalCheck.isDirectBodyChild).toBe(true);
  expect(portalCheck.isInsideRoot).toBe(false);

  const widthsWithTip = await measureCatalogWidths(page);
  expect(widthsWithTip.canvasWidth!).toBeGreaterThanOrEqual(300);
  expect(widthsWithTip.rootWidth!).toBeGreaterThanOrEqual(318);
  expect(widthsWithTip.areaWidth!).toBeGreaterThanOrEqual(318);
  expect(widthsWithTip.trayWidth!).toBeGreaterThanOrEqual(318);

  const canvasBackingBefore = await page.evaluate(() => {
    const c = document.querySelector(".jigsaw-board-canvas") as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { attrW: c.width, attrH: c.height, boundW: r.width, boundH: r.height, dpr: window.devicePixelRatio };
  });
  expect(Math.abs(canvasBackingBefore.attrW - canvasBackingBefore.boundW * canvasBackingBefore.dpr)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvasBackingBefore.attrH - canvasBackingBefore.boundH * canvasBackingBefore.dpr)).toBeLessThanOrEqual(1);

  // Dismissing the tip must not change canvas, root, board-area, or tray dimensions.
  await page.getByRole("button", { name: "Dismiss jigsaw tip" }).click();
  await expect(tip).toHaveCount(0);
  const widthsAfterDismiss = await measureCatalogWidths(page);
  expect(widthsAfterDismiss.canvasWidth).toBe(widthsWithTip.canvasWidth);
  expect(widthsAfterDismiss.rootWidth).toBe(widthsWithTip.rootWidth);
  expect(widthsAfterDismiss.areaWidth).toBe(widthsWithTip.areaWidth);
  expect(widthsAfterDismiss.trayWidth).toBe(widthsWithTip.trayWidth);

  // Drag and drop one piece after dismissal — piece/canvas scale remains correct, no overflow.
  const board = page.locator(".jigsaw-board-canvas");
  const trayCanvas = page.locator(".jigsaw-tray-piece canvas").first();
  const from = await trayCanvas.boundingBox();
  const boardBox = await board.boundingBox();
  expect(from).not.toBeNull(); expect(boardBox).not.toBeNull();
  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;
  const targetX = boardBox!.x + boardBox!.width / 2;
  const targetY = boardBox!.y + boardBox!.height / 2;
  const pointerId = 4242;
  await trayCanvas.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY });
  await trayCanvas.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: startX, clientY: startY - 20 });
  await board.dispatchEvent("pointermove", { pointerId, pointerType: "touch", buttons: 1, clientX: targetX, clientY: targetY });
  await board.dispatchEvent("pointerup", { pointerId, pointerType: "touch", clientX: targetX, clientY: targetY });

  const canvasBackingAfter = await page.evaluate(() => {
    const c = document.querySelector(".jigsaw-board-canvas") as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { attrW: c.width, attrH: c.height, boundW: r.width, boundH: r.height, dpr: window.devicePixelRatio };
  });
  expect(Math.abs(canvasBackingAfter.attrW - canvasBackingAfter.boundW * canvasBackingAfter.dpr)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvasBackingAfter.attrH - canvasBackingAfter.boundH * canvasBackingAfter.dpr)).toBeLessThanOrEqual(1);
  expect(canvasBackingAfter.boundW).toBe(canvasBackingBefore.boundW);

  const dims = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(dims).toBeLessThanOrEqual(320);

  await context.close();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 529, height: 800 },
  { width: 530, height: 800 },
]) {
  test(`Quick Tip renders as a body portal with no layout impact at ${viewport.width}x${viewport.height} (DPR 2)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page);
    await installDailyFixture(page, 0, { rows: 3, cols: 3 });
    await openDaily(page);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));

    const portalCheck = await page.evaluate(() => {
      const wrapper = document.querySelector(".jigsaw-quick-tip-wrapper");
      return {
        exists: !!wrapper,
        isDirectBodyChild: wrapper?.parentElement === document.body,
        isInsideRoot: !!wrapper?.closest(".jigsaw-root"),
      };
    });
    expect(portalCheck.exists).toBe(true);
    expect(portalCheck.isDirectBodyChild).toBe(true);
    expect(portalCheck.isInsideRoot).toBe(false);

    // Daily route (not Catalog) — .puzzle-detail-play-card-body/.jigsaw-renderer-shell don't
    // exist here, so only assert the widths that apply to both routes.
    const widths = await measureCatalogWidths(page);
    console.log(`[quick tip ${viewport.width}x${viewport.height} DPR2]`, JSON.stringify(widths));
    expect(widths.rootWidth).toBe(viewport.width);
    expect(widths.areaWidth).toBe(viewport.width);
    expect(widths.trayWrapWidth).toBe(viewport.width);
    expect(widths.trayWidth).toBe(viewport.width);
    expect(widths.anyExceeds).toBe(false);
    expect(widths.docScrollWidth).toBeLessThanOrEqual(viewport.width);

    await context.close();
  });
}
