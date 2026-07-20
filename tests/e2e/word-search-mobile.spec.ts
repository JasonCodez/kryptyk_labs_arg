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

// Deterministic three-word fixture for the rapid-Warz replacement regression: CAT and DOG are
// non-final, SUN is the final (third) word, each on its own row so drags never collide.
function catDogSunFixture(size = 6) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => "X"));
  const placements: Array<[string, number, number, number, number]> = [
    ["CAT", 0, 0, 0, 1],
    ["DOG", 1, 0, 0, 1],
    ["SUN", 2, 0, 0, 1],
  ];
  placements.forEach(([word, row, col, dr, dc]) => word.split("").forEach((letter, index) => { grid[row + dr * index][col + dc * index] = letter; }));
  return { grid, words: placements.map(([word]) => word) };
}

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({ secret, maxAge: 3600, token: { sub: "e2e-user", id: "e2e-user", name: "Word Trove Tester", email: "trove@example.test", role: "user", betaApproved: true } });
  await page.context().addCookies([{ name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  await page.addInitScript(() => localStorage.setItem("wordTroveIntroSeen", "1"));
}

async function installRoutes(page: Page, size: number, short = false, customFixture?: { grid: string[][]; words: string[] }) {
  const data = customFixture ?? fixture(size, short);
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
  const dictionaryRequests: string[] = [];
  let dictionaryOverride: Partial<{ found: boolean; partOfSpeech: string | null; definition: string; example: string | null; audioUrl: string | null; phonetic: string | null }> | null = null;
  let dictionaryGate: Promise<void> | null = null;
  let releaseDictionaryGate: (() => void) | null = null;
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
    if (path === "/api/dictionary/define") {
      const word = url.searchParams.get("word") ?? "";
      dictionaryRequests.push(word);
      if (dictionaryGate) await dictionaryGate;
      if (dictionaryOverride?.found === false) return fulfill({ found: false });
      return fulfill({
        found: true,
        partOfSpeech: dictionaryOverride?.partOfSpeech ?? "noun",
        definition: dictionaryOverride?.definition ?? `Definition of ${word}`,
        example: dictionaryOverride?.example ?? null,
        audioUrl: dictionaryOverride?.audioUrl ?? null,
        phonetic: dictionaryOverride?.phonetic ?? null,
      });
    }
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
    dictionaryRequests,
    setDictionaryResponse: (override: typeof dictionaryOverride) => { dictionaryOverride = override; },
    holdDictionaryResponse: () => { dictionaryGate = new Promise((resolve) => { releaseDictionaryGate = resolve; }); },
    releaseDictionaryResponse: () => { releaseDictionaryGate?.(); dictionaryGate = null; releaseDictionaryGate = null; },
    failNextDaily: () => { failDailyOnce = true; },
    setDailyDay: (day: number) => { dailyDayNumber = day; },
    seedLegacyRepair: () => { data.words.forEach((word) => found.add(word)); repairRequired = true; catalogSolved = false; },
    seedAlreadySolved: () => { data.words.forEach((word) => found.add(word)); repairRequired = false; catalogSolved = true; },
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

// Verifies a Pass 9 endpoint halo (hollow ring behind the tile) visibly extends past every edge
// of its endpoint cell, is stroked (not fill-based), non-scaling, and stays board-contained.
async function expectEndpointHalo(page: Page, markerSelector: string, cellRow: number, cellCol: number, tolerance = 1) {
  const marker = page.locator(markerSelector);
  await expect(marker).toHaveCount(1);
  const markerBox = await marker.boundingBox();
  const cellBoxValue = await cellBox(page, cellRow, cellCol);
  expect(markerBox).not.toBeNull();
  const box = markerBox!;

  expect(Number.isFinite(box.width)).toBe(true);
  expect(Number.isFinite(box.height)).toBe(true);
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);

  // The halo is a ring around the tile, so it must extend past all four of the tile's edges.
  expect(box.x).toBeLessThan(cellBoxValue.x - tolerance);
  expect(box.x + box.width).toBeGreaterThan(cellBoxValue.x + cellBoxValue.width + tolerance);
  expect(box.y).toBeLessThan(cellBoxValue.y - tolerance);
  expect(box.y + box.height).toBeGreaterThan(cellBoxValue.y + cellBoxValue.height + tolerance);

  const style = await marker.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { stroke: computed.stroke, fill: computed.fill, vectorEffect: element.getAttribute("vector-effect") };
  });
  expect(style.stroke).not.toBe("none");
  expect(style.fill === "none" || style.fill === "transparent" || style.fill === "rgba(0, 0, 0, 0)").toBe(true);
  expect(style.vectorEffect).toBe("non-scaling-stroke");

  const boardBox = await page.locator(".word-search-board").boundingBox();
  expect(boardBox).not.toBeNull();
  // The halo may extend slightly past the outermost tile perimeter but must remain within a
  // small margin of the board — it should never balloon past the board's own bounds.
  const margin = Math.max(cellBoxValue.width, cellBoxValue.height);
  expect(box.x).toBeGreaterThanOrEqual(boardBox!.x - margin);
  expect(box.y).toBeGreaterThanOrEqual(boardBox!.y - margin);
  expect(box.x + box.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width + margin);
  expect(box.y + box.height).toBeLessThanOrEqual(boardBox!.y + boardBox!.height + margin);

  return box;
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

test("Pass 9: endpoint halos remain visible outside a ~12px minimum tile at 320x710 without obscuring letters", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 710 });
  await authenticate(page);
  await installRoutes(page, 24); // large enough to force the board's 12px minimum cell floor
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const cellPx = await page.locator(".word-search-board").evaluate((element) => parseFloat(getComputedStyle(element).getPropertyValue("--word-search-cell")));
  expect(cellPx).toBeLessThanOrEqual(13); // confirms the minimum-cell floor is actually in effect

  const start = await cellBox(page, 0, 0);
  const end = await cellBox(page, 0, 2);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(end).x, cellCenter(end).y, { steps: 6 });
  await expect.poll(() => selectedCellCount(page)).toBe(3);

  const startBox = await expectEndpointHalo(page, ".word-search-trail-start", 0, 0);
  const endBox = await expectEndpointHalo(page, ".word-search-trail-end", 0, 2);
  // Rings stay restrained rather than ballooning: at most roughly double the tiny tile size.
  expect(startBox.width).toBeLessThanOrEqual(cellPx * 2.5);
  expect(endBox.width).toBeLessThanOrEqual(cellPx * 2.5);

  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"]')).toHaveText("C");
  await expect(page.locator('[data-ws-row="0"][data-ws-col="1"]')).toHaveText("A");
  await expect(page.locator('[data-ws-row="0"][data-ws-col="2"]')).toHaveText("T");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  await page.mouse.up();
});

