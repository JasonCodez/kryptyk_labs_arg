import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function dismissCookieBanner(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  try {
    await gotIt.waitFor({ state: "visible", timeout: 3000 });
    await gotIt.click();
  } catch {
    // Banner never appeared this session — nothing to close.
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

async function expectFacebookLogoRendersCleanly(
  page: Page,
  button: ReturnType<Page["getByTestId"]>
) {
  const logo = button.locator("img[src*='facebook-f-logo']");
  await expect(logo).toHaveCount(1);
  await expect(logo).toBeVisible();

  const buttonBox = await button.boundingBox();
  const logoBox = await logo.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(logoBox).not.toBeNull();

  expect(logoBox!.width).toBeGreaterThanOrEqual(16);
  expect(logoBox!.width).toBeLessThanOrEqual(20);
  expect(logoBox!.height).toBeGreaterThanOrEqual(16);
  expect(logoBox!.height).toBeLessThanOrEqual(20);

  // The logo must be fully contained inside the button — no cropping ancestor
  // is hiding part of a larger image outside the visible bounds.
  expect(logoBox!.x).toBeGreaterThanOrEqual(buttonBox!.x - 1);
  expect(logoBox!.y).toBeGreaterThanOrEqual(buttonBox!.y - 1);
  expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(buttonBox!.x + buttonBox!.width + 1);
  expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(buttonBox!.y + buttonBox!.height + 1);

  const layout = await logo.evaluate((el, buttonTestId) => {
    const style = getComputedStyle(el as HTMLElement);
    const buttonEl = (el as HTMLElement).closest(`[data-testid="${buttonTestId}"]`);
    let node: HTMLElement | null = (el as HTMLElement).parentElement;
    let ancestorClips = false;
    while (node && node !== buttonEl) {
      const nodeStyle = getComputedStyle(node);
      if (nodeStyle.overflow !== "visible" && nodeStyle.overflow !== "") {
        ancestorClips = true;
      }
      node = node.parentElement;
    }
    return {
      position: style.position,
      left: style.left,
      top: style.top,
      ancestorClips,
    };
  }, await button.getAttribute("data-testid"));
  expect(layout.position).not.toBe("absolute");
  expect(layout.left.startsWith("-")).toBe(false);
  expect(layout.top.startsWith("-")).toBe(false);
  expect(layout.ancestorClips).toBe(false);
}

function providersPayload(options: { includeGoogle?: boolean; includeFacebook?: boolean }) {
  const credentials = {
    id: "credentials",
    name: "Credentials",
    type: "credentials",
    signinUrl: "/api/auth/signin/credentials",
    callbackUrl: "/api/auth/callback/credentials",
  };
  const payload: Record<string, unknown> = { credentials };
  if (options.includeGoogle) {
    payload.google = {
      id: "google",
      name: "Google",
      type: "oauth",
      signinUrl: "/api/auth/signin/google",
      callbackUrl: "/api/auth/callback/google",
    };
  }
  if (options.includeFacebook) {
    payload.facebook = {
      id: "facebook",
      name: "Facebook",
      type: "oauth",
      signinUrl: "/api/auth/signin/facebook",
      callbackUrl: "/api/auth/callback/facebook",
    };
  }
  return payload;
}

interface AuthFixtureOptions {
  includeGoogle?: boolean;
  includeFacebook?: boolean;
  holdFacebookSignin?: boolean;
  abortFacebookSignin?: boolean;
  holdGoogleSignin?: boolean;
}

// Fully intercepts every NextAuth endpoint these pages touch — no request
// ever reaches Facebook, Google, or a real database.
async function installAuthFixture(page: Page, options: AuthFixtureOptions = {}) {
  const includeGoogle = options.includeGoogle ?? false;
  const includeFacebook = options.includeFacebook ?? true;
  const facebookSigninRequests: Array<{ method: string; postData: string | null }> = [];
  const googleSigninRequests: Array<{ method: string; postData: string | null }> = [];
  const credentialsCallbackRequests: Array<{ method: string; postData: string | null }> = [];
  const heldFacebookSignin: Route[] = [];
  const heldGoogleSignin: Route[] = [];

  await page.route("**/api/auth/session", (route) => fulfill(route, {}));
  await page.route("**/api/auth/csrf", (route) => fulfill(route, { csrfToken: "test-csrf-token" }));
  await page.route("**/api/auth/providers", (route) =>
    fulfill(route, providersPayload({ includeGoogle, includeFacebook }))
  );

  await page.route("**/api/auth/signin/facebook", async (route) => {
    facebookSigninRequests.push({
      method: route.request().method(),
      postData: route.request().postData(),
    });
    if (options.abortFacebookSignin) {
      await route.abort("failed");
      return;
    }
    if (options.holdFacebookSignin) {
      heldFacebookSignin.push(route);
      return;
    }
    await fulfill(route, { url: "/auth/signin?facebook-init=1" });
  });

  await page.route("**/api/auth/callback/facebook", (route) => fulfill(route, {}));

  await page.route("**/api/auth/signin/google", async (route) => {
    googleSigninRequests.push({
      method: route.request().method(),
      postData: route.request().postData(),
    });
    if (options.holdGoogleSignin) {
      heldGoogleSignin.push(route);
      return;
    }
    await fulfill(route, { url: "/auth/signin?google-init=1" });
  });

  await page.route("**/api/auth/callback/google", (route) => fulfill(route, {}));

  await page.route("**/api/auth/callback/credentials", (route) => {
    credentialsCallbackRequests.push({
      method: route.request().method(),
      postData: route.request().postData(),
    });
    return fulfill(route, { url: "/auth/signin" });
  });

  return {
    facebookSigninRequests,
    googleSigninRequests,
    credentialsCallbackRequests,
    releaseFacebookSignin: async () => {
      for (const route of heldFacebookSignin.splice(0)) {
        await fulfill(route, { url: "/auth/signin?facebook-init=1" });
      }
    },
    releaseGoogleSignin: async () => {
      for (const route of heldGoogleSignin.splice(0)) {
        await fulfill(route, { url: "/auth/signin?google-init=1" });
      }
    },
  };
}

test.describe("Facebook auth — provider absent", () => {
  test("Credentials-only provider list hides Facebook actions, keeps Credentials usable, and shows no orphaned divider", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAuthFixture(page, { includeGoogle: false, includeFacebook: false });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByTestId("facebook-signin-button")).toHaveCount(0);
    await expect(page.getByTestId("google-signin-button")).toHaveCount(0);
    await expect(page.getByText("or continue with email")).toHaveCount(0);
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();

    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByTestId("facebook-signup-button")).toHaveCount(0);
    await expect(page.getByTestId("google-signup-button")).toHaveCount(0);
    await expect(page.getByText("or create an account with email")).toHaveCount(0);
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
  });
});

