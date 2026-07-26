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

async function expectGoogleLogoRendersCleanly(
  page: Page,
  button: ReturnType<Page["getByTestId"]>
) {
  const logo = button.locator("img[src*='google-g-logo']");
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

function providersPayload(includeGoogle: boolean) {
  const credentials = {
    id: "credentials",
    name: "Credentials",
    type: "credentials",
    signinUrl: "/api/auth/signin/credentials",
    callbackUrl: "/api/auth/callback/credentials",
  };
  if (!includeGoogle) return { credentials };
  return {
    credentials,
    google: {
      id: "google",
      name: "Google",
      type: "oauth",
      signinUrl: "/api/auth/signin/google",
      callbackUrl: "/api/auth/callback/google",
    },
  };
}

interface AuthFixtureOptions {
  includeGoogle?: boolean;
  holdGoogleSignin?: boolean;
  abortGoogleSignin?: boolean;
}

// Fully intercepts every NextAuth endpoint these pages touch — no request
// ever reaches Google, and no credentials are ever sent anywhere real.
async function installAuthFixture(page: Page, options: AuthFixtureOptions = {}) {
  const includeGoogle = options.includeGoogle ?? true;
  const googleSigninRequests: Array<{ method: string; postData: string | null }> = [];
  const facebookSigninRequests: Array<{ method: string; postData: string | null }> = [];
  const credentialsCallbackRequests: Array<{ method: string; postData: string | null }> = [];
  const heldGoogleSignin: Route[] = [];

  await page.route("**/api/auth/session", (route) => fulfill(route, {}));
  await page.route("**/api/auth/csrf", (route) => fulfill(route, { csrfToken: "test-csrf-token" }));
  await page.route("**/api/auth/providers", (route) => fulfill(route, providersPayload(includeGoogle)));

  // Provider discovery never returns Facebook in these Google-focused tests,
  // so no Facebook button should ever render or POST here — tracked so
  // tests can assert zero Facebook requests occurred.
  await page.route("**/api/auth/signin/facebook", async (route) => {
    facebookSigninRequests.push({
      method: route.request().method(),
      postData: route.request().postData(),
    });
    await fulfill(route, { url: "/auth/signin?facebook-init=1" });
  });

  await page.route("**/api/auth/signin/google", async (route) => {
    googleSigninRequests.push({
      method: route.request().method(),
      postData: route.request().postData(),
    });
    if (options.abortGoogleSignin) {
      await route.abort("failed");
      return;
    }
    if (options.holdGoogleSignin) {
      heldGoogleSignin.push(route);
      return;
    }
    // Model the JSON response consumed by next-auth/react before it assigns
    // the returned destination to window.location.href.
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
    googleSigninRequests,
    facebookSigninRequests,
    credentialsCallbackRequests,
    releaseGoogleSignin: async () => {
      for (const route of heldGoogleSignin.splice(0)) {
        await fulfill(route, { url: "/auth/signin?google-init=1" });
      }
    },
  };
}

test.describe("Google auth — provider absent", () => {
  test("Credentials-only provider list hides Google actions but keeps Credentials forms usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAuthFixture(page, { includeGoogle: false });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toHaveCount(0);
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();

    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByRole("button", { name: /Sign up with Google/i })).toHaveCount(0);
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
  });
});

test.describe("Google auth — provider present", () => {
  test("Google actions render correctly on sign-in and registration, and do not submit Credentials forms", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installAuthFixture(page, { includeGoogle: true });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const googleButton = page.getByTestId("google-signin-button");
    await expect(googleButton).toBeVisible();
    const box = await googleButton.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.9);
    await expect(page.getByText("or continue with email")).toBeVisible();
    await expectGoogleLogoRendersCleanly(page, googleButton);
    // Provider discovery in this fixture never includes Facebook.
    await expect(page.getByTestId("facebook-signin-button")).toHaveCount(0);

    await googleButton.click();
    await expect(page).toHaveURL(/\/auth\/signin\?google-init=1$/);
    expect(fixture.googleSigninRequests).toHaveLength(1);
    expect(fixture.googleSigninRequests[0].method).toBe("POST");
    expect(fixture.googleSigninRequests[0].postData).toContain("callbackUrl=%2Fdashboard");
    // The click must never also submit the Credentials form.
    expect(fixture.credentialsCallbackRequests.length).toBe(0);
    expect(fixture.facebookSigninRequests).toHaveLength(0);

    await expectNoHorizontalOverflow(page);

    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const signUpButton = page.getByTestId("google-signup-button");
    await expect(signUpButton).toBeVisible();
    const signUpBox = await signUpButton.boundingBox();
    expect(signUpBox!.height).toBeGreaterThanOrEqual(43.9);
    await expect(page.getByText("or create an account with email")).toBeVisible();
    await expectGoogleLogoRendersCleanly(page, signUpButton);
    await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    await expect(page.getByTestId("facebook-signup-button")).toHaveCount(0);

    await signUpButton.click();
    await expect(page).toHaveURL(/\/auth\/signin\?google-init=1$/);
    expect(fixture.googleSigninRequests).toHaveLength(2);
    expect(fixture.googleSigninRequests[1].method).toBe("POST");
    expect(fixture.googleSigninRequests[1].postData).toContain("callbackUrl=%2Fdashboard");
    expect(fixture.credentialsCallbackRequests).toHaveLength(0);
    expect(fixture.facebookSigninRequests).toHaveLength(0);

    await expectNoHorizontalOverflow(page);
  });

  test("no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await installAuthFixture(page, { includeGoogle: true });
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByTestId("google-signin-button")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByTestId("google-signup-button")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Google logo asset is a clean, transparent, G-only SVG", async ({ page }) => {
    await installAuthFixture(page, { includeGoogle: true });
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });

    const response = await page.request.get("/images/google-g-logo.svg");
    expect(response.ok()).toBe(true);

    const svg = await response.text();
    expect(svg).toContain("viewBox");
    for (const color of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]) {
      expect(svg).toContain(color);
    }

    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain("<filter");
    expect(svg).not.toContain("<mask");
    expect(svg).not.toContain("fill=\"white\"");
    expect(svg).not.toContain("fill=\"#fff");
    expect(svg.toLowerCase()).not.toContain("figma");
    // The xmlns declaration is not a network reference; only flag actual
    // http(s) links elsewhere in the markup (e.g. href/src attributes).
    expect(svg.replace(/xmlns(:\w+)?="https?:\/\/[^"]*"/g, "")).not.toMatch(/https?:\/\//);
  });
});

