import { test, expect, type Page } from '@playwright/test';

// Mobile puzzle shell smoke coverage — confirms AppChrome + PuzzlePlayShell hand
// off cleanly across breakpoints without needing an authenticated session: the
// signed-out "Sign in to play" gate on each daily play route already renders
// inside the shell, so it's enough to assert on chrome, not puzzle content.
//
// NOTE: this is a real Playwright spec (not a Jest test, unlike the other
// *.spec.ts files in this directory) — run via `npx playwright test`, not
// `npm test`. It is intentionally excluded from jest.config.js's test match.

const PLAY_ROUTES = ['/daily/crossword', '/daily/sudoku'];
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

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`mobile puzzle shell @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of PLAY_ROUTES) {
      test(`${route}: exactly one visible top header, no bottom nav`, async ({ page }) => {
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
        const backBox = await page.locator('.pw-play-header-back').boundingBox();
        expect(backBox?.width).toBeGreaterThanOrEqual(48);
        expect(backBox?.height).toBeGreaterThanOrEqual(48);
      });
    }

    test('/puzzles/nonexistent-id: unauthenticated visitors are redirected to sign in (pre-existing auth gate, unaffected by the shell)', async ({ page }) => {
      await page.goto('/puzzles/nonexistent-id', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/auth\/signin/, { timeout: 10000 });
      expect(page.url()).toContain('/auth/signin');
    });
  });
}

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
