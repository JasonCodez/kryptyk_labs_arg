import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const PUZZLE_ID = "e2e-word-trove";

function fixture(size: number, short = false) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => "X"));
  const placements: Array<[string, number, number, number, number]> = [
    ["CAT", 0, 0, 0, 1],
    ["DOG", 1, 2, 0, -1],
    ["BIRD", 0, size - 1, 1, 0],
    ["FISH", 0, Math.min(5, size - 4), 1, 1],
    ["MOON", 4, 0, 0, 1],
    ["STAR", 5, 0, 0, 1],
    ["CODE", 6, 0, 0, 1],
    ["PLAY", 7, 0, 0, 1],
    ["GRID", 8, 0, 0, 1],
    ["WORD", 9, 0, 0, 1],
    ["TROVE", 10, 0, 0, 1],
    ["PUZZLE", 11, 0, 0, 1],
    ["ZOOM", 15, 10, 0, 1],
  ];
  const selected = short ? placements.slice(0, 2) : placements.slice(0, size >= 20 ? 13 : size >= 15 ? 12 : 10);
  for (const [word, row, col, dr, dc] of selected) word.split("").forEach((letter, index) => { grid[row + dr * index][col + dc * index] = letter; });
  return { grid, words: selected.map(([word]) => word) };
}

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({ secret, maxAge: 3600, token: { sub: "e2e-user", id: "e2e-user", name: "Word Trove Tester", email: "trove@example.test", role: "user", betaApproved: true } });
  await page.context().addCookies([{ name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  await page.addInitScript(() => localStorage.setItem("wordTroveIntroSeen", "1"));
}

async function installRoutes(page: Page, size: number, short = false) {
  const data = fixture(size, short);
  const found = new Set<string>();
  const submissions: string[] = [];
  let dailySolved = false;
  let catalogSolved = false;
  let dailyCompletions = 0;
  let attemptSuccess = 0;
  let hintConsumes = 0;
  let failDailyOnce = false;
  let dailyDayNumber = 142;
  let repairRequired = false;
  let reconciliations = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace(/\/$/, ""); const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
    if (path === "/api/auth/session") return fulfill({ user: { id: "e2e-user", name: "Word Trove Tester", email: "trove@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    if (path === "/api/daily/word_search/content") return fulfill({ available: true, dayNumber: dailyDayNumber, puzzleId: PUZZLE_ID });
    if (path === "/api/daily/word_search/complete") {
      if (method === "POST") {
        dailyCompletions += 1;
        if (failDailyOnce) { failDailyOnce = false; return fulfill({ success: false, error: "Offline" }, 503); }
        dailySolved = true; return fulfill({ success: true, reward: { points: 70, xp: 35, streakDay: 7 } });
      }
      return fulfill({ completedToday: dailySolved, streak: 7, streakDay: 7, nextReward: { points: 70, xp: 35, streakDay: 7 }, streakShields: 0, skipTokens: 1 });
    }
    if (path === `/api/puzzles/${PUZZLE_ID}`) return fulfill({ id: PUZZLE_ID, title: "Word Trove E2E", description: "Deterministic Word Trove", content: "", difficulty: "medium", puzzleType: "word_search", xpReward: 100, solutions: [{ points: 100 }], data, category: { name: "Word Games" }, media: [], userHistory: [] });
    if (path === `/api/puzzles/${PUZZLE_ID}/word_search`) {
      if (method === "POST") {
        const body = request.postDataJSON() as { action?: string; word: string; dailyMode?: boolean };
        if (body.action === "reconcile_completion") {
          reconciliations += 1; repairRequired = false; catalogSolved = true;
          return fulfill({ valid: true, persisted: true, submissionsComplete: true, completionCommitted: true, allFound: true, foundCount: found.size, total: data.words.length });
        }
        submissions.push(body.word);
        found.add(body.word); if (found.size === data.words.length && !body.dailyMode) catalogSolved = true;
        return fulfill({ valid: true, persisted: !body.dailyMode, completionCommitted: !body.dailyMode && found.size === data.words.length, foundCount: found.size, total: data.words.length, allFound: found.size === data.words.length });
      }
      return fulfill({ foundWords: [...found], foundCount: found.size, total: data.words.length, submissionsComplete: found.size === data.words.length, repairRequired, allFound: catalogSolved && found.size === data.words.length, completionCommitted: catalogSolved });
    }
    if (path === `/api/puzzles/${PUZZLE_ID}/progress`) {
      if (method === "POST" && request.postDataJSON().action === "attempt_success") attemptSuccess += 1;
      return fulfill({ id: "trove-progress", userId: "e2e-user", puzzleId: PUZZLE_ID, solved: catalogSolved, attempts: found.size, pointsEarned: catalogSolved ? 100 : 0, successfulAttempts: catalogSolved ? 1 : 0, completionPercentage: data.words.length ? found.size / data.words.length * 100 : 0, sessionLogs: [], partProgress: [] });
    }
    if (path === `/api/puzzles/${PUZZLE_ID}/hints`) return fulfill({ hints: [], hintTokens: 2, skipTokens: 1 });
    if (path === "/api/user/consume-hint-token") { hintConsumes += 1; return fulfill({ remainingTokens: Math.max(0, 2 - hintConsumes) }); }
    if (path === `/api/puzzles/${PUZZLE_ID}/comparison-stats`) return fulfill({ percentile: 50, averageTime: 60, totalSolves: 1 });
    if (path === "/api/user/info") return fulfill({ id: "e2e-user", username: "trove-tester", totalPoints: 1000, totalXp: 0, activeSkin: "default" });
    if (path === "/api/warz/check-eligible") return fulfill({ eligible: true });
    if (path === "/api/user/profile") return fulfill({ activeSkin: "default", activeCompletionAnimation: "default" });
    if (path === "/api/dictionary/define") return fulfill({ found: true, partOfSpeech: "noun", definition: `Definition of ${url.searchParams.get("word")}`, example: null, audioUrl: null, phonetic: null });
    return fulfill({});
  });
  return {
    data,
    found,
    submissions,
    dailyCompletions: () => dailyCompletions,
    attemptSuccess: () => attemptSuccess,
    hintConsumes: () => hintConsumes,
    reconciliations: () => reconciliations,
    failNextDaily: () => { failDailyOnce = true; },
    setDailyDay: (day: number) => { dailyDayNumber = day; },
    seedLegacyRepair: () => { data.words.forEach((word) => found.add(word)); repairRequired = true; catalogSolved = false; },
  };
}

async function dragWord(page: Page, start: [number, number], end: [number, number]) {
  const first = page.locator(`[data-ws-row="${start[0]}"][data-ws-col="${start[1]}"]`); const last = page.locator(`[data-ws-row="${end[0]}"][data-ws-col="${end[1]}"]`);
  const a = await first.boundingBox(); const b = await last.boundingBox(); expect(a).not.toBeNull(); expect(b).not.toBeNull();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2); await page.mouse.down(); await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 8 }); await page.mouse.up();
}

