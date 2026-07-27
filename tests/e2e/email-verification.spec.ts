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

interface ResponseSpec {
  status: number;
  body?: unknown;
  raw?: string;
}

async function fulfillSpec(route: Route, spec: ResponseSpec) {
  if (typeof spec.raw === "string") {
    await route.fulfill({ status: spec.status, contentType: "application/json", body: spec.raw });
    return;
  }
  await fulfill(route, spec.body ?? { ok: true }, spec.status);
}

interface FixtureOptions {
  status?: number;
  body?: unknown;
  raw?: string;
  abort?: boolean;
  hold?: boolean;
  sequence?: ResponseSpec[];
}

function installFixture(urlPattern: string) {
  return async (page: Page, options: FixtureOptions = {}) => {
    const requests: Array<{ method: string; postData: string | null }> = [];
    const held: Route[] = [];
    const sequence = options.sequence ? [...options.sequence] : null;
    const defaultSpec: ResponseSpec = { status: options.status ?? 200, body: options.body, raw: options.raw };

    await page.route(urlPattern, async (route) => {
      requests.push({ method: route.request().method(), postData: route.request().postData() });
      if (options.abort) {
        await route.abort("failed");
        return;
      }
      if (options.hold) {
        held.push(route);
        return;
      }
      const spec = sequence && sequence.length > 0 ? sequence.shift()! : defaultSpec;
      await fulfillSpec(route, spec);
    });

    return {
      requests,
      release: async () => {
        for (const route of held.splice(0)) {
          const spec = sequence && sequence.length > 0 ? sequence.shift()! : defaultSpec;
          await fulfillSpec(route, spec);
        }
      },
    };
  };
}

const installResendFixture = installFixture("**/api/auth/resend-verification");
const installVerifyFixture = installFixture("**/api/auth/verify-email");

const RESEND_SUCCESS_MESSAGE =
  "If this account still needs verification, a new verification link has been sent. Check your inbox and spam folder.";
const RESEND_GENERIC_FAILURE_MESSAGE = "We couldn’t send another verification email. Please try again.";

// Nothing in this suite ever touches a real database, email provider,
// production API, Google, or Facebook — every verification/resend request
// is intercepted above.