test("drag, reverse, vertical, diagonal, keyboard, word list, definition, help, and hint work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); const state = await installRoutes(page, 15); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  // Pass 5: the idle dock shows only the simplified prompt, with the obsolete label gone, and
  // stays within the viewport.
  await expect(page.getByText("Drag or tap to select")).toBeVisible();
  await expect(page.getByText("CURRENT SELECTION")).toHaveCount(0);
  const dockBox = await page.locator(".word-search-progress-strip").boundingBox();
  expect(dockBox).not.toBeNull();
  expect(dockBox!.x).toBeGreaterThanOrEqual(0);
  expect(dockBox!.x + dockBox!.width).toBeLessThanOrEqual(390 + 1);

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

  // Pass 6: the board remains the primary visual surface — visibly wider than the desktop word
  // panel, with a real depth treatment (not a flat, borderless rectangle).
  const boardBoxDesktop = await page.locator(".word-search-board").boundingBox();
  const listBoxDesktop = await page.locator(".word-search-desktop-list").boundingBox();
  expect(boardBoxDesktop).not.toBeNull(); expect(listBoxDesktop).not.toBeNull();
  expect(boardBoxDesktop!.width).toBeGreaterThan(listBoxDesktop!.width);
  const boardShadowDesktop = await page.locator(".word-search-board").evaluate((element) => getComputedStyle(element).boxShadow);
  expect(boardShadowDesktop).not.toBe("none");

  await page.getByRole("grid").focus(); await page.keyboard.press("w"); await expect(page.locator(".word-search-desktop-list")).toBeFocused(); await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0); await page.keyboard.press("Escape"); await expect(page.locator('.word-search-cell[data-active="true"]')).toBeFocused();
  // Focus-visible remains clear on the active cell (a solid, non-dashed outline).
  const focusOutline = await page.locator('.word-search-cell[data-active="true"]').evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusOutline).toBe("solid");

  // No layout shift while a selection is active — the board keeps the same position/size.
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click();
  const boardBoxDuringSelection = await page.locator(".word-search-board").boundingBox();
  expect(boardBoxDuringSelection).not.toBeNull();
  expect(Math.abs(boardBoxDuringSelection!.width - boardBoxDesktop!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(boardBoxDuringSelection!.height - boardBoxDesktop!.height)).toBeLessThanOrEqual(1);
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click(); // cancel the anchor before continuing
  await page.getByRole("button", { name: "More puzzle actions" }).click(); await page.getByRole("menuitem", { name: "Report Bug" }).click(); await expect(page.getByRole("dialog", { name: "Report a bug" })).toBeVisible(); await expect(page.getByRole("menu")).toHaveCount(0); await page.keyboard.press("Escape");

  // CAT is non-final (the fixture has 2 words) — it stays opt-in, not automatic.
  await dragWord(page, [0, 0], [0, 2]); await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  await page.getByRole("button", { name: /CAT, found/ }).click();
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible();
  await page.getByRole("dialog", { name: "CAT definition" }).getByRole("button", { name: /Keep searching/i }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /CAT, found/ })).toBeVisible({ timeout: 15_000 });

  // DOG is the final word — it opens automatically, and Continue stays gated until dismissal.
  await dragWord(page, [1, 0], [1, 2]); await expect.poll(() => state.found.size).toBe(2); await expect.poll(state.attemptSuccess).toBe(0); await expect(page.getByRole("dialog", { name: "DOG definition" })).toBeVisible(); await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0); await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep searching/i }).click(); await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // no queued CAT modal appears afterward

  // Pass 5: the parent reward flow (the "Continue" step above) is the only fresh-completion
  // presentation — no duplicate internal emoji success banner appears behind or after it.
  await expect(page.locator(".word-search-success")).toHaveCount(0);
  await expect(page.getByText(/All 2 words found/)).toHaveCount(0);
});

test("Pass 5: reopening an already-completed Catalog puzzle shows a clean completed state, not a fresh reward modal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);
  state.seedAlreadySolved();
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });

  // A clean, non-emoji completed state is visible — the app-shell is not left blank.
  await expect(page.getByText("Word Trove completed")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByText(/All 2 words found/)).toHaveCount(0);

  // No fresh reward modal launches from merely reopening an already-solved puzzle.
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  expect(state.attemptSuccess()).toBe(0);
});

test("failed daily completion keeps the board and retry records completion once more", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await authenticate(page); const state = await installRoutes(page, 10, true); state.failNextDaily(); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  // CAT is non-final and stays opt-in; DOG is the final word and opens automatically.
  await dragWord(page, [0, 0], [0, 2]); await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  await dragWord(page, [1, 0], [1, 2]);
  await expect(page.getByRole("dialog", { name: "DOG definition" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible(); await expect(page.getByRole("grid")).toBeVisible(); await expect.poll(state.dailyCompletions).toBe(1); await expect(page.getByText("Solved for today!")).toHaveCount(0); await page.getByRole("dialog", { name: "DOG definition" }).getByRole("button", { name: /Keep searching/i }).click(); await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByRole("button", { name: "Retry Completion" })).toBeVisible({ timeout: 15_000 }); await page.getByRole("button", { name: "Retry Completion" }).click();
  await expect.poll(state.dailyCompletions).toBe(2); await expect(page.getByText("Solved for today!")).toBeVisible({ timeout: 5_000 });
});

test("zoom and pan: selection geometry tracks the pointer during the drag under 2x zoom, with endpoint halos still visible and restrained", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 }); await authenticate(page); const state = await installRoutes(page, 20); await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  // Four .25 steps take zoom from 1x to the full 2x cap.
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator(".word-search-board-viewport")).toHaveAttribute("data-zoomed", "true");
  // At the full 2x cap the earlier 1.5x-tuned scroll offset can leave the target row out of
  // view; scroll the target cell itself into the viewport instead of a fixed pixel offset.
  await page.locator('[data-ws-row="15"][data-ws-col="10"]').evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));

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
  const trailPoints = await page.locator(".word-search-trail-core").getAttribute("points");
  expect(trailPoints).toBeTruthy();
  const coords = trailPoints!.trim().split(/\s+/).filter(Boolean).map((pair) => pair.split(",").map(Number));
  expect(coords).toHaveLength(4);
  for (const [x, y] of coords) { expect(Number.isFinite(x)).toBe(true); expect(Number.isFinite(y)).toBe(true); }

  // Endpoint halos still extend outside the (now visually magnified) endpoint tiles at 2x zoom,
  // and — thanks to non-scaling-stroke — the ring's stroke thickness does not visually double.
  await expectEndpointHalo(page, ".word-search-trail-start", 15, 10);
  await expectEndpointHalo(page, ".word-search-trail-end", 15, 13);

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
  const state = await installRoutes(page, 10, true);
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.getByTestId("word-search-root")).toBeVisible();
  await expect(page.locator(".word-search-progress-strip")).toContainText("0 / 2 found");

  // Pass 6: the polished board/tile treatment applies in Warz too, and everything still fits.
  const boardBox = await page.locator(".word-search-board").boundingBox();
  expect(boardBox).not.toBeNull();
  const idleStyle = await page.locator('[data-ws-row="5"][data-ws-col="5"]').evaluate((element) => getComputedStyle(element).boxShadow);
  expect(idleStyle).not.toBe("none");
  {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  }

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
  expect(state.dictionaryRequests).toHaveLength(0);

  // Manually opening the word list and tapping the found CAT must never expose a working
  // definition path — Warz stays completely definition-free, not just automatically.
  const submissionsBeforeList = state.submissions.length;
  await page.getByRole("button", { name: "Words" }).click();
  const sheet = page.getByRole("dialog", { name: "Words to find" });
  await expect(sheet).toBeVisible();
  const cat = sheet.getByRole("button", { name: "CAT, found" });
  await expect(cat).toBeVisible();
  await expect(cat).toHaveAttribute("data-found", "true"); // still visibly completed
  await expect(cat.locator("svg")).toHaveCount(1); // completion check only — no chevron
  const catLabel = await cat.getAttribute("aria-label");
  expect(catLabel).not.toContain("open definition");
  await expect(cat.locator(".word-search-word-item-definition-label")).toHaveCount(0);
  await expect(cat.locator(".word-search-word-item-chevron")).toHaveCount(0);
  await expect(cat).toBeDisabled();

  const dog = sheet.getByRole("button", { name: "DOG, not found" });
  await expect(dog).toBeDisabled();

  // A click on a native-disabled button cannot dispatch — confirms no dictionary call, no modal.
  await cat.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  expect(state.dictionaryRequests).toHaveLength(0);

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("grid")).toBeVisible();
  expect(state.submissions.length).toBe(submissionsBeforeList); // opening/closing the list submitted nothing

  // The board must remain immediately interactive — prove it by finding the final word next.
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByTestId("word-search-root")).toHaveAttribute("data-status", "playing");

  // Final word (DOG) — the normal Warz result transition must occur, with no modal over it, and
  // no internal Word Search success banner behind that transition.
  await dragWord(page, [1, 0], [1, 2]);
  await expect(page.getByText("Posting your challenge…")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Challenge Posted!" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  await expect(page.locator(".word-search-success")).toHaveCount(0);
  expect(state.dictionaryRequests).toHaveLength(0);

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

  // ── Pass 5: the dock's idle prompt, captured before any selection starts, for later
  // layout-stability comparison. ──
  await expect(page.getByText("Drag or tap to select")).toBeVisible();
  const dockStrip = page.locator(".word-search-progress-strip");
  const idleDockBox = await dockStrip.boundingBox();
  expect(idleDockBox).not.toBeNull();

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

  // Pass 5: the dock now shows the selected letter in place of the idle prompt, with the
  // active-selection state present and no layout shift disturbing cached board geometry. The
  // "current selection" wording is exposed only via aria-label, never in the visible text.
  await expect(page.locator(".word-search-selected-text")).toHaveText("C");
  await expect(page.locator(".word-search-selected-text")).toHaveAttribute("aria-label", "Current selection: C");
  await expect(page.getByText("Drag or tap to select")).toHaveCount(0);
  await expect(page.getByText("CURRENT SELECTION")).toHaveCount(0);
  await expect(dockStrip).toHaveAttribute("data-selection-active", "true");
  const activeDockBox = await dockStrip.boundingBox();
  expect(activeDockBox).not.toBeNull();
  expect(Math.abs(activeDockBox!.height - idleDockBox!.height)).toBeLessThanOrEqual(1);

  // ── Same-cell cancellation ──
  await tap(0, 0); // second tap on the same anchor cell cancels it
  await expect(page.locator("[data-selected]")).toHaveCount(0);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);
  expect(state.found.has("CAT")).toBe(false);
  expect(state.submissions).toHaveLength(0); // no network submission from the cancellation itself

  // The idle prompt returns, and the dock stays the same measured height.
  await expect(page.getByText("Drag or tap to select")).toBeVisible();
  await expect(dockStrip).not.toHaveAttribute("data-selection-active", "true");
  const idleAgainDockBox = await dockStrip.boundingBox();
  expect(idleAgainDockBox).not.toBeNull();
  expect(Math.abs(idleAgainDockBox!.height - idleDockBox!.height)).toBeLessThanOrEqual(1);

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

  // Pass 6: the found color, the dashed anchor ring, and the corner diamond all remain
  // simultaneously visible — the anchor state must not blank out the found styling.
  const anchorStyle = await anchor.evaluate((element) => {
    const computed = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    return {
      background: computed.backgroundColor,
      outlineStyle: computed.outlineStyle,
      beforeContent: before.content,
      beforeWidth: parseFloat(before.width),
    };
  });
  expect(anchorStyle.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(anchorStyle.outlineStyle).toBe("dashed");
  expect(anchorStyle.beforeContent).not.toBe("none");
  expect(anchorStyle.beforeWidth).toBeGreaterThan(0);
  await expect(anchor).toContainText("C"); // the letter stays unobscured

  const submissionsBeforeCancel = state.submissions.length;
  await anchor.click(); // same-cell cancellation
  await expect(anchor).not.toHaveAttribute("data-tap-anchor", "true");
  await expect(anchor).not.toHaveAttribute("data-selected", "true");
  await expect(anchor).toHaveAttribute("data-found", "true"); // found state survives the cancellation
  expect(state.submissions).toHaveLength(submissionsBeforeCancel); // no network call from cancellation

  // The settled found appearance (background, no dashed anchor ring) is restored, not a blank
  // tile. The cell remains the last-touched keyboard-active cell, so a solid focus outline is
  // expected here — only the dashed anchor ring must be gone.
  const settledStyle = await anchor.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, outlineStyle: computed.outlineStyle };
  });
  expect(settledStyle.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(settledStyle.outlineStyle).not.toBe("dashed");
});