// ── Pointer-gesture regression helpers (local to this spec; see the "rapid drag" /
// "imprecise diagonal" / "pointer cancel" / "second pointer" / "off-board release" /
// "two-tap cancellation" / "zoom and pan" tests below) ──────────────────────────────

async function cellBox(page: Page, row: number, col: number) {
  const box = await page.locator(`[data-ws-row="${row}"][data-ws-col="${col}"]`).boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function cellCenter(box: { x: number; y: number; width: number; height: number }, offset: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
  return { x: box.x + box.width / 2 + offset.dx, y: box.y + box.height / 2 + offset.dy };
}

async function selectedCellCount(page: Page) {
  return page.locator("[data-selected]").count();
}

/** Records every real pointerdown pointerId the board actually receives, so a synthetic
 * cancel/interruption never has to assume a hard-coded id like 1. */
async function installPointerIdCapture(page: Page) {
  await page.locator(".word-search-board").evaluate((element) => {
    const store = window as unknown as { __wsPointerIds: number[] };
    store.__wsPointerIds = [];
    element.addEventListener("pointerdown", (event) => store.__wsPointerIds.push((event as PointerEvent).pointerId));
  });
}

async function lastCapturedPointerId(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __wsPointerIds: number[] }).__wsPointerIds.at(-1)!);
}

