import { expect, test, type Page, type Route } from "@playwright/test";

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

interface ForgotPasswordFixtureOptions {
  status?: number;
  body?: unknown;
  abort?: boolean;
  hold?: boolean;
}

async function installForgotPasswordFixture(page: Page, options: ForgotPasswordFixtureOptions = {}) {
  const requests: Array<{ method: string; postData: string | null }> = [];
  const held: Route[] = [];

  await page.route("**/api/auth/forgot-password", async (route) => {
    requests.push({ method: route.request().method(), postData: route.request().postData() });
    if (options.abort) {
      await route.abort("failed");
      return;
    }
    if (options.hold) {
      held.push(route);
      return;
    }
    await fulfill(route, options.body ?? { success: true }, options.status ?? 200);
  });

  return {
    requests,
    release: async () => {
      for (const route of held.splice(0)) {
        await fulfill(route, options.body ?? { success: true }, options.status ?? 200);
      }
    },
  };
}

interface ResetPasswordFixtureOptions {
  status?: number;
  body?: unknown;
  abort?: boolean;
  hold?: boolean;
}

async function installResetPasswordFixture(page: Page, options: ResetPasswordFixtureOptions = {}) {
  const requests: Array<{ method: string; postData: string | null }> = [];
  const held: Route[] = [];

  await page.route("**/api/auth/reset-password", async (route) => {
    requests.push({ method: route.request().method(), postData: route.request().postData() });
    if (options.abort) {
      await route.abort("failed");
      return;
    }
    if (options.hold) {
      held.push(route);
      return;
    }
    await fulfill(route, options.body ?? { success: true }, options.status ?? 200);
  });

  return {
    requests,
    release: async () => {
      for (const route of held.splice(0)) {
        await fulfill(route, options.body ?? { success: true }, options.status ?? 200);
      }
    },
  };
}

// Nothing in this suite ever touches a real database, email provider,
// production API, Google, or Facebook — every recovery API call is
// intercepted above, and neither page renders any OAuth UI.

test.describe("Forgot password — initial state", () => {
  test("heading, labeled field, back link, button height, logo size, and no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installForgotPasswordFixture(page);
    await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Email")).toHaveAttribute("required", "");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");

    const backLink = page.getByRole("link", { name: "← Back to sign in" });
    await expect(backLink).toHaveAttribute("href", "/auth/signin");

    const submit = page.getByTestId("forgot-password-submit");
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.9);

    const logo = page.getByRole("img", { name: "Puzzle Warz" });
    const logoBox = await logo.boundingBox();
    expect(logoBox!.height).toBeLessThanOrEqual(80);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Forgot password — successful submission", () => {
  test("exactly one POST with the entered email, loading state, then the privacy-safe sent state", async ({ page }) => {
    const fixture = await installForgotPasswordFixture(page, { hold: true });
    await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Email").fill("player@example.test");
    const submit = page.getByTestId("forgot-password-submit");
    await submit.click();

    await expect(submit).toContainText("Sending…");
    await expect(submit).toBeDisabled();

    await fixture.release();

    await expect(page.getByTestId("forgot-password-sent")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Check your inbox" })).toBeVisible();

    expect(fixture.requests).toHaveLength(1);
    expect(fixture.requests[0].method).toBe("POST");
    const parsed = JSON.parse(fixture.requests[0].postData || "{}");
    expect(parsed.email).toBe("player@example.test");

    const sentText = await page.getByTestId("forgot-password-sent").innerText();
    expect(sentText).not.toContain("player@example.test");

    const backLink = page.getByRole("link", { name: "Back to sign in" });
    await expect(backLink).toHaveAttribute("href", "/auth/signin");
  });
});