// ── Pass 6: board-first mobile visual polish — CSS-only depth/hierarchy coverage ───────────

test("Pass 6: board prominence — the board dominates the 390x844 viewport with a visible depth treatment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const board = page.locator(".word-search-board");
  const viewport = page.locator(".word-search-board-viewport");
  const boardBox = await board.boundingBox();
  const viewportBox = await viewport.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();

  // Horizontally centered within a reasonable tolerance, fully inside the viewport, and using
  // most of the available safe width (approximately 6-12px of side breathing room).
  const leftMargin = boardBox!.x - viewportBox!.x;
  const rightMargin = (viewportBox!.x + viewportBox!.width) - (boardBox!.x + boardBox!.width);
  expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(6);
  expect(boardBox!.x).toBeGreaterThanOrEqual(0);
  expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(390 + 1);
  expect(boardBox!.width).toBeGreaterThanOrEqual(280);

  // The board reads as visually wider than the status strip's text region and the Hint button.
  const selectedTextBox = await page.locator(".word-search-selected-text").boundingBox();
  const hintBox = await page.locator(".word-search-hint-button").boundingBox();
  expect(selectedTextBox).not.toBeNull();
  expect(hintBox).not.toBeNull();
  expect(boardBox!.width).toBeGreaterThan(selectedTextBox!.width);
  expect(boardBox!.width).toBeGreaterThan(hintBox!.width);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  const dimensions = await page.evaluate(() => ({ height: innerHeight, docHeight: document.documentElement.scrollHeight }));
  expect(dimensions.docHeight).toBeLessThanOrEqual(dimensions.height + 1);

  // Non-transparent surface treatments and a visible, non-layout-affecting depth treatment.
  const styles = await page.evaluate(() => {
    const boardEl = document.querySelector(".word-search-board")!;
    const viewportEl = document.querySelector(".word-search-board-viewport")!;
    return {
      boardBackground: getComputedStyle(boardEl).backgroundColor,
      boardBoxShadow: getComputedStyle(boardEl).boxShadow,
      viewportBoxShadow: getComputedStyle(viewportEl).boxShadow,
    };
  });
  expect(styles.boardBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.boardBoxShadow).not.toBe("none");
  expect(styles.viewportBoxShadow).not.toBe("none");
});

test("Pass 6: idle tile depth — an unfound, unselected tile has visible background, border, and depth", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const tile = page.locator('[data-ws-row="8"][data-ws-col="8"]'); // far from every placed word
  await expect(tile).toBeVisible();
  await expect(tile).toHaveText("X");
  const styles = await tile.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, borderStyle: computed.borderStyle, borderColor: computed.borderColor, boxShadow: computed.boxShadow };
  });
  expect(styles.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.borderStyle).toBe("solid");
  expect(styles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.boxShadow).not.toBe("none");

  // The dynamic cell-size contract is unchanged — the tile is still a positive-size square.
  const box = await tile.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1);
});

test("Pass 6: state hierarchy — idle, keyboard-active, pointer-selected, tap-anchor, found, and hinted styles are all distinct", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true); // short fixture: CAT + DOG only, deterministic hint target
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const readState = (row: number, col: number) => page.locator(`[data-ws-row="${row}"][data-ws-col="${col}"]`).evaluate((element) => {
    const computed = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    const after = getComputedStyle(element, "::after");
    return { outlineStyle: computed.outlineStyle, background: computed.backgroundColor, beforeContent: before.content, afterContent: after.content };
  });

  // Idle tile: no outline.
  const idle = await readState(8, 8);
  expect(idle.outlineStyle).toBe("none");

  // Keyboard-active cell: a solid focus ring, never dashed like the tap-anchor ring.
  await page.getByRole("grid").focus();
  const active = await readState(0, 0);
  expect(active.outlineStyle).toBe("solid");

  // Pointer-selected cell: a real in-progress drag, with no tap-anchor corner marker.
  const start = await cellBox(page, 0, 0);
  const mid = await cellBox(page, 0, 1);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(mid).x, cellCenter(mid).y, { steps: 4 });
  await expect.poll(() => selectedCellCount(page)).toBeGreaterThan(0);
  const selected = await readState(0, 0);
  expect(selected.beforeContent).toBe("none");
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"][data-tap-anchor]')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator("[data-selected]")).toHaveCount(0);

  // Tap anchor: dashed outline and a visible corner-diamond marker.
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click();
  const anchor = await readState(0, 0);
  expect(anchor.outlineStyle).toBe("dashed");
  expect(anchor.beforeContent).not.toBe("none");
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click(); // cancel
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(0);

  // Found CAT: differs from the active-drag selection background, letter stays visible.
  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const found = await readState(0, 0);
  expect(found.background).not.toBe(selected.background);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"]')).toContainText("C");

  // Hinted DOG (the only remaining candidate — deterministic in this 2-word fixture): the
  // internal dashed ::after marker stays visible without obscuring the letter.
  await page.getByRole("button", { name: /Hint/ }).click();
  await expect.poll(() => state.found.has("DOG")).toBe(true);
  const hinted = await readState(1, 0);
  expect(hinted.afterContent).not.toBe("none");
  await expect(page.locator('[data-ws-row="1"][data-ws-col="0"]')).toContainText("G");
});

