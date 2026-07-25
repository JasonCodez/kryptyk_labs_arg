import { expect, test, type Page, type Route } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { encode } from "next-auth/jwt";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const USER = { id: "me", name: "MeTester" };

const TEAMS_FIXTURE = [
  { id: "joined-a", name: "Midnight Puzzle Society", description: "We solve puzzles together every week.", isPublic: false, createdAt: "2026-01-01T00:00:00.000Z", members: [{ user: { id: "me", name: "MeTester", image: null }, role: "admin" }] },
  { id: "joined-b", name: "Second Joined Crew", description: "Another team I'm on.", isPublic: true, createdAt: "2026-01-02T00:00:00.000Z", members: [{ user: { id: "me", name: "MeTester", image: null }, role: "member" }, { user: { id: "other-1", name: "Other One", image: null }, role: "admin" }] },
  { id: "public-only", name: "Open Crossword Club", description: "Anyone can join us.", isPublic: true, createdAt: "2026-01-03T00:00:00.000Z", members: [{ user: { id: "other-2", name: "Other Two", image: null }, role: "admin" }] },
  { id: "private-not-joined", name: "Secret Society", description: "Private and not joined.", isPublic: false, createdAt: "2026-01-04T00:00:00.000Z", members: [{ user: { id: "other-3", name: "Other Three", image: null }, role: "admin" }] },
  { id: "blank-name", name: "   ", description: "Has a blank name.", isPublic: true, createdAt: "2026-01-05T00:00:00.000Z", members: [{ user: { id: "other-4", name: null, image: null }, role: "admin" }] },
  { id: "missing-description", name: "No Description Team", description: null, isPublic: true, createdAt: "2026-01-06T00:00:00.000Z", members: [] },
  {
    id: "long-content",
    name: "The Ridiculously Long-Named Interdimensional Puzzle Consortium of Champions",
    description: "This is a deliberately long description meant to test wrapping and overflow behavior across every supported viewport width, including the narrowest 320 pixel breakpoint required by this pass.",
    isPublic: true,
    createdAt: "2026-01-07T00:00:00.000Z",
    members: [{ user: { id: "other-5", name: "Other Five", image: null }, role: "admin" }],
  },
];

async function authenticate(page: Page) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for protected-route browser tests");
  const token = await encode({
    secret,
    maxAge: 3600,
    token: { sub: USER.id, id: USER.id, name: USER.name, email: "me-tester@example.test", role: "user", betaApproved: true },
  });
  await page.context().addCookies([
    { name: "next-auth.session-token", value: token, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
  ]);
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

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

interface FixtureOptions {
  authenticated?: boolean;
  teamStatus?: number;
  teamPayload?: unknown;
  invitationPayload?: unknown;
  holdTeams?: boolean;
  createStatus?: number;
  createResponse?: unknown;
  createPlainTextError?: string;
  holdCreate?: boolean;
  teamPayloadAfterCreate?: unknown;
}

async function installFixture(page: Page, options: FixtureOptions = {}) {
  let teamRequests = 0;
  const invitationRequests: Array<{ method: string }> = [];
  const mutations: Array<{ url: string; method: string }> = [];
  const held: Route[] = [];
  const heldCreate: Route[] = [];
  const createRequests: Array<{ method: string; url: string; headers: Record<string, string>; body: string | null }> = [];
  let created = false;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method !== "GET" && path.startsWith("/api/teams")) mutations.push({ url: path, method });

    if (path === "/api/auth/session") {
      if (!options.authenticated) return fulfill(route, {});
      return fulfill(route, { user: { id: USER.id, name: USER.name, email: "me-tester@example.test" }, expires: "2099-01-01T00:00:00.000Z" });
    }

    if (path === "/api/teams/invitations") {
      invitationRequests.push({ method });
      return fulfill(route, options.invitationPayload ?? []);
    }

    // POST /api/teams must be matched before the GET branch below.
    if (path === "/api/teams" && method === "POST") {
      createRequests.push({
        method,
        url: path,
        headers: request.headers(),
        body: request.postData(),
      });
      if (options.holdCreate) {
        heldCreate.push(route);
        return;
      }
      if (options.createPlainTextError) {
        return route.fulfill({
          status: options.createStatus ?? 503,
          contentType: "text/plain",
          body: options.createPlainTextError,
        });
      }
      if (options.createStatus && options.createStatus !== 200 && options.createStatus !== 201) {
        return fulfill(route, options.createResponse ?? { error: "failed" }, options.createStatus);
      }
      created = true;
      return fulfill(route, options.createResponse ?? { id: "new-team", ...TEAMS_FIXTURE[0] }, 201);
    }

    if (path === "/api/teams" && method === "GET") {
      teamRequests += 1;
      if (options.holdTeams) {
        held.push(route);
        return;
      }
      if (options.teamStatus && options.teamStatus !== 200) return fulfill(route, { error: "failed" }, options.teamStatus);
      if (created && options.teamPayloadAfterCreate) return fulfill(route, options.teamPayloadAfterCreate);
      return fulfill(route, options.teamPayload ?? TEAMS_FIXTURE);
    }

    return fulfill(route, {});
  });

  return {
    teamRequestCount: () => teamRequests,
    invitationRequests,
    mutations,
    createRequests,
    release: async (body: unknown, status = 200) => {
      for (const route of held.splice(0)) await fulfill(route, body, status);
    },
    releaseCreate: async (body: unknown = { id: "new-team", ...TEAMS_FIXTURE[0] }, status = 201) => {
      created = status >= 200 && status < 300;
      for (const route of heldCreate.splice(0)) await fulfill(route, body, status);
    },
  };
}