test.describe("Verify-sent — initial state", () => {
  test("heading, masked email, resend button, sign-in link, no premature request, no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const resend = await installResendFixture(page, { hold: true });

    await page.goto("/auth/verify-sent?email=Player%40Example.test", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Check your inbox" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    const logo = page.getByRole("img", { name: "Puzzle Warz" });
    const logoBox = await logo.boundingBox();
    expect(logoBox!.height).toBeLessThanOrEqual(80);

    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("player@example.test");
    expect(visibleText).toContain("pl****@example.test");

    await expect(page.getByTestId("verify-sent-resend-button")).toBeVisible();

    const signInLink = page.getByRole("link", { name: "Go to sign in" });
    await expect(signInLink).toHaveAttribute("href", "/auth/signin");

    expect(resend.requests).toHaveLength(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Verify-sent — missing email", () => {
  test("unavailable state appears, no resend button, correct links, no request", async ({ page }) => {
    const resend = await installResendFixture(page);
    await page.goto("/auth/verify-sent", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Verification email unavailable" })).toBeVisible();
    await expect(page.getByTestId("verify-sent-resend-button")).toHaveCount(0);

    await expect(page.getByRole("link", { name: "Back to registration" })).toHaveAttribute("href", "/auth/register");
    await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/auth/signin");

    expect(resend.requests).toHaveLength(0);
  });
});

test.describe("Verify-sent — resend success", () => {
  test("exactly one POST with normalized email, loading state, duplicate protection, privacy-safe success", async ({ page }) => {
    const resend = await installResendFixture(page, { hold: true });
    await page.goto("/auth/verify-sent?email=Player%40Example.test", { waitUntil: "domcontentloaded" });

    const button = page.getByTestId("verify-sent-resend-button");
    await button.click();
    await button.click({ force: true });
    await button.click({ force: true });

    await expect.poll(() => resend.requests.length).toBe(1);
    expect(resend.requests[0].method).toBe("POST");
    const parsed = JSON.parse(resend.requests[0].postData || "{}");
    expect(parsed.email).toBe("player@example.test");

    await expect(button).toContainText("Sending…");
    await expect(button).toBeDisabled();

    await resend.release();

    await expect(page.getByTestId("verify-sent-resend-status")).toContainText(RESEND_SUCCESS_MESSAGE);
    await expect(page.getByTestId("verify-sent-resend-button")).toHaveCount(0);
  });
});

test.describe("Verify-sent — privacy-equivalent successful resend responses", () => {
  for (const [label, body] of [
    ["alreadyVerified", { ok: true, alreadyVerified: true }],
    ["autoVerified", { ok: true, autoVerified: true }],
  ] as const) {
    test(`${label} response shows the exact same public message as a normal success`, async ({ page }) => {
      await installResendFixture(page, { body });
      await page.goto("/auth/verify-sent?email=player%40example.test", { waitUntil: "domcontentloaded" });

      await page.getByTestId("verify-sent-resend-button").click();
      await expect(page.getByTestId("verify-sent-resend-status")).toContainText(RESEND_SUCCESS_MESSAGE);
    });
  }
});

test.describe("Verify-sent — resend failures", () => {
  test("rate limit shows the safe message, alert role, and permits retry", async ({ page }) => {
    const resend = await installResendFixture(page, {
      status: 429,
      body: { error: "Too many verification email requests. Please try again later." },
    });
    await page.goto("/auth/verify-sent?email=player%40example.test", { waitUntil: "domcontentloaded" });

    await page.getByTestId("verify-sent-resend-button").click();

    const alert = page.getByTestId("verify-sent-resend-error");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toHaveText("Too many verification email requests. Please try again later.");
    await expect(page.getByTestId("verify-sent-resend-button")).toBeEnabled();
    expect(resend.requests).toHaveLength(1);
  });

  for (const status of [503, 500]) {
    test(`status ${status} shows the fixed fallback message`, async ({ page }) => {
      await installResendFixture(page, { status, body: { ok: false } });
      await page.goto("/auth/verify-sent?email=player%40example.test", { waitUntil: "domcontentloaded" });

      await page.getByTestId("verify-sent-resend-button").click();
      await expect(page.getByTestId("verify-sent-resend-error")).toHaveText(RESEND_GENERIC_FAILURE_MESSAGE);
    });
  }

  test("network failure shows the fixed message and allows retry with no raw detail", async ({ page }) => {
    const resend = await installResendFixture(page, { abort: true });
    await page.goto("/auth/verify-sent?email=player%40example.test", { waitUntil: "domcontentloaded" });

    await page.getByTestId("verify-sent-resend-button").click();

    const alert = page.getByTestId("verify-sent-resend-error");
    await expect(alert).toHaveText(RESEND_GENERIC_FAILURE_MESSAGE);
    await expect(page.getByTestId("verify-sent-resend-button")).toBeEnabled();
    expect(resend.requests).toHaveLength(1);
  });
});

test.describe("Verify — missing parameters", () => {
  test("no email and no token: error state, no API call, back-to-registration action", async ({ page }) => {
    const verify = await installVerifyFixture(page);
    await page.goto("/auth/verify", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-error")).toBeVisible();
    await expect(page.getByTestId("verify-error-alert")).toHaveText("Invalid verification link.");
    await expect(page.getByRole("link", { name: "Back to registration" })).toHaveAttribute("href", "/auth/register");
    await expect(page.getByTestId("verify-resend-button")).toHaveCount(0);
    expect(verify.requests).toHaveLength(0);
  });

  test("email only, no token: error state, resend available, no API call", async ({ page }) => {
    const verify = await installVerifyFixture(page);
    await page.goto("/auth/verify?email=player%40example.test", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-error")).toBeVisible();
    await expect(page.getByTestId("verify-error-alert")).toHaveText("Invalid verification link.");
    await expect(page.getByTestId("verify-resend-button")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to registration" })).toHaveCount(0);
    expect(verify.requests).toHaveLength(0);
  });

  test("token only, no email: error state, no resend, back-to-registration action, no API call", async ({ page }) => {
    const verify = await installVerifyFixture(page);
    await page.goto("/auth/verify?token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-error")).toBeVisible();
    await expect(page.getByTestId("verify-error-alert")).toHaveText("Invalid verification link.");
    await expect(page.getByTestId("verify-resend-button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to registration" })).toHaveAttribute("href", "/auth/register");

    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("test-verification-token");
    expect(verify.requests).toHaveLength(0);
  });
});

test.describe("Verify — loading and request", () => {
  test("loading state visible, exactly one POST with email+token, no full email/token rendered", async ({ page }) => {
    const verify = await installVerifyFixture(page, { hold: true });

    await page.goto("/auth/verify?email=Player%40Example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-loading")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Verifying your email" })).toBeVisible();

    // Give any Strict Mode double-invoke a moment to (incorrectly) fire a
    // second request before asserting the count.
    await page.waitForTimeout(300);
    expect(verify.requests).toHaveLength(1);
    expect(verify.requests[0].method).toBe("POST");
    const parsed = JSON.parse(verify.requests[0].postData || "{}");
    expect(parsed.email).toBe("Player@Example.test");
    expect(parsed.token).toBe("test-verification-token");

    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("Player@Example.test");
    expect(visibleText).not.toContain("test-verification-token");

    await verify.release();
  });
});

test.describe("Verify — success without rewards", () => {
  test("email verified heading, sign-in-now link, auto redirect ~1500ms, no session cookie", async ({ page }) => {
    await installVerifyFixture(page, { body: { ok: true, prelaunchRewards: null } });

    await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Email verified" })).toBeVisible();
    await expect(page.getByTestId("verify-success-status")).toBeVisible();

    const signInNow = page.getByRole("link", { name: "Sign in now" });
    await expect(signInNow).toHaveAttribute("href", "/auth/signin");

    // 1500ms production redirect + reasonable navigation/timing margin —
    // never shortens or lengthens the actual production delay itself.
    await expect(page).toHaveURL(/\/auth\/signin$/, { timeout: 5000 });

    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(false);
  });
});

test.describe("Verify — success with rewards", () => {
  test("reward modal appears with expected content, no premature redirect, dismiss navigates to sign in", async ({ page }) => {
    await installVerifyFixture(page, {
      body: { ok: true, prelaunchRewards: { xp: 250, points: 175, solves: 3 } },
    });

    await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Email verified" })).toBeVisible();
    await expect(page.getByText("Pre-Launch Rewards Deposited")).toBeVisible();
    await expect(page.getByText("Welcome to PuzzleWarz!")).toBeVisible();

    const dismissButton = page.getByRole("button", { name: /Sign In/ });
    await expect(dismissButton).toBeVisible();

    // Wait well past the normal 1500ms redirect window and confirm the
    // modal-gated verification never auto-navigates.
    await page.waitForTimeout(2200);
    await expect(page).toHaveURL(/\/auth\/verify/);
    await expect(dismissButton).toBeVisible();

    await dismissButton.click();
    await expect(page).toHaveURL(/\/auth\/signin$/);
  });
});

test.describe("Verify — API failure", () => {
  test("safe error in an alert, resend available, go-to-sign-in available, no auto-retry, no token shown", async ({ page }) => {
    const verify = await installVerifyFixture(page, {
      status: 400,
      body: { error: "Invalid or expired verification link" },
    });

    await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Verification unsuccessful" })).toBeVisible();
    await expect(page.getByTestId("verify-error-alert")).toHaveText("Invalid or expired verification link");
    await expect(page.getByTestId("verify-resend-button")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/auth/signin");

    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain("test-verification-token");

    await page.waitForTimeout(500);
    expect(verify.requests).toHaveLength(1);
  });
});

test.describe("Verify — rate limit and server failure", () => {
  test("429 shows the safe API message with no stack trace, single request", async ({ page }) => {
    const verify = await installVerifyFixture(page, {
      status: 429,
      body: { error: "Too many verification attempts. Please try again later." },
    });

    await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-error-alert")).toHaveText("Too many verification attempts. Please try again later.");
    const html = await page.content();
    expect(html.toLowerCase()).not.toContain("stack");
    expect(verify.requests).toHaveLength(1);
  });

  test("500 falls back to the safe message with no stack trace, single request", async ({ page }) => {
    const verify = await installVerifyFixture(page, { status: 500, body: { error: "Verification failed" } });

    await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-error-alert")).toHaveText("Verification failed");
    const html = await page.content();
    expect(html.toLowerCase()).not.toContain("stack");
    expect(verify.requests).toHaveLength(1);
  });
});

test.describe("Verify — network failure", () => {
  test("shows the generic verification-failed message, resend remains available", async ({ page }) => {
    await installVerifyFixture(page, { abort: true });

    await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("verify-error-alert")).toHaveText("Verification failed.");
    await expect(page.getByTestId("verify-resend-button")).toBeVisible();
  });
});

test.describe("Verify — resend from error state", () => {
  test("resend after invalid-verification response: duplicate-protected, normalized email, privacy-safe success", async ({ page }) => {
    await installVerifyFixture(page, { status: 400, body: { error: "Invalid or expired verification link" } });
    const resend = await installResendFixture(page, { hold: true });

    await page.goto("/auth/verify?email=Player%40Example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });

    const resendButton = page.getByTestId("verify-resend-button");
    await resendButton.click();
    await resendButton.click({ force: true });
    await resendButton.click({ force: true });

    await expect.poll(() => resend.requests.length).toBe(1);
    const parsed = JSON.parse(resend.requests[0].postData || "{}");
    expect(parsed.email).toBe("player@example.test");

    await resend.release();

    await expect(page.getByTestId("verify-resend-status")).toContainText(RESEND_SUCCESS_MESSAGE);
  });
});

test.describe("Email verification — responsive", () => {
  for (const viewport of [
    { width: 320, height: 710 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow across major states at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);

      // Verify-sent initial.
      await installResendFixture(page, { hold: true });
      await page.goto("/auth/verify-sent?email=player%40example.test", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify-sent resend success.
      await installResendFixture(page);
      await page.getByTestId("verify-sent-resend-button").click();
      await expect(page.getByTestId("verify-sent-resend-status")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify loading.
      await installVerifyFixture(page, { hold: true });
      await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("verify-loading")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify error.
      await installVerifyFixture(page, { status: 400, body: { error: "Invalid or expired verification link" } });
      await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("verify-error")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify success without rewards.
      await installVerifyFixture(page, { body: { ok: true, prelaunchRewards: null } });
      await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("verify-success")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Verify reward modal.
      await installVerifyFixture(page, { body: { ok: true, prelaunchRewards: { xp: 250, points: 175, solves: 3 } } });
      await page.goto("/auth/verify?email=player%40example.test&token=test-verification-token", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Pre-Launch Rewards Deposited")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