test("Pass 6: lower control cohesion at 390x844 — consistent radii, stable dock height, and an emphasized Hint", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("Drag or tap to select")).toBeVisible();
  const dock = page.locator(".word-search-progress-strip");
  const idleDockBox = await dock.boundingBox();

  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click();
  await expect(page.locator(".word-search-selected-text")).toHaveText("C");
  const activeDockBox = await dock.boundingBox();
  expect(Math.abs(activeDockBox!.height - idleDockBox!.height)).toBeLessThanOrEqual(1);
  await page.locator('[data-ws-row="0"][data-ws-col="0"]').click(); // cancel, restore idle

  const wordsBox = await page.locator(".word-search-list-button").boundingBox();
  const hintBox = await page.locator(".word-search-hint-button").boundingBox();
  expect(wordsBox!.height).toBeGreaterThanOrEqual(44);
  expect(hintBox!.height).toBeGreaterThanOrEqual(44);

  const radii = await page.evaluate(() => {
    const parse = (selector: string) => getComputedStyle(document.querySelector(selector)!).borderRadius;
    return { dock: parse(".word-search-progress-strip"), words: parse(".word-search-list-button"), hint: parse(".word-search-hint-button") };
  });
  expect(radii.dock).toBe(radii.words);
  expect(radii.words).toBe(radii.hint);

  // Hint is visually more emphasized than the idle dock (a stronger border), without a yellow
  // filled background.
  const [dockBorder, hintBorder, hintBackground] = await Promise.all([
    dock.evaluate((element) => getComputedStyle(element).borderColor),
    page.locator(".word-search-hint-button").evaluate((element) => getComputedStyle(element).borderColor),
    page.locator(".word-search-hint-button").evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(hintBorder).not.toBe(dockBorder);
  expect(hintBackground).not.toMatch(/rgb\(2\d\d, 2\d\d, \d{1,2}\)/); // not a yellow fill

  // Nothing overlaps and everything stays within the viewport.
  const boxes = await Promise.all([dock, page.locator(".word-search-list-button"), page.locator(".word-search-hint-button")].map((locator) => locator.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 1);
  }
});

test("Pass 6: zoom controls form one grouped surface at 430x932", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await authenticate(page);
  await installRoutes(page, 20);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const fit = page.getByRole("button", { name: "Reset zoom" });
  await expect(zoomOut).toBeVisible();
  await expect(zoomIn).toBeVisible();
  await expect(fit).toBeVisible();
  await expect(fit).toBeDisabled(); // already fitted

  for (const button of [zoomOut, zoomIn, fit]) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  // The three controls share one visually connected surface (a single group boundary), not
  // three unrelated free-floating rectangles.
  const groupBox = await page.locator(".word-search-zoom-controls").boundingBox();
  const outBox = await zoomOut.boundingBox();
  const inBox = await zoomIn.boundingBox();
  const fitBox = await fit.boundingBox();
  expect(groupBox).not.toBeNull();
  expect(groupBox!.width).toBeGreaterThanOrEqual(outBox!.width + inBox!.width + fitBox!.width);
  const groupShadow = await page.locator(".word-search-zoom-controls").evaluate((element) => getComputedStyle(element).boxShadow);
  expect(groupShadow).not.toBe("none");

  await zoomIn.click();
  await expect(fit).toBeEnabled();

  // Existing zoom/pan selection geometry still passes with the grouped surface in place.
  const start = await cellBox(page, 15, 10);
  const end = await cellBox(page, 15, 13);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(end).x, cellCenter(end).y, { steps: 8 });
  await expect.poll(() => selectedCellCount(page)).toBe(4);
  await page.mouse.up();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("Pass 6: landscape at 844x390 keeps the board dominant, the list reachable, and controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const boardBox = await page.locator(".word-search-board").boundingBox();
  const listBox = await page.locator(".word-search-desktop-list").boundingBox();
  expect(boardBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(boardBox!.x).toBeLessThan(listBox!.x); // board remains on the left, list on the right
  expect(boardBox!.width).toBeGreaterThan(120); // board is not visually dwarfed by the list

  // No overlap between the board and the list.
  expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(listBox!.x + 1);

  // A valid drag still works, and the tap-anchor affordance remains visible.
  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  await page.locator('[data-ws-row="1"][data-ws-col="0"]').click();
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(1);
  await page.locator('[data-ws-row="1"][data-ws-col="0"]').click(); // cancel

  await expect(page.locator(".word-search-hint-button")).toBeVisible();
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth > window.innerWidth + 1,
    y: document.documentElement.scrollHeight > window.innerHeight + 1,
  }));
  expect(overflow.x).toBe(false);
  expect(overflow.y).toBe(false);
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

// ── Pass 7: word-list sheet and desktop panel redesign ─────────────────────────────────────

test("Pass 7: mobile sheet visual structure at 390x844 has a bounded, scrollable surface with correct progress", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Words" }).click();
  const dialog = page.getByRole("dialog", { name: "Words to find" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".word-search-desktop-list")).toBeHidden();
  // Let the entrance spring settle before measuring geometry.
  await expect.poll(async () => (await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height).toBeLessThanOrEqual(845);

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(844 + 1);
  expect(dialogBox!.height).toBeLessThanOrEqual(844 * 0.84 + 4);
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390 + 1);

  const layerBox = await page.locator(".word-search-sheet-layer").boundingBox();
  expect(layerBox).not.toBeNull();
  expect(layerBox!.width).toBeGreaterThanOrEqual(390 - 1);
  expect(layerBox!.height).toBeGreaterThanOrEqual(844 - 1);

  const closeButton = page.getByRole("button", { name: "Close word list" });
  const closeBox = await closeButton.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);

  const progress = dialog.getByRole("progressbar", { name: "Word progress" });
  await expect(progress).toBeVisible();
  expect(await progress.getAttribute("aria-valuemin")).toBe("0");
  expect(await progress.getAttribute("aria-valuemax")).toBe("12");
  expect(await progress.getAttribute("aria-valuenow")).toBe("0");

  await expect(dialog.locator(".word-search-word-items")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  // The list area itself scrolls; the page behind it does not.
  const bodyScrollBefore = await page.evaluate(() => window.scrollY);
  await dialog.locator(".word-search-word-items").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const bodyScrollAfter = await page.evaluate(() => window.scrollY);
  expect(bodyScrollAfter).toBe(bodyScrollBefore);
});

test("Pass 7: mobile word-item hierarchy — unfound stays readable and disabled; found gains a non-color completion cue", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Words" }).click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();

  const dog = page.getByRole("button", { name: "DOG, not found" });
  await expect(dog).toBeVisible();
  await expect(dog).toBeDisabled();
  const dogBox = await dog.boundingBox();
  expect(dogBox).not.toBeNull();
  expect(dogBox!.height).toBeGreaterThanOrEqual(44);
  const dogOpacity = await dog.evaluate((element) => getComputedStyle(element).opacity);
  expect(Number(dogOpacity)).toBeGreaterThanOrEqual(0.85); // no washed-out global fade

  const dialog = page.getByRole("dialog", { name: "Words to find" });
  const itemLabels = await dialog.locator(".word-search-word-item-label").allTextContents();
  expect(itemLabels[0]).toBe("CAT");
  expect(itemLabels[1]).toBe("DOG");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);

  await page.getByRole("button", { name: "Words" }).click();
  const cat = page.getByRole("button", { name: "CAT, found; open definition" });
  await expect(cat).toBeVisible();
  await expect(cat).toBeEnabled();
  await expect(cat.locator("svg")).toHaveCount(2); // completion check + definition chevron

  const catStyle = await cat.evaluate((element) => getComputedStyle(element).borderColor);
  const dogStyle2 = await page.getByRole("button", { name: "DOG, not found" }).evaluate((element) => getComputedStyle(element).borderColor);
  expect(catStyle).not.toBe(dogStyle2);

  // CAT keeps its original list position — first, not moved to the top of a reordered list.
  const reopenedDialog = page.getByRole("dialog", { name: "Words to find" });
  const labelsAfter = await reopenedDialog.locator(".word-search-word-item-label").allTextContents();
  expect(labelsAfter[0]).toBe("CAT");
  expect(labelsAfter[1]).toBe("DOG");
});

test("Pass 7: mobile definition choreography — the sheet closes before the definition modal opens, never both at once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);

  await page.getByRole("button", { name: "Words" }).click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();
  await page.getByRole("button", { name: "CAT, found; open definition" }).click();

  await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toHaveCount(0);
  await expect(page.getByRole("grid")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
});

test("Pass 7: close methods and focus restoration on the mobile sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });
  const wordsButton = page.getByRole("button", { name: "Words" });

  // Close button.
  await wordsButton.focus();
  await wordsButton.click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();
  await page.getByRole("button", { name: "Close word list" }).click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0);
  await expect(wordsButton).toBeFocused();

  // Escape.
  await wordsButton.click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0);
  await expect(wordsButton).toBeFocused();

  // Backdrop click.
  await wordsButton.click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();
  await page.locator(".word-search-sheet-layer").click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0);
  expect(state.found.size).toBe(0);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
});

