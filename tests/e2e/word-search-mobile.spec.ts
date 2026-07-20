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
  await dragWord(page, [0, 0], [0, 2]); await expect.poll(() => state.found.has("CAT")).toBe(true);
  const catDefinition = page.getByRole("dialog", { name: "CAT definition" });
  const definitionTargets = await catDefinition.locator("button,a").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  definitionTargets.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));
  await catDefinition.getByRole("button", { name: /Keep Searching/ }).click();
  await dragWord(page, [1, 0], [1, 2]); await expect.poll(() => state.found.has("DOG")).toBe(true);
  await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep Searching/ }).click();
  await dragWord(page, [0, 14], [3, 14]); await expect.poll(() => state.found.has("BIRD")).toBe(true);
  await page.getByRole("dialog", { name: "BIRD definition" }).getByRole("button", { name: /Keep Searching/ }).click();
  await dragWord(page, [0, 5], [3, 8]); await expect.poll(() => state.found.has("FISH")).toBe(true);
  await page.getByRole("dialog", { name: "FISH definition" }).getByRole("button", { name: /Keep Searching/ }).click();
  const board = page.getByRole("grid"); await board.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft"); for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space"); for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect.poll(() => state.found.has("STAR")).toBe(true); await page.getByRole("dialog", { name: "STAR definition" }).getByRole("button", { name: /Keep Searching/ }).click();
  await page.locator('[data-ws-row="4"][data-ws-col="0"]').click(); await page.locator('[data-ws-row="4"][data-ws-col="3"]').click(); await expect.poll(() => state.found.has("MOON")).toBe(true); await page.getByRole("dialog", { name: "MOON definition" }).getByRole("button", { name: /Keep Searching/ }).click();
  await page.getByRole("button", { name: "Words" }).click(); await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible(); await page.getByRole("button", { name: /CAT, found/ }).click();
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "How to play Word Trove" }).click(); await expect(page.getByRole("dialog", { name: "How to play Word Trove" })).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Hint/ }).click(); await expect.poll(state.hintConsumes).toBe(1);
});

test("catalog uses server reward authority, keeps modal outside More, restores progress, and has desktop panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await authenticate(page); const state = await installRoutes(page, 10, true); await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 }); await expect(page.locator(".word-search-desktop-list")).toBeVisible(); await expect(page.locator(".word-search-list-button")).toBeHidden();
  await page.getByRole("grid").focus(); await page.keyboard.press("w"); await expect(page.locator(".word-search-desktop-list")).toBeFocused(); await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0); await page.keyboard.press("Escape"); await expect(page.locator('.word-search-cell[data-active="true"]')).toBeFocused();
  await page.getByRole("button", { name: "More puzzle actions" }).click(); await page.getByRole("menuitem", { name: "Report Bug" }).click(); await expect(page.getByRole("dialog", { name: "Report a bug" })).toBeVisible(); await expect(page.getByRole("menu")).toHaveCount(0); await page.keyboard.press("Escape");
  await dragWord(page, [0, 0], [0, 2]); await page.getByRole("dialog", { name: "CAT definition" }).getByRole("button", { name: /Keep Searching/ }).click(); await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /CAT, found/ })).toBeVisible({ timeout: 15_000 });
  await dragWord(page, [1, 0], [1, 2]); await expect.poll(() => state.found.size).toBe(2); await expect.poll(state.attemptSuccess).toBe(0); await expect(page.getByRole("dialog", { name: "DOG definition" })).toBeVisible(); await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0); await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep Searching/ }).click(); await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("failed daily completion keeps the board and retry records completion once more", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); const state = await installRoutes(page, 10, true); state.failNextDaily(); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await dragWord(page, [0, 0], [0, 2]); await page.getByRole("dialog", { name: "CAT definition" }).getByRole("button", { name: /Keep Searching/ }).click(); await dragWord(page, [1, 0], [1, 2]);
  await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible(); await expect(page.getByRole("grid")).toBeVisible(); await expect.poll(state.dailyCompletions).toBe(1); await expect(page.getByText("Solved for today!")).toHaveCount(0); await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep Searching/ }).click(); await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible({ timeout: 15_000 }); await page.getByRole("button", { name: "Retry Completion" }).click();
  await expect.poll(state.dailyCompletions).toBe(2); await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 5_000 });
});

test("20x20 board keeps selection geometry after zooming and panning", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 }); await authenticate(page); const state = await installRoutes(page, 20); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Zoom in" }).click(); await page.getByRole("button", { name: "Zoom in" }).click();
  await page.locator(".word-search-board-viewport").evaluate((viewport) => { viewport.scrollLeft = 90; viewport.scrollTop = 170; viewport.dispatchEvent(new Event("scroll")); });
  await dragWord(page, [15, 10], [15, 13]);
  await expect.poll(() => state.found.has("ZOOM")).toBe(true);
  await expect(page.getByRole("dialog", { name: "ZOOM definition" })).toBeVisible();
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

  // Non-final word (CAT).
  await dragWord(page, [0, 0], [0, 2]);
  await expect(page.locator(".word-search-progress-strip")).toContainText("1 / 2 found");
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
