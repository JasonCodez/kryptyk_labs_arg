import { expect, test, type Page } from "@playwright/test";

const SCRIPT_TAG_WARNING = "Encountered a script tag while rendering React component";
const SCRIPT_NEVER_EXECUTED_WARNING = "never executed";

// Generous timeout for assertions that depend on the browser having fetched
// and run the (async-loaded) Next.js client runtime that turns the queued
// beforeInteractive payload into a real script element — a route's first hit
// against the dev server (webpack, on-demand entries) can involve many
// seconds of on-demand compilation before any of that runs, and dev-only
// on-demand-entries disposal can make even a repeat hit slow again after a
// short idle gap between tests.
const SCRIPT_APPEAR_TIMEOUT = 45_000;

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

function collectConsoleMessages(page: Page) {
  const messages: string[] = [];
  page.on("console", (msg) => {
    messages.push(msg.text());
  });
  return messages;
}

function assertNoScriptWarnings(messages: string[]) {
  for (const text of messages) {
    expect(text).not.toContain(SCRIPT_TAG_WARNING);
    expect(text.toLowerCase()).not.toContain(SCRIPT_NEVER_EXECUTED_WARNING);
  }
}

/**
 * Records document.documentElement.dataset.pwLaunch's mutation history via a
 * MutationObserver installed before any page script runs (Playwright's
 * addInitScript guarantees this runs before the document's own scripts,
 * including the inline beforeInteractive bootstrap). This lets tests assert
 * on the value the pre-paint bootstrap itself set, without racing whatever
 * the hydrated React component does moments later.
 */
async function installLaunchAttributeRecorder(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __pwLaunchHistory: (string | null)[] };
    w.__pwLaunchHistory = [];
    const record = () => {
      w.__pwLaunchHistory.push(document.documentElement ? document.documentElement.dataset.pwLaunch ?? null : null);
    };
    // Observing document.documentElement directly isn't possible yet at this
    // point — <html> doesn't exist as a Node until parsing begins. Observing
    // the Document node itself (with subtree) still catches the attribute
    // the instant <html> is created and the bootstrap script sets it.
    const observer = new MutationObserver(record);
    observer.observe(document, { attributes: true, subtree: true, attributeFilter: ["data-pw-launch"] });
  });
}

async function getLaunchAttributeHistory(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() => (window as unknown as { __pwLaunchHistory: (string | null)[] }).__pwLaunchHistory ?? []);
}

test.describe("App splash bootstrap — initial HTML", () => {
  test("root layout emits exactly one stable pre-paint bootstrap script", async ({ request }) => {
    const response = await request.get("/?source=pwa");
    expect(response.ok()).toBe(true);

    const html = await response.text();

    // Next.js's beforeInteractive scripts are serialized into the initial
    // HTML either as a literal <script id="..."> tag or as a queued
    // self.__next_s payload (processed by Next's runtime before hydration) —
    // either form must appear, and exactly once, never both/duplicated.
    const idOccurrences = html.match(/"id":"pw-launch-bootstrap"|id="pw-launch-bootstrap"/g) ?? [];
    expect(idOccurrences).toHaveLength(1);

    for (const marker of ["source", "pwa", "pwLaunch", "pending", "skip", "__PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__"]) {
      expect(html).toContain(marker);
    }

    // Isolate the bootstrap's own inline payload and confirm it is fully
    // self-contained — no external src, no network reference, no
    // request/user-controlled data interpolated in.
    const payloadMatch = html.match(/\{"children":"((?:[^"\\]|\\.)*)","id":"pw-launch-bootstrap"\}/);
    expect(payloadMatch).not.toBeNull();
    const payload = payloadMatch![1];
    expect(payload).not.toMatch(/https?:\/\//);

    // No literal <script src="..." id="pw-launch-bootstrap"> tag either —
    // this bootstrap must never be split out into an external file.
    expect(html).not.toMatch(/<script[^>]*id="pw-launch-bootstrap"[^>]*\ssrc=/);
  });
});