test("Pass 7: header stays visible while the mobile word list scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Words" }).click();
  const dialog = page.getByRole("dialog", { name: "Words to find" });
  await expect(dialog).toBeVisible();
  // Let the entrance spring settle before capturing a stable baseline position.
  await page.waitForTimeout(400);

  const heading = page.getByRole("heading", { name: "Words to find" });
  const progress = dialog.getByRole("progressbar", { name: "Word progress" });
  const closeButton = page.getByRole("button", { name: "Close word list" });
  const headingBoxBefore = await heading.boundingBox();

  await dialog.locator(".word-search-word-items").evaluate((element) => { element.scrollTop = element.scrollHeight; });

  await expect(heading).toBeVisible();
  await expect(progress).toBeVisible();
  await expect(closeButton).toBeVisible();
  const headingBoxAfter = await heading.boundingBox();
  expect(headingBoxAfter).not.toBeNull();
  expect(headingBoxBefore).not.toBeNull();
  expect(Math.abs(headingBoxAfter!.y - headingBoxBefore!.y)).toBeLessThanOrEqual(1);

  const bodyScroll = await page.evaluate(() => window.scrollY);
  expect(bodyScroll).toBe(0);
});

test("Pass 7: narrow 320x710 mobile sheet fits with readable items and a reachable close control", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 710 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Words" }).click();
  const dialog = page.getByRole("dialog", { name: "Words to find" });
  await expect(dialog).toBeVisible();

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320 + 1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  const itemHeights = await dialog.locator(".word-search-word-item").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  itemHeights.forEach((height) => expect(height).toBeGreaterThanOrEqual(43.9)); // sub-pixel rounding tolerance

  await expect(dialog.locator(".word-search-word-item-label").first()).toHaveText("CAT");
  await expect(page.getByRole("button", { name: "Close word list" })).toBeVisible();
});

test("Pass 7: tablet 1024x768 opens the capped, centered sheet rather than the desktop panel", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await authenticate(page);
  await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await expect(page.locator(".word-search-desktop-list")).toBeHidden();
  await expect(page.getByRole("button", { name: "Words" })).toBeVisible();
  await page.getByRole("button", { name: "Words" }).click();

  const dialog = page.getByRole("dialog", { name: "Words to find" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.width).toBeLessThanOrEqual(620 + 1);
  expect(dialogBox!.width).toBeLessThan(1024);

  const progress = page.getByRole("progressbar", { name: "Word progress" });
  await expect(progress).toBeVisible();
  await expect(page.getByRole("button", { name: "Close word list" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("Pass 7: landscape panel at 844x390 shows the progress header and keeps items usable", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await expect(page.locator(".word-search-list-button")).toBeHidden();
  const panel = page.locator(".word-search-desktop-list");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Words to find" })).toBeVisible();
  const progress = panel.getByRole("progressbar", { name: "Word progress" });
  await expect(progress).toBeVisible();

  const itemHeights = await panel.locator(".word-search-word-item").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  itemHeights.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(progress).toHaveAttribute("aria-valuenow", "1");

  await page.getByRole("grid").focus();
  await page.keyboard.press("w");
  await expect(panel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator('.word-search-cell[data-active="true"]')).toBeFocused();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("Pass 7: desktop 1440x900 Catalog panel has a sticky, opaque header and updates progress without layout shift", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const panel = page.locator(".word-search-desktop-list");
  await expect(panel).toBeVisible();
  await expect(page.locator(".word-search-list-button")).toBeHidden();

  const boardBox = await page.locator(".word-search-board").boundingBox();
  const panelBox = await panel.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeLessThan(boardBox!.width);

  const header = panel.locator(".word-search-desktop-list-header");
  const headerStyle = await header.evaluate((element) => getComputedStyle(element).position);
  expect(headerStyle).toBe("sticky");
  const headerBoxBefore = await header.boundingBox();

  const progress = panel.getByRole("progressbar", { name: "Word progress" });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(progress).toHaveAttribute("aria-valuenow", "1");

  const cat = panel.getByRole("button", { name: "CAT, found; open definition" });
  await expect(cat).toBeEnabled();
  await cat.click();
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible();
  await expect(panel).toBeVisible(); // the panel stays mounted behind the definition
  await page.keyboard.press("Escape");

  const dog = panel.getByRole("button", { name: "DOG, not found" });
  await expect(dog).toBeDisabled();

  const headerBoxAfter = await header.boundingBox();
  expect(headerBoxAfter).not.toBeNull();
  expect(headerBoxBefore).not.toBeNull();
  expect(Math.abs(headerBoxAfter!.y - headerBoxBefore!.y)).toBeLessThanOrEqual(1);

  cat.focus();
  const focusOutline = await cat.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusOutline).toBe("solid");

  await page.getByRole("grid").focus();
  await page.keyboard.press("w");
  await expect(panel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator('.word-search-cell[data-active="true"]')).toBeFocused();
});

test("Pass 7: Warz word sheet uses the redesigned treatment without opening definitions or affecting timing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.getByTestId("word-search-root")).toBeVisible();

  await page.getByRole("button", { name: "Words" }).click();
  const dialog = page.getByRole("dialog", { name: "Words to find" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("progressbar", { name: "Word progress" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await dragWord(page, [0, 0], [0, 2]);
  await page.waitForTimeout(700);
  // Automatic (non-final and final) definition reveals stay fully suppressed in Warz.
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  expect(state.dictionaryRequests).toHaveLength(0);

  // Manual definitions are also fully suppressed — CAT reads as found but is not interactive.
  await page.getByRole("button", { name: "Words" }).click();
  const sheet = page.getByRole("dialog", { name: "Words to find" });
  const cat = sheet.getByRole("button", { name: "CAT, found" });
  await expect(cat).toBeVisible();
  await expect(cat).toHaveAttribute("data-found", "true");
  await expect(cat).toBeDisabled();
  expect(await cat.getAttribute("aria-label")).not.toContain("open definition");
  await expect(cat.locator(".word-search-word-item-definition-label")).toHaveCount(0);
  await expect(cat.locator(".word-search-word-item-chevron")).toHaveCount(0);

  await cat.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0);
  expect(state.dictionaryRequests).toHaveLength(0);
});

// ── Pass 8: definition modal polish ─────────────────────────────────────────────────────────

async function openCatDefinitionFromList(page: Page) {
  await page.getByRole("button", { name: "Words" }).click();
  await page.getByRole("button", { name: "CAT, found; open definition" }).click();
  return page.getByRole("dialog", { name: "CAT definition" });
}

// A dedicated fixture spanning short-to-long words, used only by the letter-tile geometry
// regression below — deliberately not the shared `fixture()` used elsewhere, so this can't
// perturb any other test's word list or grid layout.
function tileGeometryFixture() {
  const size = 20;
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => "X"));
  const placements: Array<[string, number, number]> = [
    ["CAT", 0, 0],
    ["ELEPHANT", 2, 0],
    ["CONSTELLATION", 4, 0],
    ["CHARACTERIZATION", 6, 0],
  ];
  for (const [word, row, col] of placements) word.split("").forEach((letter, index) => { grid[row][col + index] = letter; });
  return { grid, words: placements.map(([word]) => word) };
}

test("Pass 8: mobile found definition modal at 390x844 is polished, contained, and dismissible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);

  await page.getByRole("button", { name: "Words" }).click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();
  await page.getByRole("button", { name: "CAT, found; open definition" }).click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toHaveCount(0); // sheet closes first

  const dialog = page.getByRole("dialog", { name: "CAT definition" });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844 + 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  const styles = await dialog.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { backgroundImage: computed.backgroundImage, border: computed.borderStyle, shadow: computed.boxShadow };
  });
  expect(styles.backgroundImage).not.toBe("none"); // layered gradient surface, not a flat/transparent card
  expect(styles.border).toBe("solid");
  expect(styles.shadow).not.toBe("none");

  const closeBox = await page.getByRole("button", { name: "Close", exact: true }).boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  const ctaBox = await page.getByRole("button", { name: /Keep searching/i }).boundingBox();
  expect(ctaBox!.height).toBeGreaterThanOrEqual(44);

  await expect(dialog.getByText("Word found")).toBeVisible();
  await expect(dialog.locator(".word-definition-tile")).toHaveCount(3);
  await expect(dialog.getByText("noun")).toBeVisible();
  await expect(dialog.getByText("Definition of CAT")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /View full definition/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Keep searching/i })).toBeVisible();
  expect(await dialog.textContent()).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);

  // Clicking inside the card must never dismiss it.
  await dialog.click({ position: { x: 10, y: 10 } });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: /Keep searching/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("grid")).toBeVisible();
  await dragWord(page, [1, 0], [1, 2]);
  await expect.poll(() => state.found.has("DOG")).toBe(true); // board is usable again
});

