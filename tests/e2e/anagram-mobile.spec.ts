import { expect, test, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const PUZZLE_ID = "e2e-anagram-blitz";
const ANAGRAM_DATA = {
  words: ["CAT", "CODE"],
  timeLimit: 120,
  hint: "Short test words",
};

const LONG_ANAGRAM_DATA = {
  words: [
    "ABCDEFGHIJ",
    "AABBCCDDEEFFGG",
    "ABCDEFGHIJKLMNOPQR",
    "BALLOON",
    "BOOKKEEPER",
    "MISSISSIPPI",
    "PUZZLE",
    "KEYBOARD",
    "LANDSCAPE",
    "ACCESSIBLE",
    "TOUCHSCREEN",
    "CELEBRATION",
  ],
  timeLimit: 180,
  hint: "Deterministic layout fixtures",
};

async function authenticateProtectedRoute(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const sessionToken = await encode({
    secret,
    maxAge: 60 * 60,
    token: {
      sub: "e2e-user",
      id: "e2e-user",
      name: "Anagram Tester",
      email: "anagram@example.test",
      role: "user",
      betaApproved: true,
    },
  });
  await page.context().addCookies([{
    name: "next-auth.session-token",
    value: sessionToken,
    url: "http://localhost:3000",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function installAnagramFixture(page: Page, anagramData = ANAGRAM_DATA) {
  let solved = false;
  let attemptSuccessCount = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/\/$/, "");
    const method = request.method();
    const fulfill = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(body),
    });

    if (path === "/api/auth/session") {
      await fulfill({
        user: { id: "e2e-user", name: "Anagram Tester", email: "anagram@example.test" },
        expires: "2099-01-01T00:00:00.000Z",
      });
      return;
    }

    if (path === `/api/puzzles/${PUZZLE_ID}`) {
      await fulfill({
        id: PUZZLE_ID,
        title: "Anagram Blitz E2E",
        description: "Deterministic Anagram Blitz",
        content: "",
        difficulty: "medium",
        puzzleType: "anagram_blitz",
        xpReward: 100,
        solutions: [{ points: 100 }],
        data: anagramData,
        category: { name: "Word Games" },
        media: [],
        userHistory: [],
      });
      return;
    }

    if (path === `/api/puzzles/${PUZZLE_ID}/progress`) {
      if (method === "POST") {
        const body = request.postDataJSON() as { action?: string };
        if (body.action === "attempt_success") {
          attemptSuccessCount += 1;
          solved = true;
        }
      }
      await fulfill({
        id: "e2e-anagram-progress",
        userId: "e2e-user",
        puzzleId: PUZZLE_ID,
        solved,
        attempts: solved ? 1 : 0,
        pointsEarned: solved ? 100 : 0,
        successfulAttempts: solved ? 1 : 0,
        completionPercentage: solved ? 100 : 0,
        sessionLogs: [],
        partProgress: [],
      });
      return;
    }

    if (path === `/api/puzzles/${PUZZLE_ID}/hints`) {
      await fulfill({ hints: [], hintTokens: 0, skipTokens: 0 });
      return;
    }

    if (path === `/api/puzzles/${PUZZLE_ID}/comparison-stats`) {
      await fulfill({ percentile: 50, averageTime: 30, totalSolves: 1 });
      return;
    }

    if (path === "/api/user/info") {
      await fulfill({ id: "e2e-user", totalXp: 0, activeSkin: "default" });
      return;
    }

    if (path === "/api/user/profile") {
      await fulfill({ activeSkin: "default", activeCompletionAnimation: "default" });
      return;
    }

    await fulfill({});
  });

  return { getAttemptSuccessCount: () => attemptSuccessCount };
}

