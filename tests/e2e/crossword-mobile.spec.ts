import { expect, test, type Page } from "@playwright/test";

const PUZZLE_ID = "e2e-crossword-mobile";
const GRID_SIZE = 15;

const lettersForRow = (row: number) => Array.from({ length: GRID_SIZE }, (_, col) =>
  String.fromCharCode(65 + ((row + col) % 26))
).join("");

const crosswordData = {
  rows: GRID_SIZE,
  cols: GRID_SIZE,
  clues: {
    across: Array.from({ length: GRID_SIZE }, (_, row) => ({
      number: row === 0 ? 1 : GRID_SIZE + row,
      text: `Across clue ${row === 0 ? 1 : GRID_SIZE + row} with deterministic text`,
      length: GRID_SIZE,
      row,
      col: 0,
    })),
    down: Array.from({ length: GRID_SIZE }, (_, col) => ({
      number: col + 1,
      text: `Down clue ${col + 1} with deterministic text`,
      length: GRID_SIZE,
      row: 0,
      col,
    })),
  },
};

const expectedAnswers = new Map<string, string>([
  ...crosswordData.clues.across.map((clue) => [`across:${clue.number}`, lettersForRow(clue.row)] as const),
  ...crosswordData.clues.down.map((clue) => [
    `down:${clue.number}`,
    Array.from({ length: GRID_SIZE }, (_, row) => lettersForRow(row)[clue.col]).join(""),
  ] as const),
]);