test("Pass 8: loading-to-found definition transition stays accessible and stable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);

  state.holdDictionaryResponse();
  const dialog = await openCatDefinitionFromList(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await expect(dialog).toHaveAttribute("data-definition-status", "loading");
  await expect(dialog.locator(".word-definition-skeleton").first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Keep searching/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await page.waitForTimeout(400); // let the entrance spring settle before measuring geometry
  const loadingBox = await dialog.boundingBox();
  expect(loadingBox).not.toBeNull();
  expect(loadingBox!.y).toBeGreaterThanOrEqual(0);
  expect(loadingBox!.y + loadingBox!.height).toBeLessThanOrEqual(844 + 1);
  const loadingWidth = loadingBox!.width;

  state.releaseDictionaryResponse();
  await expect(dialog).toHaveAttribute("aria-busy", "false");
  await expect(dialog).toHaveAttribute("data-definition-status", "found");
  await expect(dialog.getByText("Definition of CAT")).toBeVisible();
  await expect(dialog.locator(".word-definition-skeleton")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Keep searching/i })).toBeEnabled();

  const foundBox = await dialog.boundingBox();
  expect(Math.abs(foundBox!.width - loadingWidth)).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("Pass 8: not-found definition shows calm fallback copy and the Merriam-Webster link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  state.setDictionaryResponse({ found: false });
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const dialog = await openCatDefinitionFromList(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-definition-status", "not-found");

  await expect(dialog.getByText("A quick definition was not available for this word.")).toBeVisible();
  expect(await dialog.textContent()).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);

  const link = dialog.getByRole("link", { name: /View full definition/ });
  await expect(link).toBeVisible();
  expect(await link.getAttribute("href")).toContain("merriam-webster.com/dictionary/cat");
  await expect(dialog.getByRole("button", { name: /Hear pronunciation/ })).toHaveCount(0);

  await dialog.getByRole("button", { name: /Keep searching/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("grid")).toBeVisible();
});

test("Pass 8: pronunciation control attempts playback without dismissing the modal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  state.setDictionaryResponse({ audioUrl: "https://example.test/cat.mp3" });
  await page.addInitScript(() => {
    class FakeAudio {
      volume = 1;
      src: string;
      constructor(src: string) {
        this.src = src;
        (window as unknown as { __audioPlays: { src: string }[] }).__audioPlays ??= [];
        (window as unknown as { __audioPlays: { src: string }[] }).__audioPlays.push({ src });
      }
      play() {
        (window as unknown as { __audioLastVolume: number }).__audioLastVolume = this.volume;
        return Promise.resolve();
      }
    }
    // @ts-expect-error test-only global override, not a production hook
    window.Audio = FakeAudio;
  });
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const dialog = await openCatDefinitionFromList(page);
  await expect(dialog).toBeVisible();

  const pronunciation = dialog.getByRole("button", { name: "Hear pronunciation for CAT" });
  await expect(pronunciation).toBeVisible();
  await page.waitForTimeout(400); // let the card's entrance spring settle before measuring geometry
  const box = await pronunciation.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(43.9); // sub-pixel rounding tolerance
  await expect(pronunciation.locator("svg")).toHaveCount(1);

  await pronunciation.click();
  await expect(dialog).toBeVisible(); // clicking pronunciation never dismisses the modal
  const plays = await page.evaluate(() => (window as unknown as { __audioPlays: { src: string }[] }).__audioPlays);
  expect(plays).toEqual([{ src: "https://example.test/cat.mp3" }]);
  const volume = await page.evaluate(() => (window as unknown as { __audioLastVolume: number }).__audioLastVolume);
  expect(volume).toBe(0.7);
});

test("Pass 8: narrow 320x710 definition modal fits with reachable controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 710 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const dialog = await openCatDefinitionFromList(page);
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320 + 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  const tiles = dialog.locator(".word-definition-tile");
  const tileBoxes = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  const rowY = tileBoxes[0].y;
  for (const tileBox of tileBoxes) expect(Math.abs(tileBox.y - rowY)).toBeLessThanOrEqual(1); // single row

  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /View full definition/ })).toBeVisible();
  await dialog.getByRole("button", { name: /Keep searching/i }).click();
  await expect(dialog).toHaveCount(0);
});

test("Pass 8: landscape 844x390 definition modal fits via internal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  // At this landscape breakpoint the embedded desktop-style panel replaces the mobile sheet's
  // "Words" button, so the found word is clicked directly from the panel.
  await page.locator(".word-search-desktop-list").getByRole("button", { name: "CAT, found; open definition" }).click();
  const dialog = page.getByRole("dialog", { name: "CAT definition" });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(390 + 1);
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth > window.innerWidth + 1,
    y: document.documentElement.scrollHeight > window.innerHeight + 1,
  }));
  expect(overflow.x).toBe(false);
  expect(overflow.y).toBe(false);

  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  const cta = dialog.getByRole("button", { name: /Keep searching/i });
  await expect(cta).toBeVisible();
  await cta.focus();
  await expect(cta).toBeFocused();
  await cta.click();
  await expect(dialog).toHaveCount(0);
});

test("Pass 8: desktop 1440x900 Catalog definition modal stays capped with the panel mounted behind it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const catButton = page.getByRole("button", { name: "CAT, found; open definition" });
  await catButton.click();

  const dialog = page.getByRole("dialog", { name: "CAT definition" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".word-search-desktop-list")).toBeVisible(); // panel stays mounted behind it

  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(440 + 1);

  const definitionAlign = await dialog.locator(".word-definition-copy").evaluate((element) => getComputedStyle(element).textAlign);
  expect(definitionAlign).toBe("left");

  // Tab via the keyboard (rather than a scripted .focus()) so Chromium's :focus-visible
  // heuristic actually engages. No audioUrl in this fixture, so the order is Close, source
  // link, Keep searching. Wait for the dialog's own initial-focus handoff (an rAF after mount)
  // to land before tabbing, or the first Tab could still be relative to the trigger button.
  await expect(dialog).toBeFocused();
  const cta = dialog.getByRole("button", { name: /Keep searching/i });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(cta).toBeFocused();
  const outline = await cta.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(catButton).toBeFocused();
});

test("Pass 8: reduced motion definition modal opens without a transformed entrance", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const dialog = await openCatDefinitionFromList(page);
  await expect(dialog).toBeVisible();

  const tiles = dialog.locator(".word-definition-tile");
  await expect(tiles).toHaveCount(3);
  for (const tile of await tiles.all()) {
    const opacity = await tile.evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1); // immediately in final position, no stagger-in
  }
  await expect(dialog.locator(".word-definition-skeleton")).toHaveCount(0); // found already, no loading skeleton

  await dialog.getByRole("button", { name: /Keep searching/i }).click();
  await expect(dialog).toHaveCount(0);
});

// ── Pass 9: polished selection trail and word-found feedback ────────────────────────────────

/** Installs a page-level navigator.vibrate stub before any script runs, so it captures every
 * call the app makes (haptics preference is read fresh each call, so this must be in place
 * before goto, not attached after). */
async function installVibrateStub(page: Page) {
  await page.addInitScript(() => {
    const calls: number[][] = [];
    (window as unknown as { __wsVibrateCalls: number[][] }).__wsVibrateCalls = calls;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: number | number[]) => { calls.push(Array.isArray(pattern) ? pattern : [pattern]); return true; },
    });
  });
}

async function vibrateCalls(page: Page): Promise<number[][]> {
  return page.evaluate(() => (window as unknown as { __wsVibrateCalls: number[][] }).__wsVibrateCalls ?? []);
}

// Word Trove's own Pass 9 success patterns, distinct from the app-wide ambient button-press tap
// haptic (a single short pulse fired by every Pressable, unrelated to word-found feedback).
const CELEBRATION_PATTERNS = [[10, 22, 14], [8, 16, 8], [10, 20, 14, 32, 18]];
function countCelebrationVibrations(calls: number[][]) {
  return calls.filter((call) => CELEBRATION_PATTERNS.some((pattern) => pattern.length === call.length && pattern.every((value, index) => value === call[index]))).length;
}

async function setHapticsPreference(page: Page, enabled: boolean) {
  // Matches src/lib/juice/prefs.ts's HAPTICS_KEY — haptics default ON, so only "0" disables.
  await page.addInitScript((value) => { localStorage.setItem("pw-juice-haptics", value ? "1" : "0"); }, enabled);
}

