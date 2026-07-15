import { test, expect, type Page } from '@playwright/test';

// Mobile puzzle shell smoke coverage — confirms AppChrome + PuzzlePlayShell hand
// off cleanly across breakpoints and app modes without needing an authenticated
// session: the signed-out "Sign in to play" gate on each daily play route
// already renders inside the shell, so it's enough to assert on chrome, not
// puzzle content.
//
// NOTE: this is a real Playwright spec (not a Jest test, unlike the other
// *.spec.ts files in this directory) — run via `npx playwright test`, not
// `npm test`. It is intentionally excluded from jest.config.js's test match.

const PLAY_ROUTES = ['/daily/crossword', '/daily/sudoku', '/daily/word', '/daily/word-search', '/daily/jigsaw'];
const MOBILE_VIEWPORTS: Array<{ label: string; width: number; height: number }> = [
  { label: '360x800', width: 360, height: 800 },
  { label: '390x844', width: 390, height: 844 },
  { label: '430x932', width: 430, height: 932 },
];

async function countVisible(page: Page, selector: string): Promise<number> {
  const locator = page.locator(selector);
  const total = await locator.count();
  let visible = 0;
  for (let i = 0; i < total; i++) {
    if (await locator.nth(i).isVisible()) visible++;
  }
  return visible;
}

/** document width must never exceed the viewport — a 1px tolerance absorbs scrollbar rounding. */
async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`mobile puzzle shell @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of PLAY_ROUTES) {
      test(`${route}: exactly one visible top header, no bottom nav, no overflow`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });

        const playHeaderCount = await countVisible(page, '.pw-play-header');
        expect(playHeaderCount).toBe(1);

        // The browse-mode global navbar must be fully cleared on mobile in play mode —
        // not just partially collapsed — so it doesn't stack with the puzzle header.
        const globalNavVisible = await page.locator('#global-nav').isVisible().catch(() => false);
        expect(globalNavVisible).toBe(false);

        const bottomNavVisible = await page.locator('.pw-bottom-nav').isVisible().catch(() => false);
        expect(bottomNavVisible).toBe(false);

        // 48px minimum touch target on the header's back control.
        const backBox = await page.locator('[data-testid="puzzle-header-back"]').boundingBox();
        expect(backBox?.width).toBeGreaterThanOrEqual(48);
        expect(backBox?.height).toBeGreaterThanOrEqual(48);

        // Title is always present and stable via data-testid.
        await expect(page.locator('[data-testid="puzzle-header-title"]')).toBeVisible();

        await expectNoHorizontalOverflow(page);
      });
    }

    test('/puzzles/nonexistent-id: unauthenticated visitors are redirected to sign in (pre-existing auth gate, unaffected by the shell)', async ({ page }) => {
      await page.goto('/puzzles/nonexistent-id', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/auth\/signin/, { timeout: 10000 });
      expect(page.url()).toContain('/auth/signin');
    });
  });
}

test.describe('browse-mode chrome', () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test.describe(`@ ${viewport.label}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      // /puzzles, /leaderboards, /search etc. redirect guests to sign-in (a pre-existing
      // auth gate, not a chrome bug) — stick to routes that are genuinely guest-browsable.
      for (const route of ['/', '/daily', '/faq']) {
        test(`${route}: navbar + bottom nav visible, no overflow`, async ({ page }) => {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await expect(page.locator('#global-nav')).toBeVisible();
          await expect(page.locator('.pw-bottom-nav')).toBeVisible();
          await expectNoHorizontalOverflow(page);
        });
      }
    });
  }

  test('desktop: navbar visible, bottom nav hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/daily', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#global-nav')).toBeVisible();
    await expect(page.locator('.pw-bottom-nav')).not.toBeVisible();
  });
});

test.describe('auth-mode chrome', () => {
  const AUTH_ROUTES = ['/auth/signin', '/auth/register'];

  for (const viewport of MOBILE_VIEWPORTS) {
    test.describe(`@ ${viewport.label}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of AUTH_ROUTES) {
        test(`${route}: no navbar, no bottom nav, no promo banner, no overflow`, async ({ page }) => {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(900); // EarlyAccessBanner has a 600ms mount delay when eligible

          await expect(page.locator('#global-nav')).not.toBeVisible();
          await expect(page.locator('.pw-bottom-nav')).not.toBeVisible();
          await expect(page.getByText('Puzzle Warz is in Early Access')).not.toBeVisible();

          await expectNoHorizontalOverflow(page);
        });
      }
    });
  }

  test('desktop: still no navbar on auth routes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/auth/signin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#global-nav')).not.toBeVisible();
    await expect(page.locator('.pw-bottom-nav')).not.toBeVisible();
  });
});

test.describe('desktop retains the standard navbar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const route of PLAY_ROUTES) {
    test(`${route}: global navbar visible on desktop`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#global-nav')).toBeVisible();
      await expect(page.locator('.pw-bottom-nav')).not.toBeVisible();
      // The puzzle shell's own compact header still renders below the navbar on desktop.
      await expect(page.locator('.pw-play-header')).toBeVisible();
    });
  }

  test('browse routes are unaffected: navbar + bottom nav hidden appropriately', async ({ page }) => {
    await page.goto('/daily', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#global-nav')).toBeVisible();
    await expect(page.locator('.pw-bottom-nav')).not.toBeVisible();
  });
});