async function openAnagram(page: Page, anagramData = ANAGRAM_DATA) {
  await authenticateProtectedRoute(page);
  const fixture = await installAnagramFixture(page, anagramData);
  await page.goto(`/puzzles/${PUZZLE_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("anagram-root")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("anagram-current-entry")).toBeVisible();
  return fixture;
}

async function expectNoDocumentOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
}

async function expectNoDocumentScroll(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
}

async function expectPracticalTileTargets(page: Page, answerLength: number) {
  await expect(page.locator(".anagram-letter-tile")).toHaveCount(answerLength);
  await expect(page.locator(".anagram-answer-slot")).toHaveCount(answerLength);
  const sizes = await page.locator(".anagram-letter-tile, .anagram-answer-slot").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    })
  );
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
  const submit = page.getByRole("button", { name: "Submit" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  const submitBox = await submit.boundingBox();
  const viewport = page.viewportSize();
  expect(submitBox).not.toBeNull();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
  await expectNoDocumentScroll(page);
}

async function expectActiveGameFits(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const locator of [
    page.getByTestId("anagram-root"),
    page.getByTestId("anagram-letter-tray"),
    page.getByTestId("anagram-answer-slots"),
    page.getByTestId("anagram-controls"),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  }
}

async function enterAnswer(page: Page, answer: string) {
  await page.getByTestId("anagram-game-surface").focus();
  for (const letter of answer) await page.keyboard.press(letter);
  await page.keyboard.press("Enter");
}

const MOBILE_VIEWPORTS = [
  { label: "360x800", width: 360, height: 800 },
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
  { label: "landscape-844x390", width: 844, height: 390 },
];

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`Anagram Blitz mobile layout @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true });

    test("fits without native input and supports touch plus hardware Backspace", async ({ page }) => {
      await openAnagram(page);
      await expect(page.locator(".anagram-root input")).toHaveCount(0);
      await expect(page.getByTestId("anagram-game-surface")).toBeFocused();
      await expect(page.locator('.pw-play-header [aria-label^="Remaining time"]')).toBeVisible();
      await expectNoDocumentOverflow(page);
      await expectActiveGameFits(page);

      const availableTile = page.locator('.anagram-letter-tile:not([data-used="true"])').first();
      await availableTile.click();
      await expect(page.locator('.anagram-answer-slot[data-filled="true"]')).toHaveCount(1);
      await page.keyboard.press("Backspace");
      await expect(page.locator('.anagram-answer-slot[data-filled="true"]')).toHaveCount(0);
    });
  });

  test.describe(`Anagram Blitz long-word layout @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true });

    test("keeps 10, 14, and 18-character targets practical with 12 progress indicators", async ({ page }) => {
      await openAnagram(page, LONG_ANAGRAM_DATA);
      await expect(page.locator(".anagram-progress-dots > span")).toHaveCount(12);
      await expectPracticalTileTargets(page, 10);

      await page.getByRole("button", { name: "Pass" }).click();
      await expect(page.getByTestId("anagram-current-entry")).toHaveAttribute("data-entry-id", `${PUZZLE_ID}-word-1`);
      await expectPracticalTileTargets(page, 14);

      await page.getByRole("button", { name: "Pass" }).click();
      await expect(page.getByTestId("anagram-current-entry")).toHaveAttribute("data-entry-id", `${PUZZLE_ID}-word-2`);
      await expectPracticalTileTargets(page, 18);
      await expect(page.getByTestId("anagram-current-entry")).toHaveCSS("overflow-y", "auto");
    });
  });
}

test.describe("Anagram Blitz interactions", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("Pass, Shuffle, Report Bug, and parent-owned completion remain wired", async ({ page }) => {
    const fixture = await openAnagram(page);
    const trayIds = async () => page.locator(".anagram-letter-tile").evaluateAll((tiles) =>
      tiles.map((tile) => (tile as HTMLElement).dataset.tileId)
    );
    const beforeShuffle = await trayIds();
    await page.getByRole("button", { name: "Shuffle" }).click();
    const afterShuffle = await trayIds();
    expect(new Set(afterShuffle)).toEqual(new Set(beforeShuffle));
    expect(afterShuffle).not.toEqual(beforeShuffle);

    const firstEntry = await page.getByTestId("anagram-current-entry").getAttribute("data-entry-id");
    await page.getByRole("button", { name: "Pass" }).click();
    await expect(page.getByTestId("anagram-current-entry")).not.toHaveAttribute("data-entry-id", firstEntry ?? "");

    await page.getByRole("button", { name: "More puzzle actions" }).click();
    const menu = page.getByRole("menu");
    await menu.getByRole("menuitem", { name: "Report Bug" }).click();
    await expect(menu).toBeHidden();
    const reportDialog = page.getByRole("dialog", { name: "Report a bug" });
    await expect(reportDialog).toBeVisible();
    await reportDialog.getByRole("button", { name: /close/i }).click();

    await enterAnswer(page, "CODE");
    await expect(page.locator('[data-testid="puzzle-header-subtitle"]')).toContainText("1 / 2 solved");
    await expect(page.getByTestId("anagram-current-entry")).toHaveAttribute("data-entry-id", `${PUZZLE_ID}-word-0`);
    await enterAnswer(page, "CAT");
    await expect(page.getByTestId("anagram-win-state")).toBeVisible();
    await expect.poll(fixture.getAttemptSuccessCount).toBe(1);
    await page.waitForTimeout(300);
    expect(fixture.getAttemptSuccessCount()).toBe(1);
  });

  test("initiates parent completion before an immediate navigation", async ({ page }) => {
    const fixture = await openAnagram(page, { words: ["CAT"], timeLimit: 60, hint: "Navigate away" });
    await page.getByTestId("anagram-game-surface").focus();
    await page.keyboard.press("C");
    await page.keyboard.press("A");
    await page.keyboard.press("T");
    const completionRequest = page.waitForRequest((request) => {
      if (request.method() !== "POST") return false;
      if (new URL(request.url()).pathname !== `/api/puzzles/${PUZZLE_ID}/progress`) return false;
      return (request.postDataJSON() as { action?: string }).action === "attempt_success";
    });
    await page.keyboard.press("Enter");
    await page.goto("/puzzles", { waitUntil: "domcontentloaded" });
    await completionRequest;
    await expect.poll(fixture.getAttemptSuccessCount).toBe(1);
  });
});

test.describe("Anagram Blitz desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

  test("keeps the centered tile board and hardware keyboard input", async ({ page }) => {
    await openAnagram(page);
    await expect(page.locator(".anagram-root input")).toHaveCount(0);
    await enterAnswer(page, "CAT");
    await expect(page.locator('[data-testid="puzzle-header-subtitle"]')).toContainText("1 / 2 solved");
    const rootBox = await page.getByTestId("anagram-root").boundingBox();
    expect(rootBox!.width).toBeLessThanOrEqual(860);
    await expectNoDocumentOverflow(page);
  });
});