test("Pass 9: active trail — layered, pointer-transparent, non-scaling stroke, behind the letter cells, and endpoint halos visible past the tile perimeter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installVibrateStub(page);
  await setHapticsPreference(page, true);
  const state = await installRoutes(page, 10, true); // CAT (row 0, cols 0-2) + DOG
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const start = await cellBox(page, 0, 0);
  const end = await cellBox(page, 0, 2);
  await page.mouse.move(cellCenter(start).x, cellCenter(start).y);
  await page.mouse.down();
  await page.mouse.move(cellCenter(end).x, cellCenter(end).y, { steps: 6 });
  await expect.poll(() => selectedCellCount(page)).toBe(3);

  const trail = page.locator(".word-search-trail");
  await expect(trail).toBeVisible();
  await expect(trail.locator(".word-search-trail-underlay")).toHaveCount(1);
  await expect(trail.locator(".word-search-trail-core")).toHaveCount(1);
  await expect(trail.locator(".word-search-trail-start")).toHaveCount(1);
  await expect(trail.locator(".word-search-trail-end")).toHaveCount(1);

  expect(await trail.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
  const trailZ = await trail.evaluate((element) => Number(getComputedStyle(element).zIndex));
  const cellZ = await page.locator('[data-ws-row="0"][data-ws-col="0"]').evaluate((element) => Number(getComputedStyle(element).zIndex));
  expect(trailZ).toBeLessThan(cellZ); // trail renders behind cells

  const underlayWidth = await trail.locator(".word-search-trail-underlay").evaluate((element) => parseFloat(getComputedStyle(element).strokeWidth));
  const coreWidth = await trail.locator(".word-search-trail-core").evaluate((element) => parseFloat(getComputedStyle(element).strokeWidth));
  expect(underlayWidth).toBeGreaterThan(coreWidth);
  for (const selector of [".word-search-trail-underlay", ".word-search-trail-core"]) {
    expect(await trail.locator(selector).getAttribute("vector-effect")).toBe("non-scaling-stroke");
  }

  // Trail points align with the selected cell centers (within a small tolerance).
  const points = await trail.locator(".word-search-trail-core").getAttribute("points");
  const coords = points!.trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
  expect(coords).toHaveLength(3);

  // The endpoint halos are hollow rings that visibly extend outside their endpoint tiles, remain
  // behind the cells, and stay within the board — not merely present in the DOM.
  const startBox = await expectEndpointHalo(page, ".word-search-trail-start", 0, 0);
  const endBox = await expectEndpointHalo(page, ".word-search-trail-end", 0, 2);
  // The end marker reads as at least as visually strong as the start marker (larger or equal
  // ring size, and no weaker opacity).
  expect(endBox.width).toBeGreaterThanOrEqual(startBox.width - 0.5);
  const [startOpacity, endOpacity] = await Promise.all([
    page.locator(".word-search-trail-start").evaluate((element) => Number(getComputedStyle(element).opacity)),
    page.locator(".word-search-trail-end").evaluate((element) => Number(getComputedStyle(element).opacity)),
  ]);
  expect(endOpacity).toBeGreaterThanOrEqual(startOpacity);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);

  expect(await vibrateCalls(page)).toHaveLength(0); // dragging between cells never vibrates

  await page.mouse.up();
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  expect(state.submissions.filter((word) => word === "CAT")).toHaveLength(1); // exactly one submission
});

test("Pass 9: two-tap and keyboard selection also render the polished trail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installRoutes(page, 10, true);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  // Two-tap: tap the start cell, then move (without releasing a drag) toward the end cell isn't
  // applicable here — instead tap start, then tap a middle cell to resolve the anchored line.
  const start = await cellBox(page, 0, 0);
  await page.mouse.click(cellCenter(start).x, cellCenter(start).y);
  await expect(page.locator("[data-tap-anchor]")).toHaveCount(1);
  const mid = await cellBox(page, 0, 1);
  await page.mouse.move(cellCenter(mid).x, cellCenter(mid).y);
  await page.mouse.down();
  await expect.poll(() => selectedCellCount(page)).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".word-search-trail-core")).toHaveCount(1);
  await expectEndpointHalo(page, ".word-search-trail-start", 0, 0);
  await expectEndpointHalo(page, ".word-search-trail-end", 0, 1);
  await page.mouse.up();
  await page.keyboard.press("Escape"); // clear whatever partial gesture remains, cleanly

  // Keyboard: Space to anchor, then extend beyond one cell. The prior pointer gesture left the
  // active cell at (0,1) (its final drag position), so Space anchors there, not at (0,0).
  await page.locator(".word-search-board").focus();
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => selectedCellCount(page)).toBe(2);
  await expect(page.locator(".word-search-trail-core")).toHaveCount(1);
  await expect(page.locator(".word-search-trail-start")).toHaveCount(1);
  await expect(page.locator(".word-search-trail-end")).toHaveCount(1);
  await expectEndpointHalo(page, ".word-search-trail-start", 0, 1);
  await expectEndpointHalo(page, ".word-search-trail-end", 0, 2);
  await page.keyboard.press("Escape");
});

test("Pass 9: found success feedback — ordered cell celebration, success trail, and a compact non-blocking confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const boardBefore = await page.locator(".word-search-board").boundingBox();
  const dockBefore = await page.locator(".word-search-word-dock,.word-search-desktop-list").first().boundingBox();

  await dragWord(page, [0, 0], [0, 2]); // CAT
  await expect.poll(() => state.found.has("CAT")).toBe(true);

  // Immediately after the find, the transient feedback should be present.
  const celebrating = page.locator("[data-celebrating]");
  await expect(celebrating).toHaveCount(3);
  for (const col of [0, 1, 2]) await expect(page.locator(`[data-ws-row="0"][data-ws-col="${col}"][data-celebrating]`)).toHaveCount(1);
  await expect(page.locator('[data-ws-row="1"][data-ws-col="0"][data-celebrating]')).toHaveCount(0); // unrelated cell

  const bursts = page.locator(".word-search-cell-burst");
  await expect(bursts).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    expect(await bursts.nth(i).evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
    expect(await bursts.nth(i).getAttribute("aria-hidden")).toBe("true");
  }

  await expect(page.locator(".word-search-found-trail")).toHaveCount(1);

  const confirmation = page.locator(".word-search-found-flash");
  await expect(confirmation).toBeVisible();
  expect(confirmation.getByText("CAT")).toBeTruthy();
  await expect(confirmation).toHaveAttribute("aria-hidden", "true");
  expect(await confirmation.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

  const boardDuring = await page.locator(".word-search-board").boundingBox();
  const dockDuring = await page.locator(".word-search-word-dock,.word-search-desktop-list").first().boundingBox();
  expect(Math.abs(boardDuring!.x - boardBefore!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(boardDuring!.y - boardBefore!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(dockDuring!.y - dockBefore!.y)).toBeLessThanOrEqual(1);
  const overflowDuring = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflowDuring).toBe(false);

  // Feedback settles: everything transient disappears, the permanent found state remains.
  await expect(celebrating).toHaveCount(0, { timeout: 2000 });
  await expect(bursts).toHaveCount(0);
  await expect(page.locator(".word-search-found-trail")).toHaveCount(0);
  await expect(confirmation).toHaveCount(0);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"][data-found]')).toHaveCount(1);

  // The board remains usable — DOG can still be found.
  await dragWord(page, [1, 2], [1, 0]);
  await expect.poll(() => state.found.has("DOG")).toBe(true);
});

test("Pass 9: haptic preference is respected for finding, dragging, and opening Words or a definition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installVibrateStub(page);
  await setHapticsPreference(page, true);
  const state = await installRoutes(page, 10, true);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]); // CAT — non-final
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect.poll(async () => countCelebrationVibrations(await vibrateCalls(page))).toBe(1);
  const celebrationCalls = (await vibrateCalls(page)).filter((call) => CELEBRATION_PATTERNS.some((p) => p.length === call.length && p.every((v, i) => v === call[i])));
  expect(celebrationCalls[0]).toEqual([10, 22, 14]);

  await page.getByRole("button", { name: "Words" }).click();
  await expect(page.getByRole("dialog", { name: "Words to find" })).toBeVisible();
  expect(countCelebrationVibrations(await vibrateCalls(page))).toBe(1); // opening the word list adds no celebration vibration
  await page.getByRole("button", { name: /CAT, found/ }).click();
  await expect(page.getByRole("dialog", { name: "CAT definition" })).toBeVisible();
  expect(countCelebrationVibrations(await vibrateCalls(page))).toBe(1); // opening a definition adds no celebration vibration
});

test("Pass 9: haptics stay silent for a find when the preference is disabled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await installVibrateStub(page);
  await setHapticsPreference(page, false);
  const state = await installRoutes(page, 10, true);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  await page.waitForTimeout(300);
  expect(await vibrateCalls(page)).toHaveLength(0);
});

