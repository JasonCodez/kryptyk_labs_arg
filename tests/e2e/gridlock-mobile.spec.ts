import { expect, test, type Page } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { encode } from 'next-auth/jwt';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ path: '.env', override: false, quiet: true });

const PUZZLE_ID = 'e2e-gridlock';
const publicPuzzle = {
  schemaVersion: 2,
  answerMode: 'selection',
  fileNumber: 42,
  fileTitle: 'Relay Evidence',
  flavorText: 'A compact signal ledger.',
  objective: 'Mark the two linked records.',
  gridType: 'logic',
  rows: 2,
  columns: 2,
  requiredSelections: 2,
  maximumAttempts: 3,
  grid: [
    [{ id: 'alpha', label: 'Alpha', value: 'Alpha' }, { id: 'beta', label: 'Beta', value: 'Beta' }],
    [{ id: 'gamma', label: 'Gamma', value: 'Gamma' }, { id: 'delta', label: 'Delta', value: 'Delta', locked: true }],
  ],
  rules: [{ id: 'rule-1', type: 'constraint', text: 'Linked records share a relay signature.', relatedCellIds: [], displayOrder: 0, initiallyVisible: true }],
};

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for protected-route browser tests');
  const token = await encode({ secret, maxAge: 3600, token: { sub: 'e2e-user', id: 'e2e-user', name: 'Gridlock Tester', email: 'gridlock@example.test', role: 'user', betaApproved: true } });
  await page.context().addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://localhost:3000', httpOnly: true, sameSite: 'Lax' }]);
  await page.addInitScript(() => localStorage.setItem('gridlock:onboarding:v1', 'seen'));
}

async function installRoutes(page: Page) {
  let solved = false;
  let attempts = 0;
  let submitCount = 0;
  let failNextSubmit = false;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/\/$/, '');
    const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) });
    if (path === '/api/auth/session') return fulfill({ user: { id: 'e2e-user', email: 'gridlock@example.test', name: 'Gridlock Tester' }, expires: '2099-01-01T00:00:00.000Z' });
    if (path === `/api/puzzles/${PUZZLE_ID}`) return fulfill({ id: PUZZLE_ID, title: 'Relay Evidence', description: 'Gridlock E2E', puzzleType: 'gridlock_file', difficulty: 'medium', xpReward: 100, solutions: [{ points: 100 }], data: { gridlockFile: publicPuzzle }, category: { name: 'Logic' }, media: [], userHistory: [] });
    if (path === `/api/puzzles/${PUZZLE_ID}/gridlock/state`) return fulfill({ puzzleId: PUZZLE_ID, puzzle: publicPuzzle, solved, submissionCount: attempts, hintsUsed: 0, ruleExplanation: solved ? 'Alpha and Gamma share the signature.' : null });
    if (path === `/api/puzzles/${PUZZLE_ID}/gridlock/submit` && method === 'POST') {
      submitCount += 1;
      if (failNextSubmit) { failNextSubmit = false; return fulfill({ error: 'Offline' }, 503); }
      attempts += 1;
      const answers = (request.postDataJSON() as { answers: string[] }).answers;
      solved = answers.length === 2 && answers.includes('alpha') && answers.includes('gamma');
      return fulfill({ correct: solved, submissionCount: attempts, rank: solved ? 'A' : 'C', ruleExplanation: solved ? 'Alpha and Gamma share the signature.' : undefined });
    }
    if (path === `/api/puzzles/${PUZZLE_ID}/progress`) return fulfill({ id: 'progress', puzzleId: PUZZLE_ID, solved, attempts, pointsEarned: solved ? 100 : 0, completionPercentage: solved ? 100 : 0, sessionLogs: [], partProgress: [] });
    if (path === `/api/puzzles/${PUZZLE_ID}/hints`) return fulfill({ hints: [], hintTokens: 0, skipTokens: 0 });
    if (path === '/api/user/info') return fulfill({ id: 'e2e-user', username: 'gridlock-tester', totalPoints: 0, totalXp: 0 });
    if (path === '/api/user/profile') return fulfill({ activeSkin: 'default', activeCompletionAnimation: 'default' });
    if (path === '/api/warz/check-eligible') return fulfill({ eligible: true });
    if (path.includes('/comparison-stats')) return fulfill({ percentile: 50, averageTime: 30, totalSolves: 1 });
    return fulfill({});
  });
  return { failNext: () => { failNextSubmit = true; }, submitCount: () => submitCount };
}

test.describe('Gridlock mobile play shell', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('fits the phone viewport, keeps controls reachable, and exposes no answer key', async ({ page }) => {
    await installRoutes(page);
    await page.goto(`/puzzles/${PUZZLE_ID}`);
    await expect(page.getByRole('grid', { name: /Relay Evidence/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight }));
    expect(dimensions.docWidth).toBeLessThanOrEqual(dimensions.width + 1);
    expect(dimensions.docHeight).toBeLessThanOrEqual(dimensions.height + 1);
    await expect(page.getByRole('button', { name: 'VERIFY EVIDENCE' })).toBeInViewport();
    const html = await page.locator('.gridlock-console').evaluate(node => node.outerHTML);
    expect(html).not.toContain('correctAnswers');
    expect(html).not.toContain('Alpha and Gamma share');
  });

  test('keeps the board and command controls usable at 320 by 568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installRoutes(page);
    await page.goto(`/puzzles/${PUZZLE_ID}`);
    await expect(page.getByRole('grid')).toBeVisible();
    await expect(page.getByRole('button', { name: 'VERIFY EVIDENCE' })).toBeInViewport();
    const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight }));
    expect(metrics.docWidth).toBeLessThanOrEqual(metrics.width + 1);
    expect(metrics.docHeight).toBeLessThanOrEqual(metrics.height + 1);
    const targetHeights = await page.locator('.gridlock-command-bar button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    targetHeights.forEach(height => expect(height).toBeGreaterThanOrEqual(44));
  });

  test('supports one-hand selection and keyboard navigation', async ({ page }) => {
    await installRoutes(page);
    await page.goto(`/puzzles/${PUZZLE_ID}`);
    const alpha = page.getByRole('gridcell', { name: /Alpha/ });
    await alpha.tap();
    await expect(alpha).toHaveAttribute('aria-selected', 'true');
    await alpha.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-cell-id="gamma"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('2/2 marked')).toBeVisible();
  });

  test('retains the solved board and retries with the same completion path after a network failure', async ({ page }) => {
    const controls = await installRoutes(page);
    controls.failNext();
    await page.goto(`/puzzles/${PUZZLE_ID}`);
    await page.getByRole('gridcell', { name: /Alpha/ }).tap();
    await page.getByRole('gridcell', { name: /Gamma/ }).tap();
    await page.getByRole('button', { name: 'VERIFY EVIDENCE' }).tap();
    await expect(page.getByRole('button', { name: 'RETRY CONFIRMATION' })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'RETRY CONFIRMATION' }).tap();
    await expect(page.getByText('MATCH CONFIRMED', { exact: true })).toBeVisible();
    await expect(page.getByText('DECLASSIFIED RULE')).toBeVisible({ timeout: 5000 });
    expect(controls.submitCount()).toBe(2);
  });
});
