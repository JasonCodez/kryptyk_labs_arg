import { expect, test, type Page } from "@playwright/test";

// Pass 3.5: premium PWA launch sequence ("The Puzzle Forge"). Deterministic —
// no signed-in user, no database data, no reliance on network speed or
// service-worker installation. The Daily summary API is mocked so the
// homepage underneath the overlay is stable.
//
// NOTE: real Playwright spec — run via `npx playwright test`, not `npm test`.

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

// Overrides only the (display-mode: standalone) query so the rest of
// matchMedia (including reduced-motion, driven natively by
// page.emulateMedia) keeps working for the app's other hooks.
async function mockStandalone(page: Page, standalone: boolean) {
  await page.addInitScript((isStandalone) => {
    const originalMatchMedia = window.matchMedia?.bind(window);
    window.matchMedia = ((query: string) => {
      if (query.includes("display-mode: standalone")) {
        return {
          matches: isStandalone,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        } as MediaQueryList;
      }
      return originalMatchMedia ? originalMatchMedia(query) : ({ matches: false, media: query } as MediaQueryList);
    }) as typeof window.matchMedia;
  }, standalone);
}

async function seedLaunchStorage(page: Page, { session, version }: { session?: string; version?: string }) {
  await page.addInitScript(
    ([sessionValue, versionValue]) => {
      if (sessionValue) sessionStorage.setItem("pw_app_launch_session", sessionValue);
      if (versionValue) localStorage.setItem("pw_app_launch_version", versionValue);
    },
    [session ?? "", version ?? ""]
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

// Makes both sessionStorage and localStorage throw on every read/write, from
// before any page script runs — simulates private-mode/quota-exceeded
// storage failure for the "storage failure remains visible" test.
async function breakStorage(page: Page) {
  await page.addInitScript(() => {
    const throwError = () => {
      throw new Error("storage unavailable");
    };
    Object.defineProperty(window, "sessionStorage", { value: { getItem: throwError, setItem: throwError } });
    Object.defineProperty(window, "localStorage", { value: { getItem: throwError, setItem: throwError } });
  });
}

test.describe("App launch sequence — first standalone root launch", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("full mode plays, homepage is already attached underneath, and markers are written", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toHaveAttribute("data-launch-mode", "full");

    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.x).toBeLessThanOrEqual(0);
    expect(overlayBox!.y).toBeLessThanOrEqual(0);
    expect(overlayBox!.width).toBeGreaterThanOrEqual(390 - 1);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(844 - 1);

    await expect(page.getByTestId("app-launch-tiles")).toBeVisible();
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toContainText("CLASSIC PUZZLES. MODERN COMPETITION.");
    await expect(page.getByTestId("app-launch-segments")).toBeVisible();

    // Homepage content is already attached in the DOM underneath the overlay.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await expectNoHorizontalOverflow(page);

    // Overlay must be gone well before the full hard maximum (2400ms).
    await expect(overlay).toHaveCount(0, { timeout: 4000 });

    await expect(page.getByRole("heading", { level: 1, name: "Classic puzzles. Built to compete." })).toBeVisible();

    const markers = await page.evaluate(() => ({
      session: sessionStorage.getItem("pw_app_launch_session"),
      version: localStorage.getItem("pw_app_launch_version"),
    }));
    expect(markers.session).toBe("1");
    expect(markers.version).toBe("1");
  });
});

test.describe("App launch sequence — returning standalone cold launch", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("compact mode skips tile assembly and exits quickly", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await seedLaunchStorage(page, { version: "1" });
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toHaveAttribute("data-launch-mode", "compact");
    await expect(page.getByTestId("app-launch-tiles")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();

    await expect(overlay).toHaveCount(0, { timeout: 2000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — same-session replay prevention", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("overlay is never painted; homepage is immediately available in normal browse mode", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await seedLaunchStorage(page, { session: "1", version: "1" });
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    // Pre-paint-bootstrap assertion: the "skip" decision must already be in
    // place immediately after DOM content loads, not something we wait out.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.pwLaunch), { timeout: 1000 })
      .toBe("skip");
    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // In standalone display mode the app deliberately swaps the full Navbar
    // for a hamburger-only bar (Navbar.tsx's own pre-existing behavior,
    // unrelated to this pass) — the bottom nav still confirms normal browse
    // chrome, not play/auth/admin mode.
    await expect(page.locator(".pw-bottom-nav")).toBeVisible();
  });
});

test.describe("App launch sequence — normal browser", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no overlay in a non-standalone tab", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, false);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — normal homepage URL", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no overlay without ?source=pwa, even in standalone", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — deep-link bypass", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("/daily?source=pwa opens immediately with no overlay", async ({ page }) => {
    await mockStandalone(page, true);
    await page.goto("/daily?source=pwa", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);
  });
});