test("Pass 9: reduced motion — CAT is immediately found with no animated burst, no moving success trail, and a static confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await installRoutes(page, 10, true);
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"][data-found]')).toHaveCount(1); // permanent color immediate

  expect(await page.locator(".word-search-cell-burst").count()).toBe(0);
  expect(await page.locator(".word-search-found-trail").count()).toBe(0);

  const confirmation = page.locator(".word-search-found-flash");
  await expect(confirmation).toBeVisible();
  expect(await confirmation.evaluate((element) => element.className)).toContain("word-search-found-flash--static");

  // The board is immediately usable — no staggered delay blocking the next selection.
  await dragWord(page, [1, 2], [1, 0]);
  await expect.poll(() => state.found.has("DOG")).toBe(true);
});

test("Pass 9: rapid Warz finds — CAT to DOG replacement survives CAT's stale cleanup, then SUN completes the battle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 10, true, catDogSunFixture()); // CAT/DOG non-final, SUN final
  await page.goto(`/warz/play/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start Battle/ }).click();
  await expect(page.getByTestId("word-search-root")).toBeVisible();
  await expect(page.locator(".word-search-progress-strip")).toContainText("0 / 3 found");
  await expect(page.locator(".word-search-board").locator('[data-ws-row="0"][data-ws-col="0"]')).toBeVisible();

  const flashWord = page.locator(".word-search-found-flash-word");

  // Warz submissions are purely client-side (no server POST for the word itself), so progress
  // is asserted from the rendered UI rather than the mocked route's captured state.
  const catFoundAt = Date.now();
  await dragWord(page, [0, 0], [0, 2]); // CAT
  await expect(page.locator(".word-search-progress-strip")).toContainText("1 / 3 found");
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"][data-found]')).toHaveCount(1);
  await expect(page.locator(".word-search-found-flash")).toHaveCount(1);
  await expect(flashWord).toHaveText("CAT");

  // DOG (still non-final — SUN remains) is found well inside CAT's 480ms celebration lifetime.
  await dragWord(page, [1, 0], [1, 2]); // DOG
  const dogFoundAt = Date.now();
  await expect(page.locator(".word-search-progress-strip")).toContainText("2 / 3 found");
  await expect(page.locator('[data-ws-row="1"][data-ws-col="0"][data-found]')).toHaveCount(1);
  // Only one confirmation exists at a time, and it now reads DOG, not CAT.
  await expect(page.locator(".word-search-found-flash")).toHaveCount(1);
  await expect(flashWord).toHaveText("DOG");

  // Wait until just after CAT's original ~480ms cleanup deadline, but comfortably before DOG's
  // own (later-starting) 480ms deadline — proving CAT's stale timer cannot clobber DOG's
  // confirmation. Structure: CAT at t=0, DOG at t≈dogFoundAt-catFoundAt, check at CAT_deadline+30ms.
  const staleCheckAt = catFoundAt + 480 + 30;
  const dogDeadline = dogFoundAt + 480;
  if (Date.now() < staleCheckAt) await page.waitForTimeout(staleCheckAt - Date.now());
  expect(Date.now()).toBeLessThan(dogDeadline - 20); // still comfortably inside DOG's own lifetime
  await expect(page.locator(".word-search-found-flash")).toHaveCount(1); // CAT's stale cleanup did not remove it
  await expect(flashWord).toHaveText("DOG");

  // Wait past DOG's own cleanup deadline — its confirmation and transient celebration clear.
  const afterDogDeadline = dogDeadline + 60 - Date.now();
  if (afterDogDeadline > 0) await page.waitForTimeout(afterDogDeadline);
  await expect(page.locator(".word-search-found-flash")).toHaveCount(0);
  await expect(page.locator("[data-celebrating]")).toHaveCount(0);
  // Both earlier finds remain permanently found.
  await expect(page.locator('[data-ws-row="0"][data-ws-col="0"][data-found]')).toHaveCount(1);
  await expect(page.locator('[data-ws-row="1"][data-ws-col="0"][data-found]')).toHaveCount(1);

  // SUN is the final word — it must trigger the normal, synchronous Warz result transition with
  // no modal and no internal Word Search success banner behind it.
  await dragWord(page, [2, 0], [2, 2]); // SUN
  await expect(page.getByText("Posting your challenge…")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Challenge Posted!" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog", { name: /definition/i })).toHaveCount(0); // never opens in Warz
  await expect(page.locator(".word-search-success")).toHaveCount(0);
  expect(state.dictionaryRequests).toHaveLength(0);
  expect(state.submissions).toHaveLength(0); // Warz never POSTs the word itself
});

test("Pass 8 verification: letter-tile geometry stays single-row, non-overlapping, and contained across word lengths", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 20, false, tileGeometryFixture());
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  const words: Array<{ word: string; start: [number, number]; end: [number, number] }> = [
    { word: "CAT", start: [0, 0], end: [0, 2] },
    { word: "ELEPHANT", start: [2, 0], end: [2, 7] },
    { word: "CONSTELLATION", start: [4, 0], end: [4, 12] },
    { word: "CHARACTERIZATION", start: [6, 0], end: [6, 15] },
  ];

  for (const { word, start, end } of words) {
    await dragWord(page, start, end);
    await expect.poll(() => state.found.has(word)).toBe(true);

    await page.getByRole("button", { name: "Words" }).click();
    await page.getByRole("button", { name: `${word}, found; open definition` }).click();
    const dialog = page.getByRole("dialog", { name: `${word} definition` });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(400); // let the tile entrance stagger settle before measuring geometry

    const tiles = dialog.locator(".word-definition-tile");
    await expect(tiles).toHaveCount(word.length);
    const boxes = await tiles.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));

    // Every tile is finite, positive, and bounded by the sizing formula's cap.
    for (const box of boxes) {
      expect(Number.isFinite(box.width)).toBe(true);
      expect(Number.isFinite(box.height)).toBe(true);
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      expect(box.width).toBeLessThanOrEqual(35); // 34px cap + rounding
      expect(box.height).toBeLessThanOrEqual(35);
    }

    // Single row: every tile shares the same y within a hairline tolerance.
    const rowY = boxes[0].y;
    for (const box of boxes) expect(Math.abs(box.y - rowY)).toBeLessThanOrEqual(1);

    // No overlap: each tile's left edge is at or after the previous tile's right edge.
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
    }

    // The row stays within the dialog's own bounds.
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(dialogBox!.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width + 1);
    }

    // No modal/page overflow at this viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);

    await dialog.getByRole("button", { name: /Keep searching/i }).click();
    await expect(dialog).toHaveCount(0);
  }
});

test("Pass 8 verification: no-audio, no-part-of-speech definition content all reaches visible without staying stuck hidden", async ({ page }) => {
  // This is the exact regression scenario: a shared-variants/staggerChildren setup got
  // permanently stuck at opacity 0 for whichever section followed a conditionally-omitted
  // sibling. With both the pronunciation button and part-of-speech line omitted, the
  // definition paragraph directly follows two skipped siblings — the worst case.
  await page.setViewportSize({ width: 390, height: 844 });
  await authenticate(page);
  const state = await installRoutes(page, 15);
  // The route fixture's `?? "noun"` fallback only triggers on null/undefined, so an empty
  // string is what actually clears partOfSpeech through to the component as falsy.
  state.setDictionaryResponse({ partOfSpeech: "", audioUrl: null });
  await page.goto("/daily/word-search", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("word-search-root")).toBeVisible({ timeout: 15_000 });

  await dragWord(page, [0, 0], [0, 2]);
  await expect.poll(() => state.found.has("CAT")).toBe(true);
  const dialog = await openCatDefinitionFromList(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-definition-status", "found");

  await expect(dialog.getByRole("button", { name: /Hear pronunciation/ })).toHaveCount(0);
  await expect(dialog.locator(".word-definition-part")).toHaveCount(0);

  // Wait only as long as the real entrance animation takes: itemMotion caps its delay at 0.4s
  // plus a 0.24s transition, so 700ms comfortably covers the last item settling.
  await page.waitForTimeout(700);

  const sections = [".word-definition-badge", ".word-definition-tiles", ".word-definition-copy", ".word-definition-source", ".word-definition-action"];
  for (const selector of sections) {
    const element = dialog.locator(selector);
    await expect(element).toBeVisible();
    const opacity = await element.evaluate((node) => Number(getComputedStyle(node).opacity));
    expect(opacity).toBeGreaterThan(0.98);
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  }

  await dialog.getByRole("button", { name: /Keep searching/i }).click();
  await expect(dialog).toHaveCount(0);
});