async function installAuthenticatedCrosswordFixture(page: Page) {
  const solved = new Set<string>();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.replace(/\/$/, "") === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({
          user: { id: "e2e-user", name: "Crossword Tester", email: "crossword@example.test" },
          expires: "2099-01-01T00:00:00.000Z",
        }),
      });
      return;
    }

    if (url.pathname === "/api/daily/crossword/content") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true, dayNumber: 142, puzzleId: PUZZLE_ID }),
      });
      return;
    }

    if (url.pathname === "/api/daily/crossword/complete") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(method === "GET"
          ? {
              completedToday: false,
              streak: 7,
              streakDay: 7,
              nextReward: { points: 70, xp: 35, streakDay: 7 },
              streakShields: 0,
              skipTokens: 0,
            }
          : { success: true, reward: { points: 70, xp: 35, streakDay: 7 } }),
      });
      return;
    }

    if (url.pathname === `/api/puzzles/${PUZZLE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: PUZZLE_ID, puzzleType: "crossword", data: crosswordData }),
      });
      return;
    }

    if (url.pathname === `/api/puzzles/${PUZZLE_ID}/crossword`) {
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            solvedClues: [...solved],
            solvedCount: solved.size,
            totalClues: expectedAnswers.size,
            allSolved: false,
            letters: null,
            revealedCells: [],
            activeClue: null,
            elapsedMs: 0,
            savedAt: null,
          }),
        });
        return;
      }

      if (method === "PATCH") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: true }) });
        return;
      }

      const body = request.postDataJSON() as { direction: "across" | "down"; number: number; answer: string };
      const key = `${body.direction}:${body.number}`;
      const correct = expectedAnswers.get(key) === body.answer;
      if (correct) solved.add(key);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ correct, allSolved: false, solvedCount: solved.size, totalClues: expectedAnswers.size }),
      });
      return;
    }

    if (url.pathname === "/api/user/info") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e-user", activeSkin: "default" }) });
      return;
    }

    await route.continue();
  });
}

async function openPlayableCrossword(page: Page) {
  await installAuthenticatedCrosswordFixture(page);
  await page.goto("/daily/crossword", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("grid", { name: /crossword grid/i })).toBeVisible();
  const start = page.getByRole("button", { name: /start/i });
  if (await start.isVisible().catch(() => false)) await start.click();
}

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function expectGameplayFits(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const locator of [
    page.getByRole("grid", { name: /crossword grid/i }),
    page.locator(".crossword-active-dock"),
    page.getByTestId("crossword-keyboard"),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  }
}

const MOBILE_VIEWPORTS = [
  { label: "360x800", width: 360, height: 800 },
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
  { label: "landscape-844x390", width: 844, height: 390 },
];

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`playable mobile crossword @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true });

    test("fits, uses the custom keyboard, and preserves crossword navigation", async ({ page }) => {
      await openPlayableCrossword(page);

      await expect(page.getByTestId("crossword-keyboard")).toBeVisible();
      await expect(page.getByRole("heading", { name: "CROSSWORD" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Open crossword clues" })).toBeHidden();
      await expect(page.getByRole("button", { name: "How to play crossword" })).toBeVisible();
      await expect(page.getByRole("button", { name: "More puzzle actions" })).toHaveCount(0);
      await expect(page.locator('[data-testid="puzzle-header-subtitle"]')).toContainText("#142 · 🔥 7");
      await expectNoDocumentOverflow(page);
      await expectGameplayFits(page);

      const firstCell = page.locator('[role="gridcell"][aria-rowindex="1"][aria-colindex="1"]');
      const secondCell = page.locator('[role="gridcell"][aria-rowindex="1"][aria-colindex="2"]');
      await firstCell.click();
      await expect(page.getByTestId("crossword-game-surface")).toBeFocused();
      await expect(page.locator('input[aria-label="Crossword input"]')).not.toBeFocused();

      // A coarse-pointer layout keeps Bluetooth/hardware keyboard input on the
      // focusable game surface without involving the hidden text input.
      await page.keyboard.press("C");
      await expect(secondCell).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Backspace");
      await expect(firstCell).toHaveAttribute("aria-selected", "true");
      await expect(firstCell).toHaveAttribute("aria-label", /empty/);

      await page.getByTestId("crossword-key-A").click();
      await expect(secondCell).toHaveAttribute("aria-selected", "true");
      await expect(page.getByTestId("crossword-game-surface")).toBeFocused();

      await page.getByTestId("crossword-key-B").click();
      await page.getByTestId("crossword-key-backspace").click();
      await expect(secondCell).toHaveAttribute("aria-selected", "true");
      await expect(secondCell).toHaveAttribute("aria-label", /empty/);

      await firstCell.click();
      await firstCell.click();
      await expect(page.locator(".crossword-active-dock-label")).toContainText(/1 down/i);

      const beforeNext = await page.locator(".crossword-active-dock-label").textContent();
      await page.getByRole("button", { name: "Next clue" }).click();
      await expect(page.locator(".crossword-active-dock-label")).not.toHaveText(beforeNext ?? "");
      await page.getByRole("button", { name: "Previous clue" }).click();

      await page.getByRole("button", { name: "Open all clues" }).click();
      const sheet = page.getByRole("dialog", { name: "Crossword clues" });
      await expect(sheet).toBeVisible();
      const clueList = sheet.locator(".crossword-clue-sheet-list");
      expect(await clueList.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await sheet.getByRole("tab", { name: /down/i }).click();
      const lastClue = sheet.getByRole("button", { name: /15 Down clue 15/i });
      await lastClue.scrollIntoViewIfNeeded();
      await lastClue.click();
      await expect(sheet).toBeHidden();
      await expect(page.getByTestId("crossword-game-surface")).toBeFocused();
      await expect(page.locator(".crossword-active-dock-label")).toContainText(/15 down/i);

      const activeDockBox = await page.locator(".crossword-active-dock").boundingBox();
      expect(activeDockBox!.y + activeDockBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    });
  });
}

test.describe("playable desktop crossword", () => {
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

  test("keeps hardware keyboard support and the desktop clue panel", async ({ page }) => {
    await openPlayableCrossword(page);
    await expect(page.getByTestId("crossword-keyboard")).toBeHidden();
    await expect(page.locator(".crossword-desktop-clue-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open crossword clues" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CROSSWORD" })).toHaveCount(0);

    const firstCell = page.locator('[role="gridcell"][aria-rowindex="1"][aria-colindex="1"]');
    const secondCell = page.locator('[role="gridcell"][aria-rowindex="1"][aria-colindex="2"]');
    await firstCell.click();
    await page.keyboard.type("A");
    await expect(secondCell).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Open crossword clues" }).click();
    await expect(page.locator(".crossword-desktop-clue-panel").getByRole("button", { name: /^1\./ })).toBeFocused();
    await expectNoDocumentOverflow(page);
  });
});