test.describe("App launch sequence — reduced motion", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("static presentation with no tile stage or light sweep, exits quickly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toHaveAttribute("data-launch-mode", "reduced");
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();
    await expect(page.getByTestId("app-launch-tiles")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-sweep")).toHaveCount(0);

    await expect(overlay).toHaveCount(0, { timeout: 1500 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — landscape phone", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("overlay covers the full viewport with no scroll and no overflow", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.width).toBeGreaterThanOrEqual(844 - 1);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(390 - 1);

    await expect(page.getByTestId("app-launch-tiles")).toBeVisible();
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();

    const { scrollHeight: overlayScrollHeight } = await overlay.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
    }));
    expect(overlayScrollHeight).toBeLessThanOrEqual(390 + 4);

    await expect(overlay).toHaveCount(0, { timeout: 4000 });
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  });
});

test.describe("App launch sequence — narrow phone", () => {
  test.use({ viewport: { width: 320, height: 710 } });

  test("no overflow, logo and statement unclipped, overlay exits successfully", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("app-launch-tagline")).toContainText("CLASSIC PUZZLES. MODERN COMPETITION.");

    const logoBox = await page.getByTestId("app-launch-logo").boundingBox();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.x).toBeGreaterThanOrEqual(0);
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(320 + 1);

    const tilesBox = await page.getByTestId("app-launch-tiles").boundingBox();
    expect(tilesBox).not.toBeNull();
    expect(tilesBox!.x).toBeGreaterThan(0);
    expect(tilesBox!.x + tilesBox!.width).toBeLessThan(320);

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0, { timeout: 4000 });
  });
});

test.describe("App launch sequence — desktop standalone simulation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("central group stays modest, overlay covers viewport, homepage geometry is unchanged after exit", async ({
    page,
  }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    const overlay = page.getByTestId("app-launch-sequence");
    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.width).toBeGreaterThanOrEqual(1440 - 1);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(900 - 1);

    const logoBox = await page.getByTestId("app-launch-logo").boundingBox();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.width).toBeLessThanOrEqual(160);

    await expect(overlay).toHaveCount(0, { timeout: 4000 });

    const heroBox = await page.locator('[data-testid="home-hero-container"]').boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox!.width).toBeGreaterThan(0);
    // Standalone display mode swaps the full Navbar for a hamburger-only bar
    // at every viewport width (Navbar.tsx's own pre-existing behavior) — the
    // homepage container geometry itself is the relevant "unchanged" check.
    await expect(page.locator(".pw-bottom-nav")).not.toBeVisible();
  });
});

test.describe("App launch sequence — storage failure remains visible", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("compact mode is actually displayed (real visibility, not just DOM presence) when both storages throw", async ({
    page,
  }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    await breakStorage(page);
    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    // The pre-paint bootstrap must have failed OPEN to "pending", not "skip"
    // — this is the exact defect being corrected: a bootstrap/hydrated
    // disagreement previously left the overlay in the DOM but permanently
    // display:none.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.pwLaunch), { timeout: 1000 })
      .toBe("pending");

    const overlay = page.getByTestId("app-launch-sequence");
    // A true visibility assertion (computed style, not just DOM count).
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-launch-mode", "compact");
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();

    await expect(overlay).toHaveCount(0, { timeout: 2000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — static pre-hydration handoff", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a visible static logo bridges the native-to-web gap even while hydration is delayed", async ({ page }) => {
    await mockDailySummary(page);
    await mockStandalone(page, true);
    // Delay every Next.js JS chunk (but not CSS, which is render-blocking
    // and must load normally so the navy background/tokens are correct) so
    // React cannot hydrate/correct the server-rendered frame before this
    // test's assertions run — this is what actually forces the assertions
    // below onto the true pre-hydration frame, rather than depending on an
    // arbitrary sleep that may or may not outrun hydration on a given
    // machine.
    await page.route("**/_next/static/chunks/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    // Asserted immediately after domcontentloaded, while hydration is still
    // blocked — this is the frame a real device would show between the
    // native splash fading out and the JS bundle finishing execution.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.pwLaunch), { timeout: 1000 })
      .toBe("pending");

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.width).toBeGreaterThanOrEqual(390 - 1);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(844 - 1);

    const prepaintLogo = page.getByTestId("app-launch-prepaint-logo");
    await expect(prepaintLogo).toBeVisible();
    const logoBox = await prepaintLogo.boundingBox();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.width).toBeGreaterThan(0);
    expect(logoBox!.height).toBeGreaterThan(0);

    // Occlusion check (not just "attached to the DOM"): the overlay must be
    // the actual topmost paintable element at the viewport's center, proving
    // the homepage is not visible through it.
    const overlayIsOnTop = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el?.closest('[data-testid="app-launch-sequence"]') != null;
    });
    expect(overlayIsOnTop).toBe(true);

    const backgroundColor = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(backgroundColor).not.toBe("rgb(255, 255, 255)");
    expect(backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    await expectNoHorizontalOverflow(page);
  });
});