test.describe("App splash bootstrap — browser execution", () => {
  test("eligible /?source=pwa launch is visibly displayed and produces no React script warning", async ({ page }) => {
    const messages = collectConsoleMessages(page);
    await installLaunchAttributeRecorder(page);

    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    await expect(page.locator("script#pw-launch-bootstrap")).toHaveCount(1, { timeout: SCRIPT_APPEAR_TIMEOUT });

    const nestedInOverlay = await page.evaluate(() => {
      const script = document.querySelector("script#pw-launch-bootstrap");
      const overlay = document.querySelector('[data-testid="app-launch-sequence"]');
      return !!script && !!overlay && overlay.contains(script);
    });
    expect(nestedInOverlay).toBe(false);

    // The very first write to the attribute is the pre-paint bootstrap's own
    // — proof it executed pre-hydration for this eligible URL — regardless
    // of what the hydrated component does to the attribute afterward.
    await expect
      .poll(async () => (await getLaunchAttributeHistory(page)).length, { timeout: SCRIPT_APPEAR_TIMEOUT })
      .toBeGreaterThan(0);
    const history = await getLaunchAttributeHistory(page);
    expect(history[0]).toBe("pending");
    expect(history[0]).not.toBeNull();

    // The overlay must actually be visible on screen — not merely attached.
    // AppSplashScreen's hydration effect reasserts data-pw-launch="pending"
    // for an eligible launch specifically so that React Strict Mode's
    // dev-only setup-cleanup-setup cycle can't leave the
    // `html[data-pw-launch="pending"] [data-pw-launch-root] { display: flex
    // !important; }` CSS gate closed.
    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible({ timeout: SCRIPT_APPEAR_TIMEOUT });

    const display = await overlay.evaluate((el) => getComputedStyle(el).display);
    expect(display).not.toBe("none");
    expect(display).toBe("flex");

    // Captured immediately after visibility is confirmed, before the normal
    // playback sequence later flips the attribute to "skip" on completion.
    const pwLaunchWhileVisible = await page.evaluate(() => document.documentElement.dataset.pwLaunch);
    expect(pwLaunchWhileVisible).toBe("pending");

    // The sequence must progress out of its initial "resolving" React state
    // (set only before hydration's layout effect runs) into an active stage.
    const stage = await overlay.getAttribute("data-launch-stage");
    expect(["handoff", "playing"]).toContain(stage);

    assertNoScriptWarnings(messages);
  });
});

test.describe("App splash bootstrap — normal URL regression", () => {
  test("plain / does not play the PWA launch, and the bootstrap still resolves to skip", async ({ page }) => {
    const messages = collectConsoleMessages(page);
    await installLaunchAttributeRecorder(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("script#pw-launch-bootstrap")).toHaveCount(1, { timeout: SCRIPT_APPEAR_TIMEOUT });

    await expect
      .poll(async () => (await getLaunchAttributeHistory(page)).length, { timeout: SCRIPT_APPEAR_TIMEOUT })
      .toBeGreaterThan(0);
    const history = await getLaunchAttributeHistory(page);
    expect(history[0]).toBe("skip");

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);

    assertNoScriptWarnings(messages);
  });
});

test.describe("App splash bootstrap — client component ownership", () => {
  test("the sole #pw-launch-bootstrap script lives in document head infrastructure, not the homepage client subtree", async ({ page }) => {
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    await expect(page.locator("script#pw-launch-bootstrap")).toHaveCount(1, { timeout: SCRIPT_APPEAR_TIMEOUT });

    const ownership = await page.evaluate(() => {
      const scripts = document.querySelectorAll("#pw-launch-bootstrap");
      const script = scripts[0];
      return {
        count: scripts.length,
        inHead: !!script && document.head.contains(script),
        inOverlay: !!script && !!document.querySelector('[data-testid="app-launch-sequence"]')?.contains(script),
      };
    });

    expect(ownership.count).toBe(1);
    expect(ownership.inHead).toBe(true);
    expect(ownership.inOverlay).toBe(false);
  });
});
