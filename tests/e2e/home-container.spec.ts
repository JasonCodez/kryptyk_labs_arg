import { expect, test, type Page } from "@playwright/test";

// Pass 2 (site redesign): shared PageContainer adoption on the homepage.
// Purely a geometry/chrome check — the Daily summary API is mocked with a
// deterministic fixture so this spec never depends on a live database or an
// existing user account (the homepage is guest-browsable).
//
// NOTE: this is a real Playwright spec (not a Jest test) — run via
// `npx playwright test`, not `npm test`.

const DAILY_SUMMARY_FIXTURE = {
  word: { dayNumber: 200, completedToday: false, streak: 0, available: true },
  sudoku: { dayNumber: 200, completedToday: false, streak: 0, available: true },
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

async function containerGutters(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]`).evaluate((el) => {
    const style = getComputedStyle(el);
    return { paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight) };
  });
}

test.describe("Homepage containers — mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders with browse-mode chrome and three visible, gutter-correct containers", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appMode)).toBe("browse");

    const hero = page.locator('[data-testid="home-hero-container"]');
    const feature = page.locator('[data-testid="home-feature-container"]');
    const footer = page.locator('[data-testid="home-footer-container"]');
    await expect(hero).toBeVisible();
    await expect(feature).toBeVisible();
    await expect(footer.first()).toBeAttached();

    for (const testId of ["home-hero-container", "home-feature-container", "home-footer-container"]) {
      const box = await page.locator(`[data-testid="${testId}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);

      const gutters = await containerGutters(page, testId);
      expect(gutters.paddingLeft).toBeCloseTo(16, 0);
      expect(gutters.paddingRight).toBeCloseTo(16, 0);
    }

    // Feature cards remain reachable and keep their expected destinations.
    await expect(page.getByRole("link", { name: /View Daily Puzzles/ })).toHaveAttribute("href", "/daily");
    await expect(page.getByRole("link", { name: /Open Catalog/ })).toHaveAttribute("href", "/puzzles");
    // Guest (no session): the Warz card's CTA points at registration, not /warz.
    await expect(page.getByRole("link", { name: /Create Account/ })).toHaveAttribute("href", "/auth/register");

    // Footer remains reachable by scrolling.
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Sign In" })).toBeVisible();

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Homepage containers — narrow mobile 320x710", () => {
  test.use({ viewport: { width: 320, height: 710 } });

  test("no overflow, single-column feature stack, footer wraps cleanly, bottom nav clears footer content", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const hero = page.locator('[data-testid="home-hero-container"]');
    const heroBox = await hero.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox!.x).toBeGreaterThanOrEqual(0);
    expect(heroBox!.x + heroBox!.width).toBeLessThanOrEqual(320 + 1);

    // sm:grid-cols-3 only applies at the sm breakpoint (>=640px) — below that the
    // feature grid's base grid-cols-1 keeps cards stacked single-column.
    const cardLinks = page.locator('[data-testid="home-feature-container"] a');
    const count = await cardLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    const boxes = await Promise.all(Array.from({ length: count }, (_, i) => cardLinks.nth(i).boundingBox()));
    for (let i = 1; i < boxes.length; i++) {
      // Stacked cards: each later card starts at or below the previous one's bottom.
      expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y);
    }

    await expectNoHorizontalOverflow(page);

    const footer = page.locator('[data-testid="home-footer-container"]');
    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expectNoHorizontalOverflow(page);

    const copyrightLine = page.getByText("All rights reserved");
    await expect(copyrightLine).toBeVisible();
    const copyrightBox = await copyrightLine.boundingBox();
    const bottomNavBox = await page.locator(".pw-bottom-nav").boundingBox();
    expect(copyrightBox).not.toBeNull();
    expect(bottomNavBox).not.toBeNull();
    // The final footer content must sit above the bottom nav bar, not underneath it.
    expect(copyrightBox!.y + copyrightBox!.height).toBeLessThanOrEqual(bottomNavBox!.y + 1);
  });
});

test.describe("Homepage containers — large mobile 430x932", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("no overflow, consistent gutters, browse-mode navigation", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).toBeVisible();

    for (const testId of ["home-hero-container", "home-feature-container", "home-footer-container"]) {
      const gutters = await containerGutters(page, testId);
      expect(gutters.paddingLeft).toBeCloseTo(16, 0);
      expect(gutters.paddingRight).toBeCloseTo(16, 0);
    }

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Homepage containers — desktop 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("hero is narrower and centered, feature/footer share identical centered geometry", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#global-nav")).toBeVisible();
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();

    const heroBox = await page.locator('[data-testid="home-hero-container"]').boundingBox();
    const featureBox = await page.locator('[data-testid="home-feature-container"]').boundingBox();
    const footerBox = await page.locator('[data-testid="home-footer-container"]').boundingBox();
    expect(heroBox).not.toBeNull();
    expect(featureBox).not.toBeNull();
    expect(footerBox).not.toBeNull();

    const viewportCenter = 1440 / 2;
    const tolerance = 2;

    // Hero (reading tier, lg:max-w-2xl = 672px) is horizontally centered.
    expect(heroBox!.x + heroBox!.width / 2).toBeCloseTo(viewportCenter, 0);
    expect(heroBox!.width).toBeGreaterThan(640);
    expect(heroBox!.width).toBeLessThan(704);

    // Feature (content tier, lg:max-w-4xl = 896px) is horizontally centered.
    expect(featureBox!.x + featureBox!.width / 2).toBeCloseTo(viewportCenter, 0);

    // Footer shares the same content-tier geometry as the feature strip.
    expect(footerBox!.x + footerBox!.width / 2).toBeCloseTo(viewportCenter, 0);
    expect(Math.abs(featureBox!.width - footerBox!.width)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(featureBox!.x - footerBox!.x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((featureBox!.x + featureBox!.width) - (footerBox!.x + footerBox!.width))).toBeLessThanOrEqual(tolerance);

    // The content tier is meaningfully wider than the reading tier.
    expect(featureBox!.width).toBeGreaterThan(heroBox!.width);

    await expectNoHorizontalOverflow(page);
  });
});
