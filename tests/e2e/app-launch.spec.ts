import { expect, test, type Page } from "@playwright/test";

// Pass 3.5 real-device correction: "The Puzzle Forge" premium PWA launch
// sequence. Deterministic — no signed-in user, no database data, no
// reliance on network speed or service-worker installation. The Daily
// summary API is mocked so the homepage underneath the overlay is stable.
//
// Real-device testing found three defects this suite specifically guards
// against: (1) display-mode:standalone is not a reliable TWA signal and must
// never gate eligibility, (2) playback must never begin until the browser
// has actually loaded/painted (the native Android splash can still be
// covering the page right after hydration), (3) sessionStorage is an
// unreliable replay guard under TWA/Chrome process reuse and has been fully
// replaced with an in-memory, per-document flag.
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

// Only used by the one test that must explicitly prove standalone display
// mode is NOT required for eligibility — every other test intentionally
// leaves matchMedia untouched (a real regular Chromium tab), which is itself
// part of what this suite is proving.
async function forceStandaloneFalse(page: Page) {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia?.bind(window);
    window.matchMedia = ((query: string) => {
      if (query.includes("display-mode: standalone")) {
        return {
          matches: false, media: query, onchange: null,
          addListener: () => {}, removeListener: () => {},
          addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
        } as MediaQueryList;
      }
      return originalMatchMedia ? originalMatchMedia(query) : ({ matches: false, media: query } as MediaQueryList);
    }) as typeof window.matchMedia;
  });
}

async function breakLocalStorage(page: Page) {
  await page.addInitScript(() => {
    const throwError = () => {
      throw new Error("storage unavailable");
    };
    Object.defineProperty(window, "localStorage", { value: { getItem: throwError, setItem: throwError } });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

async function waitForStage(page: Page, stage: string, timeout = 6000) {
  await expect
    .poll(
      () => page.evaluate(() => document.querySelector('[data-testid="app-launch-sequence"]')?.getAttribute("data-launch-stage") ?? null),
      { timeout }
    )
    .toBe(stage);
}

test.describe("App launch sequence — first root launch", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("full mode plays end to end, homepage is already attached underneath, version 2 is persisted", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();

    await waitForStage(page, "playing");
    await expect(overlay).toHaveAttribute("data-launch-mode", "full");
    await expect(page.getByTestId("app-launch-tiles")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toContainText("CLASSIC PUZZLES. MODERN COMPETITION.");
    await expect(page.getByTestId("app-launch-segments")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-spinner")).toBeVisible();
    await expect(page.getByTestId("app-launch-message")).toBeVisible();

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    await expect(overlay).toHaveCount(0, { timeout: 6500 });
    await expect(page.getByRole("heading", { level: 1, name: "Classic puzzles. Built to compete." })).toBeVisible();

    const version = await page.evaluate(() => localStorage.getItem("pw_app_launch_version"));
    expect(version).toBe("2");
  });
});

test.describe("App launch sequence — normal homepage URL", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no overlay without ?source=pwa", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — deep-link bypass", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("/daily?source=pwa opens immediately with no overlay", async ({ page }) => {
    await page.goto("/daily?source=pwa", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);
  });
});

test.describe("App launch sequence — compact mode", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("second-ever launch (version already stored) skips tile assembly and exits quickly", async ({ page }) => {
    await mockDailySummary(page);
    await page.addInitScript(() => localStorage.setItem("pw_app_launch_version", "2"));
    await page.goto("/?source=pwa", { waitUntil: "load" });

    await waitForStage(page, "playing");
    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toHaveAttribute("data-launch-mode", "compact");
    await expect(page.getByTestId("app-launch-tiles")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-segments")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-spinner")).toBeVisible();
    await expect(page.getByTestId("app-launch-message")).toBeVisible();

    await expect(overlay).toHaveCount(0, { timeout: 6500 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — reduced motion", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("static presentation with no tile stage or light sweep, exits quickly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    await waitForStage(page, "playing");
    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toHaveAttribute("data-launch-mode", "reduced");
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();
    await expect(page.getByTestId("app-launch-tiles")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-sweep")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-segments")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-spinner")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-message")).toHaveCount(0);

    await expect(overlay).toHaveCount(0, { timeout: 3500 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — landscape phone", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("overlay covers the full viewport with no scroll and no overflow", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.width).toBeGreaterThanOrEqual(844 - 1);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(390 - 1);

    await waitForStage(page, "playing");
    await expect(page.getByTestId("app-launch-tiles")).toBeVisible();
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();

    const { scrollHeight: overlayScrollHeight } = await overlay.evaluate((el) => ({ scrollHeight: el.scrollHeight }));
    expect(overlayScrollHeight).toBeLessThanOrEqual(390 + 4);

    await expect(overlay).toHaveCount(0, { timeout: 6500 });
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("App launch sequence — narrow phone", () => {
  test.use({ viewport: { width: 320, height: 710 } });

  test("no overflow, logo unclipped, overlay exits successfully", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    await expectNoHorizontalOverflow(page);
    const logoBox = await page.getByTestId("app-launch-logo").boundingBox();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.x).toBeGreaterThanOrEqual(0);
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(320 + 1);

    await waitForStage(page, "playing");
    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0, { timeout: 6500 });
  });
});

test.describe("App launch sequence — desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("central group stays modest, overlay covers viewport, homepage geometry is unchanged after exit", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    const overlay = page.getByTestId("app-launch-sequence");
    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).not.toBeNull();
    expect(overlayBox!.width).toBeGreaterThanOrEqual(1440 - 1);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(900 - 1);

    const logoBox = await page.getByTestId("app-launch-logo").boundingBox();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.width).toBeLessThanOrEqual(160);

    await expect(overlay).toHaveCount(0, { timeout: 6500 });
    const heroBox = await page.locator('[data-testid="home-hero-container"]').boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox!.width).toBeGreaterThan(0);
  });
});