test.describe("Teams hub — authenticated", () => {
  test("member lands in My Teams, switches to Public Teams, with exact ordering and no mutation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true, invitationPayload: [{ id: "inv-1" }, { id: "inv-2" }] });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByTestId("teams-hub-header")).toBeVisible();
    const headerText = await page.getByTestId("teams-hub-header").innerText();
    expect(/[\u{1F300}-\u{1FAFF}]/u.test(headerText)).toBe(false);

    await expect(page.getByTestId("teams-hub-view-mine")).toBeVisible();
    await expect(page.getByTestId("teams-hub-view-public")).toBeVisible();
    await expect(page.getByTestId("teams-hub-view-mine")).toHaveAttribute("aria-pressed", "true");

    await expect(page.getByTestId("teams-hub-create")).toBeVisible();
    await expect(page.getByTestId("teams-hub-invitations")).toBeVisible();
    await expect(page.getByTestId("teams-hub-invitations")).toHaveAttribute("aria-label", "Invitations, 2 pending");

    // Joined Teams render in exact API order.
    const grid = page.getByTestId("teams-hub-grid");
    const cards = grid.locator("a");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAttribute("data-testid", "teams-hub-team-joined-a");
    await expect(cards.nth(1)).toHaveAttribute("data-testid", "teams-hub-team-joined-b");

    // A public non-joined Team is absent from My Teams; private joined Team appears.
    await expect(page.getByTestId("teams-hub-team-public-only")).toHaveCount(0);
    await expect(page.getByTestId("teams-hub-team-joined-a")).toBeVisible();

    for (const card of await cards.all()) {
      const box = await card.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(43.9);
    }
    await expect(page.getByTestId("teams-hub-team-joined-a")).toHaveAttribute("href", "/teams/joined-a");

    await expectNoHorizontalOverflow(page);

    const teamRequestsBeforeSwitch = fixture.teamRequestCount();

    // Switch to Public Teams — no new Team fetch.
    await page.getByTestId("teams-hub-view-public").click();
    await expect(page.getByTestId("teams-hub-view-public")).toHaveAttribute("aria-pressed", "true");

    const publicGrid = page.getByTestId("teams-hub-grid");
    const publicCards = publicGrid.locator("a");
    // Public teams in API order: joined-b, public-only, blank-name, missing-description, long-content.
    await expect(publicCards).toHaveCount(5);
    await expect(publicCards.nth(0)).toHaveAttribute("data-testid", "teams-hub-team-joined-b");
    await expect(publicCards.nth(1)).toHaveAttribute("data-testid", "teams-hub-team-public-only");
    await expect(page.getByTestId("teams-hub-team-private-not-joined")).toHaveCount(0);

    expect(fixture.teamRequestCount()).toBe(teamRequestsBeforeSwitch);

    // Switch back — still no new Team fetch.
    await page.getByTestId("teams-hub-view-mine").click();
    await expect(page.getByTestId("teams-hub-view-mine")).toHaveAttribute("aria-pressed", "true");
    expect(fixture.teamRequestCount()).toBe(teamRequestsBeforeSwitch);

    expect(fixture.mutations.length).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test("long Team content causes no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await authenticate(page);
    await installFixture(page, { authenticated: true });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("teams-hub-view-public").click();
    await expect(page.getByTestId("teams-hub-team-long-content")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — anonymous", () => {
  test("anonymous visitor browses Public Teams only, with sign-in action and no mutation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await installFixture(page, { authenticated: false });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page).not.toHaveURL(/\/auth\/signin/);

    await expect(page.getByTestId("teams-hub-view-mine")).toHaveCount(0);
    await expect(page.getByTestId("teams-hub-create")).toHaveCount(0);
    await expect(page.getByTestId("teams-hub-invitations")).toHaveCount(0);

    const signIn = page.getByTestId("teams-hub-sign-in");
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/auth/signin");

    await expect(page.getByTestId("teams-hub-team-private-not-joined")).toHaveCount(0);

    const grid = page.getByTestId("teams-hub-grid");
    const cards = grid.locator("a");
    await expect(cards).toHaveCount(5);
    await expect(cards.nth(0)).toHaveAttribute("data-testid", "teams-hub-team-joined-b");
    await expect(cards.nth(1)).toHaveAttribute("data-testid", "teams-hub-team-public-only");

    expect(fixture.invitationRequests.length).toBe(0);
    expect(fixture.mutations.length).toBe(0);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — loading and retry", () => {
  test("skeleton renders, then error and retry recover with exactly one retry request", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true, holdTeams: true });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const loading = page.getByTestId("teams-hub-loading");
    await expect(loading).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading teams" })).toHaveCount(1);
    const skeletonCards = loading.locator('[data-skeleton="true"]');
    expect(await skeletonCards.count()).toBeGreaterThanOrEqual(3);
    await expectNoHorizontalOverflow(page);

    await fixture.release({ error: "failed" }, 500);
    await expect(page.getByTestId("teams-hub-error")).toBeVisible();
    await expect(page.getByRole("heading", { name: "We couldn’t load teams" })).toBeVisible();

    const retryFixture = await installFixture(page, { authenticated: true, holdTeams: true });
    const retryButton = page.getByTestId("teams-hub-retry");
    await retryButton.evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => retryFixture.teamRequestCount()).toBe(1);
    await expect(page.getByTestId("teams-hub-retry")).toHaveText(/Trying…/);
    await expect(page.getByTestId("teams-hub-retry")).toBeDisabled();
    await expect(page.getByTestId("teams-hub-error")).toBeVisible();

    await retryFixture.release(TEAMS_FIXTURE);
    await expect(page.getByTestId("teams-hub-grid")).toBeVisible();
    await expect(page.getByTestId("teams-hub-error")).toHaveCount(0);

    expect(retryFixture.mutations.length).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — empty state", () => {
  test("My Teams empty state offers Explore Public Teams and Create Team without an extra fetch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const noJoinedTeams = TEAMS_FIXTURE.filter((t) => !t.members.some((m) => m.user.id === "me"));
    const fixture = await installFixture(page, { authenticated: true, teamPayload: noJoinedTeams });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(page.getByRole("heading", { name: "You’re not on a team yet" })).toBeVisible();
    const emptyState = page.getByTestId("teams-hub-empty");
    await expect(emptyState.getByRole("button", { name: "Explore Public Teams" })).toBeVisible();
    await expect(emptyState.getByRole("button", { name: "Create Team" })).toBeVisible();

    const teamRequestsBefore = fixture.teamRequestCount();
    await emptyState.getByRole("button", { name: "Explore Public Teams" }).click();
    await expect(page.getByTestId("teams-hub-grid")).toBeVisible();
    expect(fixture.teamRequestCount()).toBe(teamRequestsBefore);

    expect(fixture.mutations.length).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — create team (Pass 17B)", () => {
  test("successful creation: exact request, pending containment, and exactly one Teams reload", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const createdTeam = { id: "night-owl-solvers", name: "Night Owl Solvers", description: "Late-night puzzle fans.", isPublic: false, createdAt: "2026-02-01T00:00:00.000Z", members: [{ user: { id: "me", name: "MeTester", image: null }, role: "admin" }] };
    const fixture = await installFixture(page, {
      authenticated: true,
      holdCreate: true,
      createResponse: createdTeam,
      teamPayloadAfterCreate: [...TEAMS_FIXTURE, createdTeam],
    });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const createTrigger = page.getByTestId("teams-hub-create");
    await expect(createTrigger).toBeVisible();
    const triggerBox = await createTrigger.boundingBox();
    expect(triggerBox!.height).toBeGreaterThanOrEqual(43.9);

    await createTrigger.click();
    const dialog = page.getByTestId("create-team-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("heading", { name: "Create New Team" })).toBeVisible();
    await expect(page.getByTestId("create-team-name")).toBeFocused();
    await expectNoHorizontalOverflow(page);
    const dialogBox = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(dialogBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(dialogBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.getByTestId("create-team-visibility-public")).toBeChecked();

    await page.getByTestId("create-team-name").fill("Night Owl Solvers");
    await page.getByTestId("create-team-description").fill("Late-night puzzle fans.");
    await page.getByTestId("create-team-visibility-private").click();

    const submit = page.getByTestId("create-team-submit");
    await submit.click();
    await expect.poll(() => fixture.createRequests.length).toBe(1);

    // Repeated activation while pending creates no second POST.
    await submit.click({ force: true });
    await page.keyboard.press("Enter");
    expect(fixture.createRequests.length).toBe(1);

    const createRequest = fixture.createRequests[0]!;
    expect(createRequest.url).toBe("/api/teams");
    expect(createRequest.method).toBe("POST");
    expect(createRequest.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(createRequest.body ?? "{}")).toEqual({
      name: "Night Owl Solvers",
      description: "Late-night puzzle fans.",
      isPublic: false,
    });

    await expect(submit).toHaveText(/Creating…/);
    await expect(page.getByTestId("create-team-name")).toBeDisabled();
    await expect(page.getByTestId("create-team-description")).toBeDisabled();
    await expect(page.getByTestId("create-team-visibility-public")).toBeDisabled();
    await expect(page.getByTestId("create-team-visibility-private")).toBeDisabled();
    await expect(page.getByTestId("create-team-cancel")).toBeDisabled();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(dialog).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();

    await expect(createTrigger).not.toBeFocused();

    const teamRequestsBeforeRelease = fixture.teamRequestCount();
    await fixture.releaseCreate(createdTeam, 201);

    await expect(dialog).toHaveCount(0);
    await expect.poll(() => fixture.teamRequestCount()).toBe(teamRequestsBeforeRelease + 1);
    await expect(page).toHaveURL(/\/teams$/);
    await expect(page.getByTestId("teams-hub-view-mine")).toHaveAttribute("aria-pressed", "true");

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — create team validation and cancellation (Pass 17B)", () => {
  test("client validation blocks submission; visibility changes send no request; every dismissal restores trigger focus", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 710 });
    await authenticate(page);
    const fixture = await installFixture(page, { authenticated: true });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const trigger = page.getByTestId("teams-hub-create");
    const dialog = page.getByTestId("create-team-dialog");

    await trigger.click();
    await expect(dialog).toBeVisible();
    // Mobile bottom-sheet layout: rounded top corners only.
    const borderRadius = await dialog.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(borderRadius).not.toBe("0px");
    await expect(page.getByTestId("create-team-name")).toBeFocused();

    await page.getByTestId("create-team-submit").click();
    expect(fixture.createRequests.length).toBe(0);
    await expect(page.getByText("Enter a team name.")).toBeVisible();
    await expect(page.getByTestId("create-team-name")).toBeFocused();

    await page.getByTestId("create-team-name").fill("Valid Crew Name");
    await expect(page.getByText("15/100")).toBeVisible();

    await page.getByTestId("create-team-visibility-private").click();
    await page.getByTestId("create-team-visibility-public").click();
    expect(fixture.createRequests.length).toBe(0);

    await page.getByTestId("create-team-cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    // The mobile bottom-sheet dialog can cover most of a short viewport, so
    // click the backdrop at a point guaranteed to be outside the panel
    // (top-left corner) rather than its own bounding-box center.
    await page.mouse.click(4, 4);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    expect(fixture.createRequests.length).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — create team server error and retry (Pass 17B)", () => {
  test("JSON server error keeps values, then a corrected retry succeeds", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, {
      authenticated: true,
      createStatus: 400,
      createResponse: { error: "You already created a team with this name." },
    });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("teams-hub-create").click();
    const dialog = page.getByTestId("create-team-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("create-team-name").fill("Taken Name");
    await page.getByTestId("create-team-description").fill("Description text.");
    await page.getByTestId("create-team-visibility-private").click();

    const teamRequestsBefore = fixture.teamRequestCount();
    await page.getByTestId("create-team-submit").click();
    await expect(dialog).toBeVisible();

    const error = page.getByTestId("create-team-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveText("You already created a team with this name.");
    await expect(error).toBeFocused();

    await expect(page.getByTestId("create-team-name")).toHaveValue("Taken Name");
    await expect(page.getByTestId("create-team-description")).toHaveValue("Description text.");
    await expect(page.getByTestId("create-team-visibility-private")).toBeChecked();

    const submit = page.getByTestId("create-team-submit");
    await expect(submit).toHaveText("Create Team");
    await expect(submit).toBeEnabled();
    expect(fixture.teamRequestCount()).toBe(teamRequestsBefore);

    await page.getByTestId("create-team-name").fill("Available Name");

    // Reinstall a fixture that now succeeds, for the retry.
    const retryFixture = await installFixture(page, {
      authenticated: true,
      createResponse: { id: "available-name", name: "Available Name", description: "Description text.", isPublic: false, createdAt: "2026-02-02T00:00:00.000Z", members: [] },
      teamPayloadAfterCreate: TEAMS_FIXTURE,
    });
    await submit.click();

    await expect.poll(() => retryFixture.createRequests.length).toBe(1);
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => retryFixture.teamRequestCount()).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/teams$/);

    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Teams hub — create team plain-text error (Pass 17B)", () => {
  test("plain-text server error displays exactly and preserves entered values", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    const fixture = await installFixture(page, {
      authenticated: true,
      createStatus: 503,
      createPlainTextError: "Service temporarily unavailable",
    });
    await page.goto("/teams", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await page.getByTestId("teams-hub-create").click();
    await page.getByTestId("create-team-name").fill("Plain Text Error Team");
    const teamRequestsBefore = fixture.teamRequestCount();
    await page.getByTestId("create-team-submit").click();

    const error = page.getByTestId("create-team-error");
    await expect(error).toHaveText("Service temporarily unavailable");
    await expect(page.getByTestId("create-team-dialog")).toBeVisible();
    await expect(page.getByTestId("create-team-name")).toHaveValue("Plain Text Error Team");
    await expect(page.getByTestId("create-team-submit")).toBeEnabled();
    expect(fixture.teamRequestCount()).toBe(teamRequestsBefore);

    await expectNoHorizontalOverflow(page);
  });
});