test.describe("Forgot password — API failure", () => {
  test("the same privacy-safe sent state appears, with no raw API error", async ({ page }) => {
    const fixture = await installForgotPasswordFixture(page, { status: 500, body: { error: "Internal error: user table constraint violated" } });
    await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Email").fill("player@example.test");
    await page.getByTestId("forgot-password-submit").click();

    await expect(page.getByTestId("forgot-password-sent")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("Internal error");
    expect(html).not.toContain("constraint violated");
    expect(fixture.requests).toHaveLength(1);
  });
});

test.describe("Forgot password — network failure", () => {
  test("the same privacy-safe sent state appears when the request is aborted", async ({ page }) => {
    await installForgotPasswordFixture(page, { abort: true });
    await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Email").fill("player@example.test");
    await page.getByTestId("forgot-password-submit").click();

    await expect(page.getByTestId("forgot-password-sent")).toBeVisible();
  });
});

test.describe("Forgot password — duplicate submission protection", () => {
  test("rapid/forced clicks send exactly one request while loading", async ({ page }) => {
    const fixture = await installForgotPasswordFixture(page, { hold: true });
    await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Email").fill("player@example.test");
    const submit = page.getByTestId("forgot-password-submit");
    await submit.click();
    await submit.click({ force: true });
    await submit.click({ force: true });

    await expect.poll(() => fixture.requests.length).toBe(1);
    await expect(submit).toBeDisabled();

    await fixture.release();
  });
});

test.describe("Reset password — missing token", () => {
  test("redesigned invalid-link card appears, no form, correct links, no API request", async ({ page }) => {
    const fixture = await installResetPasswordFixture(page);
    await page.goto("/auth/reset-password", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("reset-password-missing-token")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Reset link unavailable" })).toBeVisible();
    await expect(page.getByTestId("reset-password-form")).toHaveCount(0);

    const requestNewLink = page.getByRole("link", { name: "Request a new reset link" });
    await expect(requestNewLink).toHaveAttribute("href", "/auth/forgot-password");
    const backLink = page.getByRole("link", { name: "Back to sign in" });
    await expect(backLink).toHaveAttribute("href", "/auth/signin");

    expect(fixture.requests).toHaveLength(0);
  });
});

test.describe("Reset password — valid token initial state", () => {
  test("heading, both password fields, autocomplete, button height, no token text, no overflow", async ({ page }) => {
    await installResetPasswordFixture(page);
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible();
    const newPassword = page.getByLabel("New password", { exact: true });
    const confirmPassword = page.getByLabel("Confirm new password");
    await expect(newPassword).toBeVisible();
    await expect(confirmPassword).toBeVisible();
    await expect(newPassword).toHaveAttribute("autocomplete", "new-password");
    await expect(confirmPassword).toHaveAttribute("autocomplete", "new-password");

    const submit = page.getByTestId("reset-password-submit");
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.9);

    // Check the visible rendered text, not the raw HTML source — Next.js's
    // own hydration payload for useSearchParams() necessarily serializes the
    // current URL's query string into an internal script tag (that's how
    // the framework passes it to the client component), which is not the
    // same thing as the page visibly displaying the token to the user.
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("test-token");

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Reset password — client validation", () => {
  test("short password shows the exact safe message and sends no request", async ({ page }) => {
    const fixture = await installResetPasswordFixture(page);
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await page.getByLabel("New password", { exact: true }).fill("short1");
    await page.getByLabel("Confirm new password").fill("short1");
    await page.getByTestId("reset-password-submit").click();

    await expect(page.getByTestId("reset-password-error")).toHaveText("Password must be at least 8 characters.");
    expect(fixture.requests).toHaveLength(0);
  });

  test("mismatched passwords show the exact safe message and send no request", async ({ page }) => {
    const fixture = await installResetPasswordFixture(page);
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await page.getByLabel("New password", { exact: true }).fill("longenoughpassword1");
    await page.getByLabel("Confirm new password").fill("longenoughpassword2");
    await page.getByTestId("reset-password-submit").click();

    await expect(page.getByTestId("reset-password-error")).toHaveText("Passwords do not match.");
    expect(fixture.requests).toHaveLength(0);
  });
});

test.describe("Reset password — successful reset", () => {
  test("exactly one request with token+password, loading state, success state, Sign In link, no auto-auth", async ({ page }) => {
    const fixture = await installResetPasswordFixture(page, { hold: true });
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await page.getByLabel("New password", { exact: true }).fill("brandNewPassword1");
    await page.getByLabel("Confirm new password").fill("brandNewPassword1");
    const submit = page.getByTestId("reset-password-submit");
    await submit.click();

    await expect(submit).toContainText("Resetting…");
    await expect(submit).toBeDisabled();

    await fixture.release();

    await expect(page.getByTestId("reset-password-success")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Password updated" })).toBeVisible();
    await expect(page.getByTestId("reset-password-form")).toHaveCount(0);

    expect(fixture.requests).toHaveLength(1);
    const parsed = JSON.parse(fixture.requests[0].postData || "{}");
    expect(parsed.token).toBe("test-token");
    expect(parsed.password).toBe("brandNewPassword1");

    const signInLink = page.getByRole("link", { name: "Sign in" });
    await expect(signInLink).toHaveAttribute("href", "/auth/signin");

    // No session/auth cookie should have been set by this flow.
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(false);
  });
});

test.describe("Reset password — expired or invalid token", () => {
  test("safe error in an alert, no raw token rendered, request-new-link visible, form stays usable", async ({ page }) => {
    const fixture = await installResetPasswordFixture(page, {
      status: 400,
      body: { error: "The reset link is invalid or has expired." },
    });
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await page.getByLabel("New password", { exact: true }).fill("brandNewPassword1");
    await page.getByLabel("Confirm new password").fill("brandNewPassword1");
    await page.getByTestId("reset-password-submit").click();

    const alert = page.getByTestId("reset-password-error");
    await expect(alert).toContainText("The reset link is invalid or has expired.");
    // See the visible-rendered-text note in the "valid token initial state"
    // test above — the raw HTML source necessarily contains the token as
    // part of Next.js's own useSearchParams() hydration payload.
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("test-token");

    const requestNewLink = page.getByRole("link", { name: "Request a new reset link" });
    await expect(requestNewLink).toHaveAttribute("href", "/auth/forgot-password");

    // Form remains usable for a retry.
    await expect(page.getByTestId("reset-password-form")).toBeVisible();
    expect(fixture.requests).toHaveLength(1);
  });
});

test.describe("Reset password — network failure", () => {
  test("shows the generic network error in an alert", async ({ page }) => {
    await installResetPasswordFixture(page, { abort: true });
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await page.getByLabel("New password", { exact: true }).fill("brandNewPassword1");
    await page.getByLabel("Confirm new password").fill("brandNewPassword1");
    await page.getByTestId("reset-password-submit").click();

    await expect(page.getByTestId("reset-password-error")).toHaveText("An error occurred. Please try again.");
  });
});

test.describe("Reset password — duplicate submission protection", () => {
  test("rapid/forced clicks send exactly one request while the button stays disabled", async ({ page }) => {
    const fixture = await installResetPasswordFixture(page, { hold: true });
    await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });

    await page.getByLabel("New password", { exact: true }).fill("brandNewPassword1");
    await page.getByLabel("Confirm new password").fill("brandNewPassword1");
    const submit = page.getByTestId("reset-password-submit");
    await submit.click();
    await submit.click({ force: true });
    await submit.click({ force: true });

    await expect.poll(() => fixture.requests.length).toBe(1);
    await expect(submit).toBeDisabled();

    await fixture.release();
  });
});

test.describe("Password recovery — responsive", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow across all major states at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);

      // Forgot-password initial.
      await installForgotPasswordFixture(page, { hold: true });
      await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Forgot-password sent.
      await installForgotPasswordFixture(page);
      await page.getByLabel("Email").fill("player@example.test");
      await page.getByTestId("forgot-password-submit").click();
      await expect(page.getByTestId("forgot-password-sent")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Reset-password form.
      await installResetPasswordFixture(page, { hold: true });
      await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Reset-password missing-token.
      await page.goto("/auth/reset-password", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("reset-password-missing-token")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Reset-password success.
      await installResetPasswordFixture(page);
      await page.goto("/auth/reset-password?token=test-token", { waitUntil: "domcontentloaded" });
      await page.getByLabel("New password", { exact: true }).fill("brandNewPassword1");
      await page.getByLabel("Confirm new password").fill("brandNewPassword1");
      await page.getByTestId("reset-password-submit").click();
      await expect(page.getByTestId("reset-password-success")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