/** Dispatches a genuine (bubbling) native PointerEvent straight at the board so React's
 * delegated pointer handlers run exactly as they would for real input — used only for the
 * cancellation/interruption cases a scripted mouse sequence can't otherwise produce. */
async function dispatchBoardPointerEvent(page: Page, type: string, pointerId: number, point: { x: number; y: number }, pointerType: "mouse" | "touch" = "mouse") {
  await page.locator(".word-search-board").evaluate((element, args) => {
    element.dispatchEvent(new PointerEvent(args.type, {
      pointerId: args.pointerId,
      pointerType: args.pointerType,
      clientX: args.x,
      clientY: args.y,
      bubbles: true,
      cancelable: true,
    }));
  }, { type, pointerId, pointerType, x: point.x, y: point.y });
}

async function expectMobileFit(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight }));
  expect(dimensions.docWidth).toBeLessThanOrEqual(dimensions.width + 1); expect(dimensions.docHeight).toBeLessThanOrEqual(dimensions.height + 1);
  for (const selector of [".word-search-board", ".word-search-controls"]) {
    const box = await page.locator(selector).boundingBox(); expect(box).not.toBeNull(); expect(box!.y + box!.height).toBeLessThanOrEqual(dimensions.height + 1);
  }
  const progressSurface = page.locator(".word-search-word-dock:visible,.word-search-desktop-list:visible"); const progressBox = await progressSurface.boundingBox(); expect(progressBox).not.toBeNull(); expect(progressBox!.y + progressBox!.height).toBeLessThanOrEqual(dimensions.height + 1);
  const targets = await page.locator(".word-search-list-button:visible,.word-search-hint-button:visible").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  targets.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));
}

const mobileCases = [
  { viewport: { width: 360, height: 800 }, size: 10 },
  { viewport: { width: 390, height: 844 }, size: 15 },
  { viewport: { width: 430, height: 932 }, size: 18 },
  { viewport: { width: 844, height: 390 }, size: 15 },
];

