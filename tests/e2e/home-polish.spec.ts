import { expect, test, type Page } from "@playwright/test";

// Pass 3 (site redesign): homepage hierarchy + Daily hero polish. Purely a
// presentation/geometry check — the Daily summary API is mocked with a
// deterministic fixture (two of five complete, a positive streak) so this
// spec never depends on a live database or an existing user account.
//
// NOTE: this is a real Playwright spec (not a Jest test) — run via
// `npx playwright test`, not `npm test`.

const DAILY_SUMMARY_FIXTURE = {
  word: { dayNumber: 200, completedToday: true, streak: 5, available: true },
  sudoku: { dayNumber: 200, completedToday: true, streak: 3, available: true },
  crossword: { dayNumber: 200, completedToday: false, streak: 0, available: true },
  word_search: { dayNumber: 200, completedToday: false, streak: 0, available: true },
  jigsaw: { dayNumber: 200, completedToday: false, streak: 0, available: true },
};

async function mockDailySummary(page: Page) {
  await page.route("**/api/daily/summary", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DAILY_SUMMARY_FIXTURE) })
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

async function featureCardBoxes(page: Page) {
  const links = page.locator('[data-testid="home-feature-grid"] a');
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(3);
  return Promise.all(Array.from({ length: count }, (_, i) => links.nth(i).boundingBox()));
}

test.describe("Homepage polish — 320x710", () => {
  test.use({ viewport: { width: 320, height: 710 } });

  test("intro, Daily card, single-column features, and reachable footer all fit", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const headings = page.getByRole("heading", { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Classic puzzles. Built to compete." })).toBeVisible();

    const intro = page.locator('[data-testid="home-intro"]');
    const introBox = await intro.boundingBox();
    expect(introBox).not.toBeNull();
    expect(introBox!.x).toBeGreaterThanOrEqual(0);
    expect(introBox!.x + introBox!.width).toBeLessThanOrEqual(320 + 1);

    const dailyCard = page.locator('[data-testid="home-daily-card"]');
    await expect(dailyCard).toBeVisible();
    await expect(page.locator('[data-testid="daily-progress-segments"]')).toBeVisible();

    await expectNoHorizontalOverflow(page);

    const boxes = await featureCardBoxes(page);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height - 2);
    }

    const footer = page.locator('[data-testid="home-footer-container"]');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectNoHorizontalOverflow(page);

    const copyrightLine = page.getByText("All rights reserved");
    await expect(copyrightLine).toBeVisible();
    const copyrightBox = await copyrightLine.boundingBox();
    const bottomNavBox = await page.locator(".pw-bottom-nav").boundingBox();
    expect(copyrightBox).not.toBeNull();
    expect(bottomNavBox).not.toBeNull();
    expect(copyrightBox!.y + copyrightBox!.height).toBeLessThanOrEqual(bottomNavBox!.y + 1);
  });
});

test.describe("Homepage polish — 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("browse chrome, intro-before-Daily geometry, Daily status/CTA, and feature destinations", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).toBeVisible();

    const introBox = await page.locator('[data-testid="home-intro"]').boundingBox();
    const dailyBox = await page.locator('[data-testid="home-daily-card"]').boundingBox();
    expect(introBox).not.toBeNull();
    expect(dailyBox).not.toBeNull();
    expect(introBox!.y).toBeLessThan(dailyBox!.y);

    const dailyCard = page.locator('[data-testid="home-daily-card"]');
    await expect(dailyCard.locator('a[href="/daily"]')).toHaveCount(1);
    await expect(dailyCard).toContainText("2 of 5 complete today");
    await expect(dailyCard).toContainText("Continue Daily Run");

    await expect(page.getByRole("link", { name: /View Daily Puzzles/ })).toHaveAttribute("href", "/daily");
    await expect(page.getByRole("link", { name: /Open Catalog/ })).toHaveAttribute("href", "/puzzles");
    await expect(page.getByRole("link", { name: /Create Account/ })).toHaveAttribute("href", "/auth/register");

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Homepage polish — 430x932", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("consistent gutters, no clipped heading, progress indicator stays inside the card", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expectNoHorizontalOverflow(page);

    for (const testId of ["home-hero-container", "home-feature-container", "home-footer-container"]) {
      const gutters = await page.locator(`[data-testid="${testId}"]`).evaluate((el) => {
        const style = getComputedStyle(el);
        return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
      });
      expect(gutters.left).toBeCloseTo(16, 0);
      expect(gutters.right).toBeCloseTo(16, 0);
    }

    const heading = page.getByRole("heading", { level: 1 });
    const headingBox = await heading.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(headingBox!.x).toBeGreaterThanOrEqual(0);
    expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(430 + 1);

    const dailyBox = await page.locator('[data-testid="home-daily-card"]').boundingBox();
    const segmentsBox = await page.locator('[data-testid="daily-progress-segments"]').boundingBox();
    expect(dailyBox).not.toBeNull();
    expect(segmentsBox).not.toBeNull();
    expect(segmentsBox!.x).toBeGreaterThanOrEqual(dailyBox!.x - 1);
    expect(segmentsBox!.x + segmentsBox!.width).toBeLessThanOrEqual(dailyBox!.x + dailyBox!.width + 1);
  });
});