test.describe("Google auth — duplicate invocation", () => {
  test("rapid clicks initiate Google sign-in exactly once, with correct pending state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installAuthFixture(page, { includeGoogle: true, holdGoogleSignin: true });

    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const googleButton = page.getByTestId("google-signin-button");
    await googleButton.click();
    await googleButton.click({ force: true });
    await googleButton.click({ force: true });

    await expect.poll(() => fixture.googleSigninRequests.length).toBe(1);
    await expect(googleButton).toContainText("Connecting to Google…");
    await expect(googleButton).toBeDisabled();

    // Credentials inputs remain usable — Google initiation alone doesn't
    // disable the rest of the page (navigation hasn't begun yet).
    await expect(page.getByPlaceholder("you@example.com")).toBeEditable();
    await expect(page.getByPlaceholder("••••••••")).toBeEditable();

    await fixture.releaseGoogleSignin();
  });
});

test.describe("Google auth — initiation failure", () => {
  test("sign-in reports failure, releases the guard, and permits one retry", async ({ page }) => {
    const fixture = await installAuthFixture(page, { abortGoogleSignin: true });
    await page.goto("/auth/signin", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const button = page.getByTestId("google-signin-button");
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByText("Google sign-in could not be started. Please try again.")).toBeVisible();
    await expect(button).toHaveText("Continue with Google");
    await expect(button).toBeEnabled();
    expect(fixture.googleSigninRequests).toHaveLength(1);

    await button.click();
    await expect.poll(() => fixture.googleSigninRequests.length).toBe(2);
    expect(fixture.credentialsCallbackRequests).toHaveLength(0);
  });

  test("registration reports failure, releases the guard, and permits one retry", async ({ page }) => {
    const fixture = await installAuthFixture(page, { abortGoogleSignin: true });
    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const button = page.getByTestId("google-signup-button");
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByText("Google sign-up could not be started. Please try again.")).toBeVisible();
    await expect(button).toHaveText("Sign up with Google");
    await expect(button).toBeEnabled();
    expect(fixture.googleSigninRequests).toHaveLength(1);

    await button.click();
    await expect.poll(() => fixture.googleSigninRequests.length).toBe(2);
    expect(fixture.credentialsCallbackRequests).toHaveLength(0);
  });
});

test.describe("Google auth — error page", () => {
  test("known error codes show their exact safe message; unknown codes fall back to the generic message", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAuthFixture(page, { includeGoogle: true });

    await page.goto("/auth/error?error=OAuthAccountNotLinked", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByTestId("auth-error-message")).toHaveText(
      "An account already exists with this email. Sign in using the method you originally used. Account linking will be added from Account Settings in a later pass."
    );

    await page.goto("/auth/error?error=AccessDenied", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("auth-error-message")).toHaveText("This social account is not currently approved for PuzzleWarz access.");

    await page.goto("/auth/error?error=Configuration", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("auth-error-message")).toHaveText(
      "Social sign-in is temporarily unavailable. Please use email and password or try again later."
    );

    await page.goto("/auth/error?error=SomeTotallyUnknownCode", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("auth-error-message")).toHaveText("Social sign-in could not be completed. Please try again.");

    // Arbitrary query content must never be rendered directly.
    await page.goto("/auth/error?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("auth-error-message")).toHaveText("Social sign-in could not be completed. Please try again.");
    await expect(page.locator("script:has-text('alert(1)')")).toHaveCount(0);

    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/auth\/signin$/);

    await expectNoHorizontalOverflow(page);
  });
});