test.describe("Facebook auth — Facebook only", () => {
  test("Facebook actions render correctly on sign-in and registration, and do not submit Credentials forms", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installAuthFixture(page, { includeGoogle: false, includeFacebook: true });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const facebookButton = page.getByTestId("facebook-signin-button");
    await expect(facebookButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Facebook" })).toBeVisible();
    const box = await facebookButton.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.9);
    await expectFacebookLogoRendersCleanly(page, facebookButton);
    await expect(page.getByTestId("google-signin-button")).toHaveCount(0);
    await expect(page.getByText("or continue with email")).toHaveCount(1);

    await facebookButton.click();
    await expect(page).toHaveURL(/\/auth\/signin\?facebook-init=1$/);
    expect(fixture.facebookSigninRequests).toHaveLength(1);
    expect(fixture.facebookSigninRequests[0].method).toBe("POST");
    expect(fixture.facebookSigninRequests[0].postData).toContain("callbackUrl=%2Fdashboard");
    expect(fixture.credentialsCallbackRequests.length).toBe(0);

    await expectNoHorizontalOverflow(page);

    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const signUpButton = page.getByTestId("facebook-signup-button");
    await expect(signUpButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up with Facebook" })).toBeVisible();
    const signUpBox = await signUpButton.boundingBox();
    expect(signUpBox!.height).toBeGreaterThanOrEqual(43.9);
    await expectFacebookLogoRendersCleanly(page, signUpButton);
    await expect(page.getByTestId("google-signup-button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    // Provider-neutral consent copy, since only Facebook is displayed here.
    await expect(page.getByText(/agree to the PuzzleWarz/)).toBeVisible();
    await expect(page.getByText("or create an account with email")).toBeVisible();

    // Credentials registration remains usable alongside the Facebook button.
    await expect(page.getByPlaceholder("Your name")).toBeEditable();
    await expect(page.getByPlaceholder("you@example.com")).toBeEditable();

    await signUpButton.click();
    await expect(page).toHaveURL(/\/auth\/signin\?facebook-init=1$/);
    expect(fixture.facebookSigninRequests).toHaveLength(2);
    expect(fixture.facebookSigninRequests[1].method).toBe("POST");
    expect(fixture.facebookSigninRequests[1].postData).toContain("callbackUrl=%2Fdashboard");
    expect(fixture.credentialsCallbackRequests).toHaveLength(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Facebook auth — both providers", () => {
  test("Google renders before Facebook, exactly one divider, and each social button disables the other while initiating", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installAuthFixture(page, {
      includeGoogle: true,
      includeFacebook: true,
      holdFacebookSignin: true,
      holdGoogleSignin: true,
    });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const googleButton = page.getByTestId("google-signin-button");
    const facebookButton = page.getByTestId("facebook-signin-button");
    await expect(googleButton).toBeVisible();
    await expect(facebookButton).toBeVisible();
    await expect(page.getByText("or continue with email")).toHaveCount(1);

    const googleBox = await googleButton.boundingBox();
    const facebookBox = await facebookButton.boundingBox();
    expect(googleBox!.y).toBeLessThan(facebookBox!.y);

    // Rapidly clicking Facebook then force-clicking Google starts exactly
    // one OAuth request (Facebook's) — the shared guard blocks Google.
    await facebookButton.click();
    await googleButton.click({ force: true });
    await googleButton.click({ force: true });

    await expect.poll(() => fixture.facebookSigninRequests.length).toBe(1);
    expect(fixture.googleSigninRequests).toHaveLength(0);
    await expect(facebookButton).toContainText("Connecting to Facebook…");
    await expect(googleButton).toBeDisabled();
    await expect(facebookButton).toBeDisabled();

    await fixture.releaseFacebookSignin();
  });

  test("rapid Google click then force-clicking Facebook starts exactly one OAuth request", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installAuthFixture(page, {
      includeGoogle: true,
      includeFacebook: true,
      holdFacebookSignin: true,
      holdGoogleSignin: true,
    });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const googleButton = page.getByTestId("google-signin-button");
    const facebookButton = page.getByTestId("facebook-signin-button");

    await googleButton.click();
    await facebookButton.click({ force: true });
    await facebookButton.click({ force: true });

    await expect.poll(() => fixture.googleSigninRequests.length).toBe(1);
    expect(fixture.facebookSigninRequests).toHaveLength(0);
    await expect(googleButton).toContainText("Connecting to Google…");
    await expect(googleButton).toBeDisabled();
    await expect(facebookButton).toBeDisabled();

    await fixture.releaseGoogleSignin();
  });
});

test.describe("Facebook auth — initiation failure", () => {
  test("sign-in reports failure, releases the shared guard, and permits one retry", async ({ page }) => {
    const fixture = await installAuthFixture(page, { includeFacebook: true, abortFacebookSignin: true });
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const button = page.getByTestId("facebook-signin-button");
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByText("Facebook sign-in could not be started. Please try again.")).toBeVisible();
    await expect(button).toHaveText("Continue with Facebook");
    await expect(button).toBeEnabled();
    expect(fixture.facebookSigninRequests).toHaveLength(1);

    await button.click();
    await expect.poll(() => fixture.facebookSigninRequests.length).toBe(2);
    expect(fixture.credentialsCallbackRequests).toHaveLength(0);
  });

  test("registration reports failure, releases the shared guard, and permits one retry", async ({ page }) => {
    const fixture = await installAuthFixture(page, { includeFacebook: true, abortFacebookSignin: true });
    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const button = page.getByTestId("facebook-signup-button");
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByText("Facebook sign-up could not be started. Please try again.")).toBeVisible();
    await expect(button).toHaveText("Sign up with Facebook");
    await expect(button).toBeEnabled();
    expect(fixture.facebookSigninRequests).toHaveLength(1);

    await button.click();
    await expect.poll(() => fixture.facebookSigninRequests.length).toBe(2);
    expect(fixture.credentialsCallbackRequests).toHaveLength(0);
  });
});

test.describe("Facebook auth — responsive", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow, full-width buttons, usable Credentials form at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await installAuthFixture(page, { includeGoogle: true, includeFacebook: true });

      await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      const googleButton = page.getByTestId("google-signin-button");
      const facebookButton = page.getByTestId("facebook-signin-button");
      await expect(googleButton).toBeVisible();
      await expect(facebookButton).toBeVisible();

      const googleBox = await googleButton.boundingBox();
      const facebookBox = await facebookButton.boundingBox();
      // Full width relative to the card, and never visually overlapping.
      expect(Math.abs(googleBox!.width - facebookBox!.width)).toBeLessThan(1);
      expect(facebookBox!.y).toBeGreaterThanOrEqual(googleBox!.y + googleBox!.height);

      await expectFacebookLogoRendersCleanly(page, facebookButton);
      await expect(page.getByPlaceholder("you@example.com")).toBeEditable();
      await expect(page.getByPlaceholder("••••••••")).toBeEditable();
      await expectNoHorizontalOverflow(page);

      await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);
      await expect(page.getByTestId("facebook-signup-button")).toBeVisible();
      await expect(page.getByPlaceholder("Your name")).toBeEditable();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Facebook auth — asset validation", () => {
  test("Facebook logo asset is a clean, transparent, complete-mark SVG", async ({ page }) => {
    await installAuthFixture(page, { includeFacebook: true });
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });

    const response = await page.request.get("/images/facebook-f-logo.svg");
    expect(response.ok()).toBe(true);

    const svg = await response.text();

    const viewBoxMatch = svg.match(/viewBox="([\d.\s-]+)"/);
    expect(viewBoxMatch).not.toBeNull();
    const [minX, minY, width, height] = viewBoxMatch![1].trim().split(/\s+/).map(Number);
    expect(width).toBe(height);

    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain("<filter");
    expect(svg).not.toContain("<mask");
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<text");
    expect(svg).not.toMatch(/@font-face|font-family/i);
    expect(svg).not.toMatch(/<rect\b/);
    expect(svg.replace(/xmlns(:\w+)?="https?:\/\/[^"]*"/g, "")).not.toMatch(/https?:\/\//);

    // The mark must not touch the viewBox boundary — extract every numeric
    // coordinate/control-point token from the path data and confirm each
    // stays strictly inside the box with some padding margin.
    const pathData = (svg.match(/<path[^>]*\bd="([^"]+)"/)?.[1]) ?? "";
    const numbers = pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(numbers.length).toBeGreaterThan(0);
    const margin = 1;
    for (let i = 0; i < numbers.length; i += 2) {
      const x = numbers[i];
      const y = numbers[i + 1];
      if (typeof x === "number") {
        expect(x).toBeGreaterThanOrEqual(minX + margin);
        expect(x).toBeLessThanOrEqual(minX + width - margin);
      }
      if (typeof y === "number") {
        expect(y).toBeGreaterThanOrEqual(minY + margin);
        expect(y).toBeLessThanOrEqual(minY + height - margin);
      }
    }
  });
});