for (const { viewport, size } of mobileCases) {
  test(`daily ${size}x${size} Word Trove fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await authenticate(page); await installRoutes(page, size); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 }); await expect(page.locator("input,textarea")).toHaveCount(0); await expectMobileFit(page);
    await expect(page.getByTestId("puzzle-header-subtitle")).toContainText("#142 · 🔥 7"); await expect(page.getByRole("heading", { name: "WORD TROVE" })).toHaveCount(0);
  });
}

test("15x15 board uses nearly the full 320px width with a small edge margin", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 710 }); await authenticate(page); await installRoutes(page, 15); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  const dimensions = await page.evaluate(() => ({ width: innerWidth, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight, innerHeight }));
  expect(dimensions.docWidth).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.docHeight).toBeLessThanOrEqual(dimensions.innerHeight + 1);
  const boardBox = await page.locator(".word-search-board").boundingBox(); expect(boardBox).not.toBeNull();
  expect(boardBox!.width).toBeGreaterThanOrEqual(280);
  expect(boardBox!.width).toBeLessThanOrEqual(dimensions.width);
  expect(boardBox!.x).toBeGreaterThanOrEqual(8);
  expect(dimensions.width - (boardBox!.x + boardBox!.width)).toBeGreaterThanOrEqual(8);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"]')).toHaveText("C");
  await expect(page.locator(".word-search-word-dock:visible,.word-search-desktop-list:visible")).toBeVisible();
  await expect(page.locator(".word-search-hint-button:visible")).toBeVisible();
});

test("drag, reverse, vertical, diagonal, keyboard, word list, definition, help, and hint work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); const state = await installRoutes(page, 15); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  // None of these finds is the puzzle's final word (12 total), so — per Pass 3 — none of them
  // opens a definition automatically; the player continues solving without a dismissal step.
  await dragWord(page, [0, 0], [0, 2]); await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  await dragWord(page, [1, 0], [1, 2]); await expect.poll(() => state.found.has("DOG")).toBe(true);
  await dragWord(page, [0, 14], [3, 14]); await expect.poll(() => state.found.has("BIRD")).toBe(true);
  await dragWord(page, [0, 5], [3, 8]); await expect.poll(() => state.found.has("FISH")).toBe(true);
  const board = page.getByRole("grid"); await board.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft"); for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space");
  await expect(page.locator("[data-selected]")).toHaveCount(1); // Space starts a keyboard selection…
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0); // …but never shows the tap-anchor marker
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect.poll(() => state.found.has("STAR")).toBe(true);
  await page.locator('[data-ws-row="4"][data-ws-col="0"]').click(); await page.locator('[data-ws-row="4"][data-ws-col="3"]').click(); await expect.poll(() => state.found.has("MOON")).toBe(true);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // still no auto-opens after 6 non-final finds

  // Definitions remain available on demand — open CAT explicitly from the word list.
  await page.getByRole("button", { name: "Words" }).click(); await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible(); await page.getByRole("button", { name: /CAT, found/ }).click();
  const catDefinition = page.getByRole("dialog", { name: "CAT definition" });
  await expect(catDefinition).toBeVisible();
  // The modal's spring entrance animation may still be settling right after this on-demand
  // open; poll rather than measuring once mid-transition.
  await expect.poll(async () => {
    const heights = await catDefinition.locator("button,a").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    return Math.min(...heights);
  }).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "How to play Word Trove" }).click(); await expect(page.getByRole("dialog", { name: "How to play Word Trove" })).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Hint/ }).click(); await expect.poll(state.hintConsumes).toBe(1);
});

test("catalog uses server reward authority, keeps modal outside More, restores progress, and has desktop panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await authenticate(page); const state = await installRoutes(page, 10, true); await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 }); await expect(page.locator(".word-search-desktop-list")).toBeVisible(); await expect(page.locator(".word-search-list-button")).toBeHidden();
  await page.getByRole("grid").focus(); await page.keyboard.press("w"); await expect(page.locator(".word-search-desktop-list")).toBeFocused(); await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0); await page.keyboard.press("Escape"); await expect(page.locator('.word-search-cell[data-active="true"]')).toBeFocused();
  await page.getByRole("button", { name: "More puzzle actions" }).click(); await page.getByRole("menuitem", { name: "Report Bug" }).click(); await expect(page.getByRole("dialog", { name: "Report a bug" })).toBeVisible(); await expect(page.getByRole("menu")).toHaveCount(0); await page.keyboard.press("Escape");

  // CAT is non-final (the fixture has 2 words) — it stays opt-in, not automatic.
  await dragWord(page, [0, 0], [0, 2]); await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  await page.getByRole("button", { name: /CAT, found/ }).click();
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible();
  await page.getByRole("dialog", { name: "CAT definition" }).getByRole("button", { name: /Keep Searching/ }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /CAT, found/ })).toBeVisible({ timeout: 15_000 });

  // DOG is the final word — it opens automatically, and Continue stays gated until dismissal.
  await dragWord(page, [1, 0], [1, 2]); await expect.poll(() => state.found.size).toBe(2); await expect.poll(state.attemptSuccess).toBe(0); await expect(page.getByRole("dialog", { name: "DOG definition" })).toBeVisible(); await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0); await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep Searching/ }).click(); await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // no queued CAT modal appears afterward
});

test("failed daily completion keeps the board and retry records completion once more", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); const state = await installRoutes(page, 10, true); state.failNextDaily(); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  // CAT is non-final and stays opt-in; DOG is the final word and opens automatically.
  await dragWord(page, [0, 0], [0, 2]); await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  await dragWord(page, [1, 0], [1, 2]);
  await expect(page.getByRole("dialog", { name: "DOG definition" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible(); await expect(page.getByRole("grid")).toBeVisible(); await expect.poll(state.dailyCompletions).toBe(1); await expect(page.getByText("Solved for today!")).toHaveCount(0); await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep Searching/ }).click(); await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible({ timeout: 15_000 }); await page.getByRole("button", { name: "Retry Completion" }).click();
  await expect.poll(state.dailyCompletions).toBe(2); await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 5_000 });
});

test("zoom and pan: selection geometry tracks the pointer during the drag, not only after release", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 }); await authenticate(page); const state = await installRoutes(page, 20); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Zoom in" }).click(); await page.getByRole("button", { name: "Zoom in" }).click();
  await page.locator(".word-search-board-viewport").evaluate((viewport) => { viewport.scrollLeft = 90; viewport.scrollTop = 170; viewport.dispatchEvent(new Event("scroll")); });

  // ZOOM occupies row 15, columns 10-13 (horizontal). Drive the drag manually (rather than the
  // atomic dragWord helper) so selection state can be inspected before release.
  const start = await cellBox(page, 15, 10);
  const end = await cellBox(page, 15, 13);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(end).x, cellCenter(end).y, { steps: 8 });

  // The intended cells must already be selected while the pointer is still down, under zoom
  // and after panning — not merely eventually true once the word is found post-release.
  await expect.poll(() => selectedCellCount(page)).toBe(4);
  for (const col of [10, 11, 12, 13]) {
    await expect(page.locator(`[data-ws-row="15"][data-ws-col="${col}"][data-selected]`)).toHaveCount(1);
  }
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0); // a real drag never shows the tap-anchor marker

  // Trail geometry stays finite and aligned (one point per selected cell) under the active
  // zoom/pan transform.
  const trailPoints = await page.locator(".word-search-trail polyline").getAttribute("points");
  expect(trailPoints).toBeTruthy();
  const coords = trailPoints!.trim().split(/\s+/).filter(Boolean).map((pair) => pair.split(",").map(Number));
  expect(coords).toHaveLength(4);
  for (const [x, y] of coords) { expect(Number.isFinite(x)).toBe(true); expect(Number.isFinite(y)).toBe(true); }

  await page.mouse.up();
  await expect.poll(() => state.found.has("ZOOM")).toBe(true);
  await expect(page.locator("[data-selected]")).toHaveCount(0); // selection clears after release
  // ZOOM is the first word found here (1 of 13), so it is non-final and stays opt-in.
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);

  // It remains available on demand from the word list.
  await page.getByRole("button", { name: "Words" }).click();
  await page.getByRole("button", { name: /ZOOM, found/ }).click();
  await expect(page.getByRole("dialog", { name: "ZOOM definition" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("catalog, daily days, and consecutive Warz rounds remain isolated for the same puzzle id", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 850 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);

  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);

  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("puzzle-header-progress")).toContainText("0/2");
  await dragWord(page, [0, 0], [0, 2]);
  state.setDailyDay(143);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("puzzle-header-progress")).toContainText("0/2");

  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.getByTestId("word-search-root")).toBeVisible();
  await expect(page.locator(".word-search-progress-strip")).toContainText("0 / 2 found");
  await dragWord(page, [0, 0], [0, 2]);
  await expect(page.locator(".word-search-progress-strip")).toContainText("1 / 2 found");

  await page.goto("/coming-soon", { waitUntil: "domcontentloaded" });
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click({ timeout: 20_000 });
  await expect(page.locator(".word-search-progress-strip")).toContainText("0 / 2 found");
});

// A competitive Warz round must never be interrupted by the word-definition modal (it fully
// covers the board and blocks the next selection, costing real time in a timed match). This
// exercises both a mid-match (non-final) find and the final find, waiting past the normal
// definition-reveal delay each time so a regression that merely delays the modal (rather than
// never queueing it) would still be caught.
test("Warz: finding words never opens a definition modal, mid-match or on the final word", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 10, true);
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.getByTestId("word-search-root")).toBeVisible();
  await expect(page.locator(".word-search-progress-strip")).toContainText("0 / 2 found");

  // Non-final word (CAT) — found via two-tap selection, proving the anchor affordance and Warz
  // timing/transitions both work through that pathway, not just drag.
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click();
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(1);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"]')).toHaveAttribute("data-tap-anchor", "true");
  await page.locator('[data-ws-row="0"][data-ws-col="2"]').click();
  await expect(page.locator(".word-search-progress-strip")).toContainText("1 / 2 found");
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0); // anchor clears after the two-tap submission
  await page.waitForTimeout(700); // past the normal (320ms) and final-word (520ms) reveal delay
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);

  // The board must remain immediately interactive — prove it by finding the final word next.
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByTestId("word-search-root")).toHaveAttribute("data-status", "playing");

  // Final word (DOG) — the normal Warz result transition must occur, with no modal over it.
  await dragWord(page, [1, 0], [1, 2]);
  await expect(page.getByText("Posting your challenge…")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Challenge Posted!" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

// ── Pointer-gesture regression coverage (Pass 2: hardening only — no mechanics changed) ────

test("rapid drag: many fast pointer moves still find the word exactly once with no stale selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const start = await cellBox(page, 0, 0);
  const end = await cellBox(page, 0, 2);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  // A high step count over a short 2-cell gap fires many pointermove events well within a
  // single animation-frame window, exercising the rAF-batched onPointerMove path directly.
  await page.mouse.move(cellCenter(end).x, cellCenter(end).y, { steps: 40 });
  await page.mouse.up();

  await expect.poll(() => state.found.has("CAT")).toBe(true);
  expect(state.found.size).toBe(1);
  expect(state.submissions.filter((word) => word === "CAT")).toHaveLength(1); // no duplicate submission
  await expect(page.locator("[data-selected]")).toHaveCount(0); // selection clears after release
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // non-final CAT stays opt-in

  // The board accepts another gesture immediately afterward — no dismissal step required.
  await dragWord(page, [1, 0], [1, 2]);
  await expect.poll(() => state.found.has("DOG")).toBe(true);
});

test("imprecise diagonal: a slightly off-center FISH drag still resolves the correct diagonal word", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  // FISH runs diagonally from (0,5) to (3,8). Offset every point a few pixels off the exact
  // cell center — comfortably inside the component's own nearest-cell tolerance — without
  // touching that tolerance value in production.
  const jitter = { dx: 5, dy: -4 };
  const start = cellCenter(await cellBox(page, 0, 5), jitter);
  const mid = cellCenter(await cellBox(page, 2, 7), jitter);
  const end = cellCenter(await cellBox(page, 3, 8), jitter);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(mid.x, mid.y, { steps: 6 });
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => state.found.has("FISH")).toBe(true);
  expect(state.submissions).toEqual(["FISH"]); // exactly one submission, and no neighboring word
  expect(state.found.size).toBe(1);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // non-final FISH stays opt-in

  // FISH remains available on demand from the word list.
  await page.getByRole("button", { name: "Words" }).click();
  await page.getByRole("button", { name: /FISH, found/ }).click();
  await expect(page.getByRole("dialog", { name: "FISH definition" })).toBeVisible();
});

test("pointer cancel: cancelling an in-flight drag clears the selection and the stale pointer cannot complete it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await installPointerIdCapture(page);

  const start = await cellBox(page, 0, 0);
  const mid = await cellBox(page, 0, 1);
  const end = await cellBox(page, 0, 2);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(mid).x, cellCenter(mid).y, { steps: 4 });
  await expect.poll(() => selectedCellCount(page)).toBeGreaterThan(1); // a real multi-cell selection is live

  const pointerId = await lastCapturedPointerId(page);
  await dispatchBoardPointerEvent(page, "pointercancel", pointerId, cellCenter(mid));
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0); // pointercancel clears any tap-anchor too

  // A stray pointerup on the now-cancelled pointer must not resurrect or complete the selection.
  await dispatchBoardPointerEvent(page, "pointerup", pointerId, cellCenter(end));
  expect(state.found.has("CAT")).toBe(false);
  expect(state.submissions).toHaveLength(0);
  await expect(page.locator("[data-selected]")).toHaveCount(0);

  await page.mouse.up(); // release the real OS-level button state before starting a fresh gesture
  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
});

test("second pointer: a new pointer mid-drag cancels the gesture and neither pointer can submit it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await installPointerIdCapture(page);

  const start = await cellBox(page, 0, 0);
  const mid = await cellBox(page, 0, 1);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(mid).x, cellCenter(mid).y, { steps: 4 });
  await expect.poll(() => selectedCellCount(page)).toBeGreaterThan(1);

  const firstPointerId = await lastCapturedPointerId(page);
  const secondPointerId = firstPointerId + 1000; // distinct on purpose; never assumed to be 1
  await dispatchBoardPointerEvent(page, "pointerdown", secondPointerId, cellCenter(mid), "touch");
  await expect(page.locator("[data-selected]")).toHaveCount(0); // the interruption cancels immediately
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0); // and clears any tap-anchor with it

  // Releasing the ORIGINAL pointer afterward must not resurrect or submit the cancelled selection.
  await page.mouse.up();
  expect(state.found.has("CAT")).toBe(false);
  expect(state.submissions).toHaveLength(0);
  await expect(page.locator("[data-selected]")).toHaveCount(0);

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
});

test("off-board release: releasing far outside the board does not submit a stale valid CAT selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  // Drag across the COMPLETE, valid CAT selection first — this is the exact stale state a
  // careless off-board release must not be allowed to submit.
  const start = await cellBox(page, 0, 0);
  const end = await cellBox(page, 0, 2);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(end).x, cellCenter(end).y, { steps: 8 });

  // Confirm the full, valid CAT selection is live before anything else happens.
  await expect.poll(() => selectedCellCount(page)).toBe(3);
  for (const col of [0, 1, 2]) {
    await expect(page.locator(`[data-ws-row="0"][data-ws-col="${col}"][data-selected]`)).toHaveCount(1);
  }
  expect(state.submissions).toHaveLength(0);

  // Continue moving ~400px beyond the board's bottom-right corner, then release there — well
  // outside the board and outside the 24px nearest-cell tolerance. This jumps directly to the
  // far point in a single move (no intermediate steps): interpolating through several steps
  // would cross back over further on-board cells first and re-extend the selection into a new
  // (non-CAT) line before ever going off-board, masking the exact stale-selection state this
  // test exists to catch.
  const board = await page.locator(".word-search-board").boundingBox();
  expect(board).not.toBeNull();
  const farAway = { x: board!.x + board!.width + 400, y: board!.y + board!.height + 400 };
  await page.mouse.move(farAway.x, farAway.y, { steps: 1 });
  await expect.poll(() => selectedCellCount(page)).toBe(3); // still the stale, untouched CAT selection
  await page.mouse.up();
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0); // off-board release clears any tap-anchor too

  // submitSelection (if wrongly invoked) is async — give the round-trip a moment to land before
  // asserting its absence; there's no positive DOM signal to poll for a negative outcome here.
  await page.waitForTimeout(300);

  // The stale, otherwise-complete CAT selection must be cancelled, not submitted.
  expect(state.found.has("CAT")).toBe(false);
  expect(state.submissions).toHaveLength(0);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);

  // A fresh, ordinary CAT drag afterward still works exactly once.
  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  expect(state.submissions.filter((word) => word === "CAT")).toHaveLength(1);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // non-final CAT stays opt-in

  // Still available on demand.
  await page.getByRole("button", { name: "Words" }).click();
  await page.getByRole("button", { name: /CAT, found/ }).click();
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible();
});

test("two-tap cancellation: a repeated tap on the same cell cancels the anchor without a stale reuse", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  const tap = (row: number, col: number) => page.locator(`[data-ws-row="${row}"][data-ws-col="${col}"]`).click();
  const cell = (row: number, col: number) => page.locator(`[data-ws-row="${row}"][data-ws-col="${col}"]`);

  // ── First tap: a distinct, announced tap-anchor, not an ordinary one-cell drag selection. ──
  await tap(0, 0);
  await expect(page.locator("[data-selected]")).toHaveCount(1);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(1);
  const anchor = cell(0, 0);
  await expect(anchor).toHaveAttribute("data-selected", "true");
  await expect(anchor).toHaveAttribute("data-tap-anchor", "true");
  await expect(anchor).toHaveAttribute("aria-selected", "true");
  const anchorLabel = await anchor.getAttribute("aria-label");
  expect(anchorLabel).toContain("start selected");
  expect(anchorLabel).toContain("tap another letter");
  expect(state.submissions).toHaveLength(0); // no network request from a lone first tap

  // The visual treatment is present: a dashed/distinct outer outline plus a non-empty, sized
  // corner marker — not merely the generic selected-cell background.
  const anchorStyle = await anchor.evaluate((element) => {
    const computed = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: parseFloat(computed.outlineWidth),
      beforeContent: before.content,
      beforeWidth: parseFloat(before.width),
      beforeHeight: parseFloat(before.height),
    };
  });
  expect(anchorStyle.outlineStyle).toBe("dashed");
  expect(anchorStyle.outlineWidth).toBeGreaterThan(0);
  expect(anchorStyle.beforeContent).not.toBe("none");
  expect(anchorStyle.beforeWidth).toBeGreaterThan(0);
  expect(anchorStyle.beforeHeight).toBeGreaterThan(0);

  // ── Same-cell cancellation ──
  await tap(0, 0); // second tap on the same anchor cell cancels it
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);
  expect(state.found.has("CAT")).toBe(false);
  expect(state.submissions).toHaveLength(0); // no network submission from the cancellation itself

  // ── Fresh anchor: a different cell afterward starts a brand-new anchor, and the cancelled
  // (0,0) anchor never returns — if it were still live, tapping (0,2) next would complete CAT's
  // exact cells and submit it. ──
  await tap(0, 4);
  await expect(page.locator("[data-selected]")).toHaveCount(1);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(1);
  await expect(cell(0, 4)).toHaveAttribute("data-tap-anchor", "true");
  await expect(cell(0, 0)).not.toHaveAttribute("data-tap-anchor", "true");

  // Completing this as an invalid two-tap selection (0,4)→(0,2) is not a placed word) must clear
  // the anchor without finding anything or leaving a stale marker.
  await tap(0, 2);
  expect(state.found.has("CAT")).toBe(false);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);
  await expect(page.locator("[data-selected]")).toHaveCount(0);

  // ── A fresh, correct two-tap CAT selection submits exactly once and leaves no stale anchor. ──
  await tap(0, 0);
  await tap(0, 2);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  expect(state.submissions.filter((word) => word === "CAT")).toHaveLength(1);
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);
});

test("keyboard selection clears a stale pointer tap-anchor: Space after a tap replaces it with keyboard selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  // A pointer tap leaves a live anchor at (0,0).
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click();
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(1);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"]')).toHaveAttribute("data-tap-anchor", "true");
  await expect(page.locator("[data-selected]")).toHaveCount(1);

  // Starting keyboard selection must supersede that stale anchor, not layer on top of it.
  const board = page.getByRole("grid");
  await board.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);
  await expect(page.locator("[data-selected]")).toHaveCount(1);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"][data-selected]')).toHaveCount(1);

  // Keyboard selection still extends normally, and no anchor marker resurfaces while doing so.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-selected]")).toHaveCount(2);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);
  expect(state.submissions).toHaveLength(0);
});

test("found cell tap-anchor: a found cell can become a new anchor and its label announces both states", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  expect(state.submissions.filter((word) => word === "CAT")).toHaveLength(1);
  // CAT is non-final in this fixture — Pass 3 keeps non-final finds opt-in, no auto modal.
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);

  const anchor = page.locator('[data-ws-row="0"][data-ws-col="0"]');
  await expect(anchor).toHaveAttribute("data-found", "true");

  await anchor.click();
  await expect(anchor).toHaveAttribute("data-found", "true");
  await expect(anchor).toHaveAttribute("data-tap-anchor", "true");
  await expect(anchor).toHaveAttribute("data-selected", "true");
  await expect(anchor).toHaveAttribute("aria-selected", "true");
  const label = await anchor.getAttribute("aria-label");
  expect(label).toContain("found word");
  expect(label).toContain("start selected");
  expect(label).toContain("tap another letter to finish");

  const submissionsBeforeCancel = state.submissions.length;
  await anchor.click(); // same-cell cancellation
  await expect(anchor).not.toHaveAttribute("data-tap-anchor", "true");
  await expect(anchor).not.toHaveAttribute("data-selected", "true");
  await expect(anchor).toHaveAttribute("data-found", "true"); // found state survives the cancellation
  expect(state.submissions).toHaveLength(submissionsBeforeCancel); // no network call from cancellation
});

test("legacy catalog mismatch repairs in place without generic attempt_success", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 850 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);
  state.seedLegacyRepair();
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: "Retry Completion" }).click();
  await expect.poll(state.reconciliations).toBe(1);
  await expect.poll(state.attemptSuccess).toBe(0);
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});