test.describe("Homepage polish — 844x390 landscape", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("scrollable layout, two-column features, mobile browse chrome, no dead band under the navbar", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expectNoHorizontalOverflow(page);

    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(innerHeight);

    const introBox = await page.locator('[data-testid="home-intro"]').boundingBox();
    expect(introBox).not.toBeNull();

    const dailyCard = page.locator('[data-testid="home-daily-card"]');
    await dailyCard.scrollIntoViewIfNeeded();
    await expect(dailyCard).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    const navBox = await page.locator("#global-nav").boundingBox();
    expect(navBox).not.toBeNull();
    // The preserved navbar clearance (paddingTop: calc(56px + safe-area)) is expected;
    // this only guards against an accidental much-larger empty band being introduced.
    expect(introBox!.y - (navBox!.y + navBox!.height)).toBeLessThan(80);

    const boxes = await featureCardBoxes(page);
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(4);
    expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y + 20);

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).toBeVisible();
  });
});

test.describe("Homepage polish — 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("desktop chrome, reading/content container widths, three-column feature row", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();

    const heroBox = await page.locator('[data-testid="home-hero-container"]').boundingBox();
    const introBox = await page.locator('[data-testid="home-intro"]').boundingBox();
    const dailyBox = await page.locator('[data-testid="home-daily-card"]').boundingBox();
    const featureContainerBox = await page.locator('[data-testid="home-feature-container"]').boundingBox();
    expect(heroBox).not.toBeNull();
    expect(introBox).not.toBeNull();
    expect(dailyBox).not.toBeNull();
    expect(featureContainerBox).not.toBeNull();

    // Intro and Daily card stay within the reading-width hero container.
    expect(introBox!.x).toBeGreaterThanOrEqual(heroBox!.x - 1);
    expect(introBox!.x + introBox!.width).toBeLessThanOrEqual(heroBox!.x + heroBox!.width + 1);
    expect(dailyBox!.x).toBeGreaterThanOrEqual(heroBox!.x - 1);
    expect(dailyBox!.x + dailyBox!.width).toBeLessThanOrEqual(heroBox!.x + heroBox!.width + 1);

    const boxes = await featureCardBoxes(page);
    expect(boxes[0]!.x).toBeGreaterThanOrEqual(featureContainerBox!.x - 1);
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i]!.y - boxes[0]!.y)).toBeLessThanOrEqual(4);
    }

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Homepage polish — reduced motion", () => {
  test("content stays usable with no looping CTA breathing or sparkle loop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockDailySummary(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-testid="home-intro"]')).toBeVisible();
    const dailyCard = page.locator('[data-testid="home-daily-card"]');
    await expect(dailyCard).toBeVisible();
    await expect(dailyCard.locator('a[href="/daily"]')).toHaveCount(1);

    const cta = dailyCard.locator(".game-btn--primary");
    await expect(cta).toHaveCount(1);
    // useAppReducedMotion corrects from its server snapshot (false) to the real
    // client value in a passive-effect tick after hydration — use an
    // auto-retrying assertion rather than a one-shot getAttribute() read so the
    // check doesn't race that correction.
    await expect(cta).not.toHaveClass(/animate-candy-breathe/);
    await expect(dailyCard.locator(".animate-candy-spark")).toHaveCount(0);

    await expect(page.getByRole("link", { name: /View Daily Puzzles/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Catalog/ })).toBeVisible();
  });
});