test.describe("App launch sequence — local storage failure remains visible", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("compact mode is actually displayed (real visibility) when localStorage throws", async ({ page }) => {
    await mockDailySummary(page);
    await breakLocalStorage(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    await waitForStage(page, "playing");
    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-launch-mode", "compact");
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();

    await expect(overlay).toHaveCount(0, { timeout: 6500 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — static pre-hydration logo", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a visible static logo bridges the native-to-web gap even while hydration is delayed", async ({ page }) => {
    await mockDailySummary(page);
    // Delay every Next.js JS chunk (not CSS, which is render-blocking and
    // must load normally so the navy background/tokens are correct) so
    // React cannot hydrate before this test's assertions run.
    await page.route("**/_next/static/chunks/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    await page.goto("/?source=pwa", { waitUntil: "domcontentloaded" });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.pwLaunch), { timeout: 1000 })
      .toBe("pending");

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    const logo = page.getByTestId("app-launch-logo");
    await expect(logo).toBeVisible();
    const logoBox = await logo.boundingBox();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.width).toBeGreaterThan(0);
    expect(logoBox!.height).toBeGreaterThan(0);

    const overlayIsOnTop = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el?.closest('[data-testid="app-launch-sequence"]') != null;
    });
    expect(overlayIsOnTop).toBe(true);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("App launch sequence — real-device regression: standalone-false still plays", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("display-mode:standalone === false does not suppress the launch", async ({ page }) => {
    await mockDailySummary(page);
    await forceStandaloneFalse(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    const overlay = page.getByTestId("app-launch-sequence");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-launch-stage", "handoff");
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();

    await waitForStage(page, "playing");
    await expect(overlay).not.toHaveAttribute("data-launch-mode", "none");

    await expect(overlay).toHaveCount(0, { timeout: 6500 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — native splash occlusion simulation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("web playback begins only after the simulated native splash is removed", async ({ page }) => {
    await mockDailySummary(page);
    // First-ever launch (empty storage) so version 2 selects full mode.
    await page.addInitScript(() => {
      const splash = document.createElement("div");
      splash.id = "simulated-native-splash";
      Object.assign(splash.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        background: "#0A0E17",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
      const img = document.createElement("img");
      img.src = "/images/puzzle_warz_logo.png";
      img.style.width = "120px";
      img.style.height = "120px";
      splash.appendChild(img);
      document.documentElement.appendChild(splash);

      (window as unknown as { __nativeSplashRemovedAt: number | null }).__nativeSplashRemovedAt = null;

      window.addEventListener("load", () => {
        setTimeout(() => {
          splash.remove();
          (window as unknown as { __nativeSplashRemovedAt: number | null }).__nativeSplashRemovedAt = performance.now();
        }, 350);
      });
    });

    await page.goto("/?source=pwa", { waitUntil: "load" });

    // Immediately after load: the native splash's own 350ms delay hasn't
    // elapsed yet, and the web buffer (700ms) is longer than that delay by
    // construction — so the web stage must still be "handoff" and no tiles
    // or tagline have appeared yet.
    await expect(page.getByTestId("app-launch-sequence")).toHaveAttribute("data-launch-stage", "handoff");
    await expect(page.getByTestId("app-launch-tiles")).toHaveCount(0);
    await expect(page.getByTestId("app-launch-tagline")).toHaveCount(0);
    const versionBeforePlaying = await page.evaluate(() => localStorage.getItem("pw_app_launch_version"));
    expect(versionBeforePlaying).toBeNull();

    await page.waitForFunction(() => (window as unknown as { __nativeSplashRemovedAt: number | null }).__nativeSplashRemovedAt !== null, { timeout: 3000 });
    // The static web logo remains visible right through the native splash's
    // own removal — no gap between them.
    await expect(page.getByTestId("app-launch-logo")).toBeVisible();

    // The core proof: right at the moment the simulated native splash
    // finishes removing itself (350ms after load), the web buffer (700ms,
    // strictly longer by construction) cannot have elapsed yet — so web
    // playback must NOT have begun. This is checked immediately, with no
    // extra wait that could let playback sneak in before the check runs.
    const stageAtSplashRemoval = await page.evaluate(
      () => document.querySelector('[data-testid="app-launch-sequence"]')?.getAttribute("data-launch-stage") ?? null
    );
    expect(stageAtSplashRemoval).toBe("handoff");

    // Playback must still eventually begin afterward.
    await waitForStage(page, "playing");

    await expect(page.getByTestId("app-launch-tiles")).toBeVisible();
    await expect(page.getByTestId("app-launch-sweep")).toBeVisible();
    await expect(page.getByTestId("app-launch-tagline")).toBeVisible();

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0, { timeout: 6500 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("App launch sequence — logo position continuity", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("logo center moves no more than ~6px between handoff and playing", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    const handoffBox = await page.getByTestId("app-launch-logo").boundingBox();
    expect(handoffBox).not.toBeNull();
    const handoffCenter = { x: handoffBox!.x + handoffBox!.width / 2, y: handoffBox!.y + handoffBox!.height / 2 };

    await waitForStage(page, "playing");
    const playingBox = await page.getByTestId("app-launch-logo").boundingBox();
    expect(playingBox).not.toBeNull();
    const playingCenter = { x: playingBox!.x + playingBox!.width / 2, y: playingBox!.y + playingBox!.height / 2 };

    expect(Math.abs(playingCenter.x - handoffCenter.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(playingCenter.y - handoffCenter.y)).toBeLessThanOrEqual(6);
    // Exactly one logo element exists — no overlapping duplicate.
    await expect(page.getByTestId("app-launch-logo")).toHaveCount(1);
  });
});

test.describe("App launch sequence — version persistence timing", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("version 2 is written only once playback begins, never before", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });

    const beforePlaying = await page.evaluate(() => localStorage.getItem("pw_app_launch_version"));
    expect(beforePlaying === null || beforePlaying === "1").toBe(true);

    await waitForStage(page, "playing");
    const afterPlaying = await page.evaluate(() => localStorage.getItem("pw_app_launch_version"));
    expect(afterPlaying).toBe("2");
  });
});

test.describe("App launch sequence — cold reload becomes compact", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a full launch followed by a fresh reload receives compact mode, not suppression", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });
    await waitForStage(page, "playing");
    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0, { timeout: 6500 });

    await page.reload({ waitUntil: "load" });

    await waitForStage(page, "playing");
    await expect(page.getByTestId("app-launch-sequence")).toHaveAttribute("data-launch-mode", "compact");
    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0, { timeout: 6500 });
  });
});

test.describe("App launch sequence — warm document replay prevention", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("client-side navigation away and back in the same document never replays the sequence", async ({ page }) => {
    await mockDailySummary(page);
    await page.goto("/?source=pwa", { waitUntil: "load" });
    await page.waitForFunction(() => (window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__ === true, { timeout: 6000 });
    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0, { timeout: 6500 });

    // Client-side navigation (Next Link, no full reload) away and back —
    // the in-memory flag lives on `window`, so it must survive this.
    await page.getByRole("link", { name: /View Daily Puzzles/ }).click();
    await page.waitForURL("**/daily");
    await page.goBack();
    await page.waitForURL(/\/\?source=pwa/);

    await expect(page.getByTestId("app-launch-sequence")).toHaveCount(0);
  });
});
