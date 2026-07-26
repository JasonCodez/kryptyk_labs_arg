import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER_ID = "profile-completion-user";
const USER_EMAIL = "profile-completion-tester@example.test";

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
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

// Seeds a real, signed NextAuth session cookie so the server-side proxy
// (which decodes the cookie directly, never through the browser network
// layer) treats the browser as authenticated for protected paths like
// /dashboard — without ever touching Google or a real database.
async function authenticate(page: Page, name: string | null) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER_ID, id: USER_ID, name, email: USER_EMAIL, role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
}

function sessionPayload(name: string | null) {
  return {
    user: { id: USER_ID, name, email: USER_EMAIL, role: "user", betaApproved: true },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

interface FixtureOptions {
  authenticated?: boolean;
  initialName?: string | null;
  updateNameStatus?: number;
  updateNameBody?: unknown;
  holdUpdateName?: boolean;
  holdSession?: boolean;
}

// Fully intercepts every NextAuth and application API call this suite
// touches — no request ever reaches Google, a Credentials callback, or a
// real database.
async function installFixture(page: Page, options: FixtureOptions = {}) {
  let authenticated = options.authenticated ?? true;
  let currentName: string | null = options.initialName === undefined ? null : options.initialName;
  let pendingFailure: { status: number; body: unknown } | null =
    options.updateNameStatus && options.updateNameStatus !== 200
      ? {
          status: options.updateNameStatus,
          body: options.updateNameBody ?? { error: "Display name could not be saved. Please try again." },
        }
      : null;
  const updateNameRequests: Array<{ method: string; postData: string | null }> = [];
  const forbiddenRequests: string[] = [];
  const held: Route[] = [];
  const heldSession: Route[] = [];
  let sessionRequestCount = 0;

  await page.route(/accounts\.google\.com|googleapis\.com/, async (route) => {
    forbiddenRequests.push(route.request().url());
    await route.abort("failed");
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (
      path === "/api/auth/signin/google" ||
      path === "/api/auth/callback/google" ||
      path === "/api/auth/callback/credentials"
    ) {
      forbiddenRequests.push(path);
      return fulfill(route, { url: "/auth/signin" });
    }

    if (path === "/api/auth/csrf") {
      return fulfill(route, { csrfToken: "test-csrf-token" });
    }

    if (path === "/api/auth/providers") {
      return fulfill(route, {
        credentials: {
          id: "credentials",
          name: "Credentials",
          type: "credentials",
          signinUrl: "/api/auth/signin/credentials",
          callbackUrl: "/api/auth/callback/credentials",
        },
      });
    }

    if (path === "/api/auth/session") {
      sessionRequestCount += 1;
      if (!authenticated) return fulfill(route, {});
      if (options.holdSession) {
        heldSession.push(route);
        return;
      }
      // Both the initial GET and the POST issued by useSession().update()
      // resolve to the trusted, currently-persisted name — never anything
      // the client itself passed to update().
      return fulfill(route, sessionPayload(currentName));
    }

    if (path === "/api/auth/signout") {
      // A real sign-out clears the session cookie server-side; mirror that
      // so the sign-in page's own "already logged in" redirect doesn't fire
      // and bounce the test straight back into the app.
      authenticated = false;
      return fulfill(route, { url: "/auth/signin" });
    }

    if (path === "/api/user/update-name" && method === "POST") {
      updateNameRequests.push({ method, postData: request.postData() });

      if (options.holdUpdateName) {
        held.push(route);
        return;
      }

      if (pendingFailure) {
        const failure = pendingFailure;
        pendingFailure = null; // one-shot, so a manual retry can succeed
        return fulfill(route, failure.body, failure.status);
      }

      const body = JSON.parse(request.postData() || "{}");
      const name = typeof body.name === "string" ? body.name : currentName;
      currentName = name;
      return fulfill(route, { success: true, user: { id: USER_ID, name, nameChanged: false } });
    }

    // Any other API call this suite doesn't exercise (dashboard stats,
    // achievements, socket handshake helpers, etc.) — a harmless stub so
    // unrelated fetches never throw or reach a real database.
    if (method === "GET") return fulfill(route, {});
    return fulfill(route, { success: false });
  });

  return {
    updateNameRequests,
    forbiddenRequests,
    getCurrentName: () => currentName,
    releaseUpdateName: async () => {
      for (const route of held.splice(0)) {
        const body = JSON.parse(route.request().postData() || "{}");
        const name = typeof body.name === "string" ? body.name : currentName;
        currentName = name;
        await fulfill(route, { success: true, user: { id: USER_ID, name, nameChanged: false } });
      }
    },
    sessionRequestCount: () => sessionRequestCount,
    heldSessionCount: () => heldSession.length,
    releaseSession: async (body: unknown) => {
      for (const route of heldSession.splice(0)) {
        await fulfill(route, body);
      }
    },
  };
}

test.describe("OAuth profile completion — mandatory redirect", () => {
  test("a nameless authenticated user visiting /dashboard is redirected to /auth/complete-profile without dashboard content ever appearing", async ({
    page,
  }) => {
    await authenticate(page, null);
    await installFixture(page, { initialName: null });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.waitForURL(/\/auth\/complete-profile$/);
    await expect(page.getByText(/Ready for another round/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Choose your display name" })).toBeVisible();
  });

  test("dashboard and AppChrome content stay suppressed while the initial session request is still pending", async ({ page }) => {
    await authenticate(page, null);
    const fixture = await installFixture(page, { initialName: null, holdSession: true });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // Wait for the client to actually issue (and this fixture to hold) the
    // initial session fetch before asserting anything about that window.
    await expect.poll(() => fixture.sessionRequestCount()).toBeGreaterThan(0);
    expect(fixture.heldSessionCount()).toBeGreaterThan(0);

    // While useSession() status is still "loading", repeatedly confirm that
    // neither dashboard content, AppChrome navigation, nor the completion
    // page's own heading has rendered — and that the browser hasn't yet
    // navigated away from /dashboard.
    for (let i = 0; i < 3; i += 1) {
      await expect(page.getByText(/Ready for another round/)).toHaveCount(0);
      await expect(page.getByRole("navigation")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Choose your display name" })).toHaveCount(0);
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.waitForTimeout(150);
    }

    // The session request must still be genuinely unresolved at this point —
    // proving the assertions above covered the loading window, not a race.
    expect(fixture.heldSessionCount()).toBeGreaterThan(0);

    await fixture.releaseSession({
      user: { id: USER_ID, name: null, email: USER_EMAIL, role: "user", betaApproved: true },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await page.waitForURL(/\/auth\/complete-profile$/);
    await expect(page.getByRole("heading", { name: "Choose your display name" })).toBeVisible();
    await expect(page.getByText(/Ready for another round/)).toHaveCount(0);
  });

  test("a named authenticated user uses the dashboard normally, with no redirect to the completion page", async ({ page }) => {
    await authenticate(page, "ExistingPlayer");
    await installFixture(page, { initialName: "ExistingPlayer" });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByText(/Ready for another round/)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a named user visiting the completion page is redirected to /dashboard", async ({ page }) => {
    await authenticate(page, "ExistingPlayer");
    await installFixture(page, { initialName: "ExistingPlayer" });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.waitForURL(/\/dashboard$/);
  });

  test("an unauthenticated visitor to the completion page is redirected to /auth/signin", async ({ page }) => {
    await installFixture(page, { authenticated: false });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.waitForURL(/\/auth\/signin$/);
  });
});

test.describe("OAuth profile completion — privacy", () => {
  test("the completion page never renders the session email and explains that the email stays private", async ({ page }) => {
    await authenticate(page, null);
    await installFixture(page, { initialName: null });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: "Choose your display name" })).toBeVisible();
    await expect(page.getByText("Other players will see this name. Your email address stays private.")).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain(USER_EMAIL);
  });
});

test.describe("OAuth profile completion — submission behavior", () => {
  test("rapid submit clicks create exactly one update-name request", async ({ page }) => {
    await authenticate(page, null);
    const fixture = await installFixture(page, { initialName: null, holdUpdateName: true });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("complete-profile-name-input").fill("NewPlayer1");
    const submit = page.getByTestId("complete-profile-submit");
    await submit.click();
    await submit.click({ force: true });
    await submit.click({ force: true });

    await expect.poll(() => fixture.updateNameRequests.length).toBe(1);
    await expect(submit).toBeDisabled();

    await fixture.releaseUpdateName();
    await page.waitForURL(/\/dashboard$/);
  });

  test("a validation error is displayed and the user can retry successfully", async ({ page }) => {
    await authenticate(page, null);
    const fixture = await installFixture(page, {
      initialName: null,
      updateNameStatus: 409,
      updateNameBody: { error: "This display name is already taken" },
    });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("complete-profile-name-input").fill("TakenName");
    await page.getByTestId("complete-profile-submit").click();

    await expect(page.getByTestId("complete-profile-error")).toHaveText("This display name is already taken");
    await expect(page.getByTestId("complete-profile-submit")).toBeEnabled();

    await page.getByTestId("complete-profile-name-input").fill("FreshName");
    await page.getByTestId("complete-profile-submit").click();

    await page.waitForURL(/\/dashboard$/);
    expect(fixture.updateNameRequests).toHaveLength(2);
  });

  test("a successful save sends exactly one update-name request, the session refresh reflects the persisted name, and the page redirects to /dashboard", async ({
    page,
  }) => {
    await authenticate(page, null);
    const fixture = await installFixture(page, { initialName: null });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("complete-profile-name-input").fill("RefreshedName");
    await page.getByTestId("complete-profile-submit").click();

    await page.waitForURL(/\/dashboard$/);
    expect(fixture.updateNameRequests).toHaveLength(1);
    expect(fixture.getCurrentName()).toBe("RefreshedName");
  });

  test("the completion flow never contacts a Credentials callback or a real OAuth endpoint", async ({ page }) => {
    await authenticate(page, null);
    const fixture = await installFixture(page, { initialName: null });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await page.getByTestId("complete-profile-name-input").fill("SafeFlow");
    await page.getByTestId("complete-profile-submit").click();
    await page.waitForURL(/\/dashboard$/);

    expect(fixture.forbiddenRequests).toHaveLength(0);
  });
});

test.describe("OAuth profile completion — sign out and layout", () => {
  test("sign out from the completion page returns to /auth/signin", async ({ page }) => {
    await authenticate(page, null);
    await installFixture(page, { initialName: null });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("complete-profile-sign-out").click();
    await page.waitForURL(/\/auth\/signin$/);
  });

  test("no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await authenticate(page, null);
    await installFixture(page, { initialName: null });

    await page.goto("/auth/complete-profile", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await expect(page.getByRole("heading", { name: "Choose your display name" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
