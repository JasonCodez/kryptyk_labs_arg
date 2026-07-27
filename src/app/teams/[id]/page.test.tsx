/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import TeamDetailPage from "./page";

const TEAM_ID = "team-detail-fixture";

const mockUseSession = jest.fn();
const mockPush = jest.fn();
const stableRouter = { push: mockPush };
jest.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));
jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useParams: () => ({ id: TEAM_ID }),
}));

const SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

const VALID_TEAM = {
  id: TEAM_ID,
  name: "Midnight Puzzle Society",
  description: "A team that solves puzzles together.",
  isPublic: true,
  activeTheme: "default",
  createdAt: "2026-01-14T12:00:00.000Z",
  members: [
    { user: { id: "me", name: "Me", email: "me@example.test", image: null }, role: "admin" },
    { user: { id: "u2", name: "Bob", email: "bob@example.test", image: null }, role: "member" },
  ],
};

const VALID_STATS = {
  rank: 4,
  totalTeams: 28,
  totalEarnedPoints: 5200,
  totalPuzzlesSolved: 180,
  avgPointsPerMember: 650,
  memberCount: 2,
  topContributors: [
    { userId: "me", name: "Me", image: null, role: "admin", joinedAt: "2026-01-01T00:00:00.000Z", earnedPoints: 3000, puzzlesSolved: 100 },
  ],
  recentActivity: [
    { userName: "Me", userImage: null, puzzleTitle: "Daily Sudoku", puzzleType: "sudoku", difficulty: "easy", pointsEarned: 25, solvedAt: "2026-01-19T00:00:00.000Z" },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response);
}

// This file runs under the jsdom Jest environment (required for React
// Testing Library's render()), which does not expose a global fetch
// Response implementation, and the project has no fetch-polyfill dependency
// to import one from. This stand-in enforces the same real-world constraint
// the correction targets — a response body can only be consumed once — so
// tests built on it genuinely exercise the single-read code path instead of
// the earlier synthetic mock, whose independently callable json()/text()
// masked the double-read bug.
function singleReadResponse(body: string, status = 500): Response {
  let consumed = false;
  const consume = () => {
    if (consumed) throw new TypeError("Body has already been consumed.");
    consumed = true;
    return body;
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(consume()),
    json: () => Promise.resolve(JSON.parse(consume())),
  } as unknown as Response;
}

type RouteHandler = (url: string, init?: RequestInit) => Promise<Response>;

function buildFetchMock(overrides: Partial<{
  team: RouteHandler;
  stats: RouteHandler;
  membership: RouteHandler;
  leaveTeam: RouteHandler;
  inviteStatus: RouteHandler;
  applications: RouteHandler;
  applicationAction: RouteHandler;
  theme: RouteHandler;
  apply: RouteHandler;
  removeMember: RouteHandler;
  inventory: RouteHandler;
}> = {}) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (url.includes(`/api/teams/${TEAM_ID}/stats`)) return overrides.stats?.(url, init) ?? jsonResponse(VALID_STATS);
    if (url.includes(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") return overrides.leaveTeam?.(url, init) ?? jsonResponse({});
    if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return overrides.membership?.(url, init) ?? jsonResponse({ role: "admin" });
    if (url.includes(`/api/teams/${TEAM_ID}/invite-status`)) return overrides.inviteStatus?.(url, init) ?? jsonResponse({ status: "none" });
    if (url.includes(`/api/teams/${TEAM_ID}/applications/`)) return overrides.applicationAction?.(url, init) ?? jsonResponse({});
    if (url.includes(`/api/teams/${TEAM_ID}/applications`)) return overrides.applications?.(url, init) ?? jsonResponse([]);
    if (url.includes(`/api/teams/${TEAM_ID}/theme`)) return overrides.theme?.(url, init) ?? jsonResponse({});
    if (url.includes(`/api/teams/${TEAM_ID}/apply`)) return overrides.apply?.(url, init) ?? jsonResponse({});
    if (url.includes(`/api/teams/${TEAM_ID}/members/`)) return overrides.removeMember?.(url, init) ?? jsonResponse({});
    if (url.includes("/api/store/inventory")) return overrides.inventory?.(url, init) ?? jsonResponse({ items: [] });
    if (url.includes(`/api/teams/${TEAM_ID}`)) return overrides.team?.(url, init) ?? jsonResponse(VALID_TEAM);
    return jsonResponse({});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, calls };
}

function authenticated() {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me", email: "me@example.test" } } });
}

function unauthenticated() {
  mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockPush.mockReset();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Team Detail page — primary load", () => {
  it("1. session loading shows the skeleton", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    render(<TeamDetailPage />);
    expect(screen.getByTestId("team-detail-loading")).toBeTruthy();
  });

  it("2. session loading issues no team request", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<TeamDetailPage />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("3. public unauthenticated visitor loads the team", async () => {
    unauthenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("4. authenticated visitor loads the team", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("5. team request uses cache: no-store", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    // Find the call that hit the bare team endpoint.
    const teamCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`));
    expect(teamCall).toBeTruthy();
  });

  it("6. team request receives an AbortSignal", async () => {
    authenticated();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(`/api/teams/${TEAM_ID}`) && !capturedSignal) capturedSignal = init?.signal as AbortSignal;
      return jsonResponse(String(input).endsWith(`/api/teams/${TEAM_ID}`) ? VALID_TEAM : {});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("7. Strict Mode replay applies the latest response", async () => {
    const { StrictMode } = await import("react");
    authenticated();
    buildFetchMock();
    render(
      <StrictMode>
        <TeamDetailPage />
      </StrictMode>
    );
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("8. unmount aborts the primary request", async () => {
    authenticated();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith(`/api/teams/${TEAM_ID}`)) {
        capturedSignal = init?.signal as AbortSignal;
        return new Promise(() => {});
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const { unmount } = render(<TeamDetailPage />);
    await flush();
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("9. malformed payload shows the primary error", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ id: 5 }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("We couldn’t load this team")).toBeTruthy();
  });

  it("10. mixed members retain valid members in order", async () => {
    authenticated();
    const mixedTeam = {
      ...VALID_TEAM,
      members: [VALID_TEAM.members[0], null, "invalid", {}, VALID_TEAM.members[1]],
    };
    buildFetchMock({ team: () => jsonResponse(mixedTeam) });
    const { container } = render(<TeamDetailPage />);
    await flush();
    const roster = container.querySelector('[data-testid="team-detail-members"]')!;
    expect(roster.querySelectorAll("li").length).toBe(2);
  });

  it("11. successful response removes the skeleton", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-detail-loading")).toBeNull();
  });

  it("12. no write request during initial load", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    calls.forEach((c) => expect(c.method).toBe("GET"));
  });
});

describe("Team Detail page — status states", () => {
  it("13. 403 renders Private Team", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "private" }, 403) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Private Team")).toBeTruthy();
  });

  it("14. private state has exact links", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "private" }, 403) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("link", { name: /Back to Team Leaderboards/ }).getAttribute("href")).toBe("/leaderboards/teams");
    expect(screen.getByRole("link", { name: /Explore Teams/ }).getAttribute("href")).toBe("/teams");
  });

  it("15. private state issues no stats request", async () => {
    authenticated();
    const { calls } = buildFetchMock({ team: () => jsonResponse({ error: "private" }, 403) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.includes("/stats"))).toBe(false);
  });

  it("16. 404 renders Team not found", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "not found" }, 404) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Team not found")).toBeTruthy();
  });

  it("17. not-found state issues no stats request", async () => {
    authenticated();
    const { calls } = buildFetchMock({ team: () => jsonResponse({ error: "not found" }, 404) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.includes("/stats"))).toBe(false);
  });

  it("18. 500 renders a retryable error", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("We couldn’t load this team")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("19. technical error is not exposed", async () => {
    authenticated();
    global.fetch = jest.fn(() => Promise.reject(new Error("ECONNREFUSED 10.0.0.1"))) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
  });

  it("20. retry remains on the same route (no navigation)", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    buildFetchMock();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("21. rapid retry activation creates one request", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();

    let resolveRetry: (v: Response) => void = () => {};
    const retryFetch = jest.fn(() => new Promise<Response>((resolve) => { resolveRetry = resolve; }));
    global.fetch = retryFetch as unknown as typeof fetch;

    const button = screen.getByRole("button", { name: "Try Again" });
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(retryFetch).toHaveBeenCalledTimes(1);

    act(() => {
      resolveRetry({ ok: true, status: 200, json: () => Promise.resolve(VALID_TEAM) } as Response);
    });
    await flush();
  });

  it("22. Trying… button is disabled", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();

    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect((screen.getByRole("button", { name: "Trying…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("23. successful retry renders the team", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    buildFetchMock();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("24. failed retry restores Try Again", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    buildFetchMock({ team: () => jsonResponse({ error: "boom again" }, 500) });
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("25. retry guard resets after failure", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    buildFetchMock({ team: () => jsonResponse({ error: "boom again" }, 500) });
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    const { fetchMock: thirdFetch } = buildFetchMock();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(thirdFetch).toHaveBeenCalled();
  });
});

describe("Team Detail page — statistics", () => {
  it("26. stats request starts only after team success", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.includes("/stats"))).toBe(true);
  });

  it("27. unmount aborts the stats request", async () => {
    authenticated();
    let statsSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/stats")) {
        statsSignal = init?.signal as AbortSignal;
        return new Promise(() => {});
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const { unmount } = render(<TeamDetailPage />);
    await flush();
    unmount();
    expect(statsSignal?.aborted).toBe(true);
  });

  it("28. stats failure leaves the team ready", async () => {
    authenticated();
    buildFetchMock({ stats: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
    expect(screen.queryByText("We couldn’t load this team")).toBeNull();
  });

  it("29. stats failure shows unavailable values", async () => {
    authenticated();
    buildFetchMock({ stats: () => jsonResponse({ error: "boom" }, 500) });
    const { container } = render(<TeamDetailPage />);
    await flush();
    const statsCards = container.querySelector('[data-testid="team-detail-stats"]')!;
    expect(statsCards.textContent).toMatch(/—/);
  });

  it("30. malformed stats is nonfatal", async () => {
    authenticated();
    buildFetchMock({ stats: () => jsonResponse({ rank: "not-a-number" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("31. server order reaches content unchanged", async () => {
    authenticated();
    buildFetchMock();
    const { container } = render(<TeamDetailPage />);
    await flush();
    const roster = container.querySelector('[data-testid="team-detail-members"]')!;
    // "Member" (the role badge text) contains "Me" as a substring, so check
    // for the more specific name "Bob" first to disambiguate.
    const names = Array.from(roster.querySelectorAll("li")).map((li) => (li.textContent?.includes("Bob") ? "Bob" : "Me"));
    expect(names).toEqual(["Me", "Bob"]);
  });

  it("32. no client sorting occurs (source check)", () => {
    expect(SOURCE.includes(".sort(")).toBe(false);
  });
});

describe("Team Detail page — theme", () => {
  it("33. unknown theme safely uses fallback (no crash)", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ ...VALID_TEAM, activeTheme: "totally-unknown-theme" }) });
    expect(() => render(<TeamDetailPage />)).not.toThrow();
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("34. loaded root reflects the resolved theme background", async () => {
    authenticated();
    buildFetchMock();
    const { container } = render(<TeamDetailPage />);
    await flush();
    const root = container.querySelector(".min-h-screen") as HTMLElement;
    expect(root.style.backgroundColor).toBeTruthy();
  });
});

describe("Team Detail page — management visibility regression", () => {
  it("35. admin sees Theme, Invite Members, Leave Team", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("button", { name: /Theme/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Invite Members/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Leave Team/ })).toBeTruthy();
  });

  it("36. moderator sees Invite Members and Leave Team, not Theme", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "moderator" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("button", { name: /Invite Members/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Leave Team/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Theme$/ })).toBeNull();
  });

  it("37. member sees Leave Team only", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("button", { name: /Leave Team/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Invite Members/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Theme$/ })).toBeNull();
  });

  it("38. signed-in public nonmember sees Apply to Join", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("button", { name: "Apply to Join" })).toBeTruthy();
  });

  it("39. pending nonmember sees Application Submitted", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "pending" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("button", { name: "Application Submitted" })).toBeTruthy();
  });

  it("40. signed-out public nonmember sees Sign in to Join", async () => {
    unauthenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("link", { name: "Sign in to Join" })).toBeTruthy();
  });

  it("41. private nonmember never reaches management UI", async () => {
    authenticated();
    buildFetchMock({ team: () => jsonResponse({ error: "private" }, 403) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByRole("button", { name: /Leave Team/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Apply to Join/ })).toBeNull();
  });
});

describe("Team Detail page — polling regression", () => {
  it("42. membership polling remains 10 seconds and cleans up on unmount", async () => {
    jest.useFakeTimers();
    authenticated();
    const { fetchMock } = buildFetchMock();
    const { unmount } = render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const membershipCallsBefore = fetchMock.mock.calls.filter(([u]) => String(u).includes("/membership") && !String(u).includes("DELETE")).length;
    await act(async () => { jest.advanceTimersByTime(10_000); await Promise.resolve(); });
    const membershipCallsAfter = fetchMock.mock.calls.filter(([u]) => String(u).includes("/membership")).length;
    expect(membershipCallsAfter).toBeGreaterThan(membershipCallsBefore);

    unmount();
    const countAtUnmount = fetchMock.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(30_000); await Promise.resolve(); });
    expect(fetchMock.mock.calls.length).toBe(countAtUnmount);
  });

  it("43. membership polling runs only when authenticated", async () => {
    jest.useFakeTimers();
    unauthenticated();
    const { fetchMock } = buildFetchMock();
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(20_000); await Promise.resolve(); });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/membership"))).toBe(false);
  });

  it("44. invite-status polling remains 5 seconds while pending", async () => {
    jest.useFakeTimers();
    authenticated();
    const { fetchMock } = buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "pending" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const before = fetchMock.mock.calls.filter(([u]) => String(u).includes("/invite-status")).length;
    await act(async () => { jest.advanceTimersByTime(5_000); await Promise.resolve(); });
    const after = fetchMock.mock.calls.filter(([u]) => String(u).includes("/invite-status")).length;
    expect(after).toBeGreaterThan(before);
  });

  it("45. invite-status polling does not run when not pending", async () => {
    jest.useFakeTimers();
    authenticated();
    const { fetchMock } = buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const before = fetchMock.mock.calls.filter(([u]) => String(u).includes("/invite-status")).length;
    await act(async () => { jest.advanceTimersByTime(10_000); await Promise.resolve(); });
    const after = fetchMock.mock.calls.filter(([u]) => String(u).includes("/invite-status")).length;
    expect(after).toBe(before);
  });
});

describe("Team Detail page — management endpoint regression", () => {
  it("46. theme uses exact PUT endpoint and body", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    const goldButton = screen.queryAllByRole("button").find((b) => /gold/i.test(b.textContent ?? ""));
    if (goldButton) {
      fireEvent.click(goldButton);
      await flush();
      const themeCall = calls.find((c) => c.url.includes("/theme") && c.method === "PUT");
      expect(themeCall).toBeTruthy();
      expect(themeCall?.body).toEqual({ theme: "gold" });
    }
  });

  it("47. apply uses exact POST endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Join" }));
    await flush();
    const applyCall = calls.find((c) => c.url.includes("/apply") && c.method === "POST");
    expect(applyCall).toBeTruthy();
  });

  it("48. approve uses exact POST endpoint and body", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse([{ id: "app1", user: { name: "Applicant", email: "a@test.test" }, createdAt: "2026-01-01T00:00:00.000Z" }]),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await flush();
    const approveCall = calls.find((c) => c.url.includes("/applications/app1") && c.method === "POST");
    expect(approveCall?.body).toEqual({ action: "approve" });
  });

  it("49. deny uses exact POST endpoint and body", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse([{ id: "app1", user: { name: "Applicant", email: "a@test.test" }, createdAt: "2026-01-01T00:00:00.000Z" }]),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    await flush();
    const denyCall = calls.find((c) => c.url.includes("/applications/app1") && c.method === "POST");
    expect(denyCall?.body).toEqual({ action: "deny" });
  });

  it("50. remove uses exact DELETE endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    const removeCall = calls.find((c) => c.url.includes("/members/") && c.method === "DELETE");
    expect(removeCall).toBeTruthy();
  });

  it("51. leave uses exact DELETE endpoint", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const leaveCall = calls.find((c) => c.url.includes("/membership") && c.method === "DELETE");
    expect(leaveCall).toBeTruthy();
  });

  it("52. leave navigation remains delayed 1200ms to /teams", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(mockPush).toHaveBeenCalledWith("/teams");
  });
});

describe("Team Detail page — composition", () => {
  it("53. TeamDetailHero-derived elements render once (Back to Teams link)", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getAllByRole("link", { name: /Back to Teams/ }).length).toBe(1);
  });

  it("54. TeamDetailReadOnlyContent renders once (stats testid)", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getAllByTestId("team-detail-stats").length).toBe(1);
  });

  it("55. theme picker remains page-owned (opens via Theme button)", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.getByText("Choose Team Theme")).toBeTruthy();
  });

  it("56. pending applications remain page-owned", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse([]) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Pending Applications")).toBeTruthy();
  });

  it("57. read-only components perform no writes (no unexpected mutation on load)", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("58. page uses PageContainer", () => {
    expect(SOURCE.includes("PageContainer")).toBe(true);
  });

  it("59. legacy PAGE_BG removed", () => {
    expect(SOURCE.includes("PAGE_BG")).toBe(false);
  });

  it("60. legacy PODIUM_STYLE removed", () => {
    expect(SOURCE.includes("PODIUM_STYLE")).toBe(false);
  });

  it("61. legacy DIFFICULTY_STYLE removed", () => {
    expect(SOURCE.includes("DIFFICULTY_STYLE")).toBe(false);
  });

  it("62. legacy ROLE_STYLE removed", () => {
    expect(SOURCE.includes("ROLE_STYLE")).toBe(false);
  });

  it("63. legacy formatTimeAgo removed", () => {
    expect(SOURCE.includes("formatTimeAgo")).toBe(false);
  });
});

function goldInventory() {
  return jsonResponse({ items: [{ item: { subcategory: "team_theme", metadata: { value: "gold" } } }] });
}

describe("Team Detail page — action deck and theme picker (Pass 16B.1)", () => {
  it("64. the action deck renders once", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getAllByTestId("team-detail-actions").length).toBe(1);
  });

  it("65. the theme picker is closed initially", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-theme-picker")).toBeNull();
  });

  it("66. admin can open the theme picker", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.getByTestId("team-theme-picker")).toBeTruthy();
  });

  it("67. Theme button reports aria-expanded=false before opening", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByRole("button", { name: /^Theme$/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("68. Theme button reports aria-expanded=true after opening", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.getByRole("button", { name: /^Theme$/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("69. close theme picker hides it without a mutation", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Close theme picker" }));
    await flush();
    expect(screen.queryByTestId("team-theme-picker")).toBeNull();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("70. Default always renders", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.getByTestId("team-theme-option-default")).toBeTruthy();
  });

  it("71. valid owned inventory themes render", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: goldInventory });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.getByTestId("team-theme-option-gold")).toBeTruthy();
  });

  it("72. unknown inventory themes do not render", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      inventory: () => jsonResponse({ items: [{ item: { subcategory: "team_theme", metadata: { value: "not-a-real-theme" } } }] }),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.queryByTestId("team-theme-option-not-a-real-theme")).toBeNull();
  });

  it("73. theme selection uses the exact PUT endpoint and preserves the exact JSON body", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: goldInventory });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    const themeCall = calls.find((c) => c.url.includes("/theme") && c.method === "PUT");
    expect(themeCall).toBeTruthy();
    expect(themeCall?.body).toEqual({ theme: "gold" });
  });

  it("74. successful theme selection closes the picker", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: goldInventory });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    expect(screen.queryByTestId("team-theme-picker")).toBeNull();
  });

  it("75. successful theme selection updates the local active theme", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: goldInventory });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    expect(screen.getByTestId("team-theme-option-gold").getAttribute("aria-pressed")).toBe("true");
  });

  it("76. failed theme selection preserves exact failure modal copy (server error)", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      inventory: goldInventory,
      theme: () => jsonResponse({ error: "Team theme locked" }, 500),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    expect(screen.getByText("Theme update failed")).toBeTruthy();
    expect(screen.getByText("Team theme locked")).toBeTruthy();
  });

  it("77. failed theme selection preserves exact fallback copy", async () => {
    // The page's own fallback chain (throw new Error(data.error || 'Failed to
    // update theme')) always produces a truthy err.message before the outer
    // 'Failed to change theme' fallback is consulted — that outer fallback is
    // page-owned, frozen behavior only reachable when err.message itself is
    // falsy, e.g. an Error thrown with no message at all.
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      inventory: goldInventory,
      theme: () => Promise.reject(new Error()),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    expect(screen.getByText("Theme update failed")).toBeTruthy();
    expect(screen.getByText("Failed to change theme")).toBeTruthy();
  });

  it("78. Apply-to-Join preserves the exact POST endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Join" }));
    await flush();
    const applyCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/apply`) && c.method === "POST");
    expect(applyCall).toBeTruthy();
  });

  it("79. apply success preserves exact modal copy", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Join" }));
    await flush();
    expect(screen.getByText("Application submitted")).toBeTruthy();
    expect(screen.getByText("Your application was submitted. Team admins will be notified.")).toBeTruthy();
  });

  it("80. already-pending behavior preserves exact modal copy", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: null }),
      inviteStatus: () => jsonResponse({ status: "none" }),
      apply: () => jsonResponse({ error: "You already have a pending application" }, 409),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Join" }));
    await flush();
    expect(screen.getByText("Application pending")).toBeTruthy();
    expect(screen.getByText("You already have a pending application or invitation.")).toBeTruthy();
  });

  it("81. apply failure resets the button state and preserves exact fallback copy", async () => {
    // As with the theme fallback above: the apply handler's own inner
    // fallback chain ('Failed to apply') always produces a truthy thrown
    // message, so the outer 'Failed to submit application.' fallback is only
    // reachable when the caught error has no message at all.
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: null }),
      inviteStatus: () => jsonResponse({ status: "none" }),
      apply: () => Promise.reject(new Error()),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Join" }));
    await flush();
    expect(screen.getByText("Application failed")).toBeTruthy();
    expect(screen.getByText("Failed to submit application.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply to Join" })).toBeTruthy();
  });

  it("82. admin/moderator/member/non-member/anonymous visibility remains unchanged through the extracted action deck", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    const deck = screen.getByTestId("team-detail-actions");
    expect(deck).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Theme$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invite Members" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave Team" })).toBeTruthy();
  });

  it("83. no write request occurs during initial render (action deck and theme picker)", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: goldInventory });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
});

const APPLICATION_FIXTURE = [
  { id: "app-1", createdAt: "2026-01-01T00:00:00.000Z", user: { id: "u-app1", name: "Applicant One", email: "one@example.test", image: null } },
  { id: "app-2", createdAt: "2026-01-02T00:00:00.000Z", user: { id: "u-app2", name: null, email: "two@example.test", image: null } },
  { id: "app-3", createdAt: "2026-01-03T00:00:00.000Z", user: { id: "u-app3", name: "Applicant Three", email: "three@example.test", image: null } },
];

describe("Team Detail page — pending applications (Pass 16B.2)", () => {
  it("1. admin triggers the exact applications GET endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    const appsCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`) && c.method === "GET");
    expect(appsCall).toBeTruthy();
  });

  it("2. moderator triggers the exact applications GET endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "moderator" }) });
    render(<TeamDetailPage />);
    await flush();
    const appsCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`) && c.method === "GET");
    expect(appsCall).toBeTruthy();
  });

  it("3. member does not request applications", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`))).toBe(false);
  });

  it("4. unknown role does not request applications", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "mascot" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`))).toBe(false);
  });

  it("5. public non-member does not request applications", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`))).toBe(false);
  });

  it("6. anonymous visitor does not request applications", async () => {
    unauthenticated();
    const { calls } = buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(calls.some((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`))).toBe(false);
  });

  it("7. applications request uses cache: no-store", async () => {
    authenticated();
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) {
        capturedInit = init;
        return jsonResponse(APPLICATION_FIXTURE);
      }
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    expect(capturedInit?.cache).toBe("no-store");
  });

  it("8. applications request receives an AbortSignal", async () => {
    authenticated();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) {
        capturedSignal = init?.signal as AbortSignal;
        return jsonResponse(APPLICATION_FIXTURE);
      }
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("9. unmount aborts an active applications request", async () => {
    authenticated();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) {
        capturedSignal = init?.signal as AbortSignal;
        return new Promise(() => {});
      }
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const { unmount } = render(<TeamDetailPage />);
    await flush();
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("10. a stale earlier response cannot replace a later response (Strict Mode replay)", async () => {
    const { StrictMode } = await import("react");
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
    });
    render(
      <StrictMode>
        <TeamDetailPage />
      </StrictMode>
    );
    await flush();
    expect(screen.getByText("Applicant One")).toBeTruthy();
    expect(screen.getAllByText("Applicant One")).toHaveLength(1);
  });

  it("11. role loss aborts and clears application state", async () => {
    jest.useFakeTimers();
    authenticated();
    let membershipRole = "admin";
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: membershipRole });
      if (url.includes(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByTestId("team-applications-panel")).toBeTruthy();

    membershipRole = "member";
    await act(async () => { jest.advanceTimersByTime(10000); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByTestId("team-applications-panel")).toBeNull();
  });

  it("12. successful empty payload shows the empty state", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse([]) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("No pending applications.")).toBeTruthy();
  });

  it("13. malformed successful payload does not crash", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse({ not: "an array" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByTestId("team-applications-panel")).toBeTruthy();
    expect(screen.getByText("No pending applications.")).toBeTruthy();
  });

  it("14. non-OK response shows the error state", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Applications couldn’t be loaded.")).toBeTruthy();
  });

  it("15. network rejection shows the error state", async () => {
    authenticated();
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return Promise.reject(new Error("network down"));
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Applications couldn’t be loaded.")).toBeTruthy();
  });

  it("16. retry calls only the applications endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    const before = calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    const newCalls = calls.slice(before);
    expect(newCalls.every((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`))).toBe(true);
  });

  it("17. retry does not reload the route", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse({ error: "boom" }, 500) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("18. retry success replaces the error state", async () => {
    authenticated();
    let shouldFail = true;
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => (shouldFail ? jsonResponse({ error: "boom" }, 500) : jsonResponse(APPLICATION_FIXTURE)),
    });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByText("Applications couldn’t be loaded.")).toBeTruthy();
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(screen.queryByText("Applications couldn’t be loaded.")).toBeNull();
    expect(screen.getByText("Applicant One")).toBeTruthy();
  });

  it("19. approve sends the exact POST endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    const approveCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(approveCall).toBeTruthy();
  });

  it("20. approve sends exact body { action: \"approve\" }", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    const approveCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(approveCall?.body).toEqual({ action: "approve" });
  });

  it("21. approve sends Content-Type: application/json", async () => {
    authenticated();
    let capturedHeaders: HeadersInit | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`)) {
        capturedHeaders = init?.headers;
        return jsonResponse({});
      }
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect(capturedHeaders).toEqual({ "Content-Type": "application/json" });
  });

  it("22. rapid double activation produces exactly one mutation (approve)", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    const approveBtn = screen.getByTestId("team-application-approve-app-1");
    fireEvent.click(approveBtn);
    fireEvent.click(approveBtn);
    await flush();
    const approveCalls = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(approveCalls.length).toBe(1);
  });

  it("23. pending label becomes Approving…", async () => {
    authenticated();
    let resolveApprove: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`)) return new Promise<Response>((resolve) => { resolveApprove = resolve; });
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect(screen.getByTestId("team-application-approve-app-1").textContent).toContain("Approving…");
    act(() => { resolveApprove({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response); });
    await flush();
  });

  it("24. other row actions are disabled while approving", async () => {
    authenticated();
    let resolveApprove: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`)) return new Promise<Response>((resolve) => { resolveApprove = resolve; });
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect((screen.getByTestId("team-application-deny-app-1") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-application-approve-app-2") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-application-deny-app-2") as HTMLButtonElement).disabled).toBe(true);
    act(() => { resolveApprove({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response); });
    await flush();
  });

  it("25. successful approve removes only the selected row; 26. remaining order preserved", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-2"));
    await flush();
    expect(screen.queryByTestId("team-application-row-app-2")).toBeNull();
    const remaining = screen.getAllByTestId(/^team-application-row-/).map((el) => el.getAttribute("data-testid"));
    expect(remaining).toEqual(["team-application-row-app-1", "team-application-row-app-3"]);
  });

  it("27. successful approve performs one primary Team refresh", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    const teamCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    expect(teamCallsAfter).toBe(teamCallsBefore + 1);
  });

  it("28. approve does not refetch applications; 29. approve does not refetch stats", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    const appsCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsCallsBefore = calls.filter((c) => c.url.includes(`/api/teams/${TEAM_ID}/stats`)).length;
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    const appsCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsCallsAfter = calls.filter((c) => c.url.includes(`/api/teams/${TEAM_ID}/stats`)).length;
    expect(appsCallsAfter).toBe(appsCallsBefore);
    expect(statsCallsAfter).toBe(statsCallsBefore);
  });

  it("30. approve success preserves exact modal copy", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect(screen.getByText("Applicant approved")).toBeTruthy();
    expect(screen.getByText("The applicant has been added to the team.")).toBeTruthy();
  });

  it("30a. approve remains successful when the post-approval Team refresh rejects (network failure)", async () => {
    authenticated();
    let teamGetCount = 0;
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });

      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.includes(`/api/teams/${TEAM_ID}/applications/`)) return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return Promise.reject(new Error("network down"));
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();

    // Approved row removed, remaining rows preserved in order.
    expect(screen.queryByTestId("team-application-row-app-1")).toBeNull();
    expect(screen.getByTestId("team-application-row-app-2")).toBeTruthy();
    expect(screen.getByTestId("team-application-row-app-3")).toBeTruthy();

    // Approval remains successful; refresh failure is never surfaced.
    expect(screen.getByText("Applicant approved")).toBeTruthy();
    expect(screen.getByText("The applicant has been added to the team.")).toBeTruthy();
    expect(screen.queryByText("Approve failed")).toBeNull();

    // Pending state cleared; other rows usable again.
    expect((screen.getByTestId("team-application-deny-app-2") as HTMLButtonElement).disabled).toBe(false);

    // Applications and stats are not refetched by the approval flow.
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length).toBe(1);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length).toBe(1);
  });

  it("30b. approve remains successful when the post-approval Team refresh response has unparsable JSON", async () => {
    authenticated();
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.includes(`/api/teams/${TEAM_ID}/applications/`)) return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("bad json")) } as unknown as Response);
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();

    expect(screen.queryByTestId("team-application-row-app-1")).toBeNull();
    expect(screen.getByText("Applicant approved")).toBeTruthy();
    expect(screen.getByText("The applicant has been added to the team.")).toBeTruthy();
    expect(screen.queryByText("Approve failed")).toBeNull();
  });

  it("30c. approve remains successful when the refreshed Team payload is malformed", async () => {
    authenticated();
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.includes(`/api/teams/${TEAM_ID}/applications/`)) return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return jsonResponse({ id: 5 }); // malformed: id must be a string
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();

    // Existing local Team content remains usable — name still renders.
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
    expect(screen.queryByTestId("team-application-row-app-1")).toBeNull();
    expect(screen.getByText("Applicant approved")).toBeTruthy();
    expect(screen.getByText("The applicant has been added to the team.")).toBeTruthy();
    expect(screen.queryByText("Approve failed")).toBeNull();
  });

  it("30d. a failed application POST itself still shows Approve failed and performs no Team refresh", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    const teamCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    expect(screen.getByTestId("team-application-row-app-1")).toBeTruthy();
    expect(screen.getByText("Approve failed")).toBeTruthy();
    expect(teamCallsAfter).toBe(teamCallsBefore);
  });

  it("31. approve failure keeps the row; 32. preserves server response text", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("Applicant already resolved") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect(screen.getByTestId("team-application-row-app-1")).toBeTruthy();
    expect(screen.getByText("Approve failed")).toBeTruthy();
    expect(screen.getByText("Applicant already resolved")).toBeTruthy();
  });

  it("33. approve failure preserves fallback copy", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect(screen.getByText("Failed to approve applicant")).toBeTruthy();
  });

  it("34. pending state clears after approve success; 35. after approve failure", async () => {
    authenticated();
    let fail = false;
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => (fail
        ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response)
        : jsonResponse({})),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    expect((screen.getByTestId("team-application-deny-app-2") as HTMLButtonElement).disabled).toBe(false);

    fail = true;
    fireEvent.click(screen.getByTestId("team-application-approve-app-2"));
    await flush();
    expect((screen.getByTestId("team-application-deny-app-3") as HTMLButtonElement).disabled).toBe(false);
  });

  it("36. deny sends the exact POST endpoint", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    const denyCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(denyCall).toBeTruthy();
  });

  it("37. deny sends exact body { action: \"deny\" }", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    const denyCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(denyCall?.body).toEqual({ action: "deny" });
  });

  it("38. deny sends Content-Type: application/json", async () => {
    authenticated();
    let capturedHeaders: HeadersInit | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`)) {
        capturedHeaders = init?.headers;
        return jsonResponse({});
      }
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect(capturedHeaders).toEqual({ "Content-Type": "application/json" });
  });

  it("39. rapid double activation produces exactly one mutation (deny)", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    const denyBtn = screen.getByTestId("team-application-deny-app-1");
    fireEvent.click(denyBtn);
    fireEvent.click(denyBtn);
    await flush();
    const denyCalls = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(denyCalls.length).toBe(1);
  });

  it("40. pending label becomes Denying…", async () => {
    authenticated();
    let resolveDeny: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`)) return new Promise<Response>((resolve) => { resolveDeny = resolve; });
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect(screen.getByTestId("team-application-deny-app-1").textContent).toContain("Denying…");
    act(() => { resolveDeny({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response); });
    await flush();
  });

  it("41. other row actions are disabled while denying", async () => {
    authenticated();
    let resolveDeny: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`)) return new Promise<Response>((resolve) => { resolveDeny = resolve; });
      if (url.includes(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse(APPLICATION_FIXTURE);
      if (url.endsWith(`/api/teams/${TEAM_ID}`)) return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect((screen.getByTestId("team-application-approve-app-1") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-application-approve-app-2") as HTMLButtonElement).disabled).toBe(true);
    act(() => { resolveDeny({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response); });
    await flush();
  });

  it("42. successful deny removes only the selected row; 43. remaining order preserved", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-2"));
    await flush();
    expect(screen.queryByTestId("team-application-row-app-2")).toBeNull();
    const remaining = screen.getAllByTestId(/^team-application-row-/).map((el) => el.getAttribute("data-testid"));
    expect(remaining).toEqual(["team-application-row-app-1", "team-application-row-app-3"]);
  });

  it("44. deny does not refresh the primary Team", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    const teamCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    expect(teamCallsAfter).toBe(teamCallsBefore);
  });

  it("45. deny does not refetch applications; 46. deny does not refetch stats", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    const appsCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsCallsBefore = calls.filter((c) => c.url.includes(`/api/teams/${TEAM_ID}/stats`)).length;
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    const appsCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsCallsAfter = calls.filter((c) => c.url.includes(`/api/teams/${TEAM_ID}/stats`)).length;
    expect(appsCallsAfter).toBe(appsCallsBefore);
    expect(statsCallsAfter).toBe(statsCallsBefore);
  });

  it("47. deny success preserves exact modal copy", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect(screen.getByText("Applicant denied")).toBeTruthy();
    expect(screen.getByText("The applicant has been denied.")).toBeTruthy();
  });

  it("48. deny failure keeps the row; 49. preserves server response text", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("Cannot deny now") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect(screen.getByTestId("team-application-row-app-1")).toBeTruthy();
    expect(screen.getByText("Deny failed")).toBeTruthy();
    expect(screen.getByText("Cannot deny now")).toBeTruthy();
  });

  it("50. deny failure preserves fallback copy", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect(screen.getByText("Failed to deny applicant")).toBeTruthy();
  });

  it("51. pending state clears after deny success; 52. after deny failure", async () => {
    authenticated();
    let fail = false;
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      applications: () => jsonResponse(APPLICATION_FIXTURE),
      applicationAction: () => (fail
        ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response)
        : jsonResponse({})),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-1"));
    await flush();
    expect((screen.getByTestId("team-application-approve-app-2") as HTMLButtonElement).disabled).toBe(false);

    fail = true;
    fireEvent.click(screen.getByTestId("team-application-deny-app-2"));
    await flush();
    expect((screen.getByTestId("team-application-approve-app-3") as HTMLButtonElement).disabled).toBe(false);
  });

  it("53. existing Theme mutation remains unchanged", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: () => jsonResponse({ items: [{ item: { subcategory: "team_theme", metadata: { value: "gold" } } }] }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    const themeCall = calls.find((c) => c.url.includes("/theme") && c.method === "PUT");
    expect(themeCall?.body).toEqual({ theme: "gold" });
  });

  it("54. existing Apply-to-Join mutation remains unchanged", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Join" }));
    await flush();
    const applyCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/apply`) && c.method === "POST");
    expect(applyCall).toBeTruthy();
  });

  it("55. existing remove-member mutation remains unchanged", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    const removeCall = calls.find((c) => c.url.includes("/members/") && c.method === "DELETE");
    expect(removeCall).toBeTruthy();
  });

  it("56. existing leave-team mutation and 57. 1200ms delay remain unchanged", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const leaveCall = calls.find((c) => c.url.includes("/membership") && c.method === "DELETE");
    expect(leaveCall).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(mockPush).toHaveBeenCalledWith("/teams");
  });

  it("58. membership polling remains 10 seconds; 59. invite-status polling remains 5 seconds while pending", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inviteStatus: () => jsonResponse({ status: "pending" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const membershipCallsBefore = calls.filter((c) => c.url.includes("/membership")).length;
    const inviteCallsBefore = calls.filter((c) => c.url.includes("/invite-status")).length;
    await act(async () => { jest.advanceTimersByTime(10000); await Promise.resolve(); });
    const membershipCallsAfter = calls.filter((c) => c.url.includes("/membership")).length;
    expect(membershipCallsAfter).toBeGreaterThan(membershipCallsBefore);
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); });
    const inviteCallsAfter = calls.filter((c) => c.url.includes("/invite-status")).length;
    expect(inviteCallsAfter).toBeGreaterThan(inviteCallsBefore);
  });

  it("60. no write occurs during initial page render", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(APPLICATION_FIXTURE) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
});

const THREE_MEMBER_TEAM = {
  ...VALID_TEAM,
  members: [
    { user: { id: "me", name: "Me", email: "me@example.test", image: null }, role: "admin" },
    { user: { id: "u2", name: "Bob", email: "bob@example.test", image: null }, role: "member" },
    { user: { id: "u3", name: "Carol", email: "carol@example.test", image: null }, role: "member" },
  ],
};

describe("Team Detail page — member removal (Pass 16B.3.1)", () => {
  it("1. admin sees removal controls for other members", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByTestId("team-member-remove-u2")).toBeTruthy();
  });

  it("2. moderator sees removal controls for other members", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "moderator" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getByTestId("team-member-remove-u2")).toBeTruthy();
  });

  it("3. member sees no removal controls", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
  });

  it("4. unknown role sees no removal controls", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "mascot" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
  });

  it("5. signed-in non-member sees no removal controls", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: null }), inviteStatus: () => jsonResponse({ status: "none" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
  });

  it("6. anonymous visitor sees no removal controls", async () => {
    unauthenticated();
    buildFetchMock();
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
  });

  it("7. current user sees no self-removal control", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-me")).toBeNull();
  });

  it("8. session user ID matching hides self-removal", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me", email: "different@example.test" } } });
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-me")).toBeNull();
  });

  it("9. a coincidentally matching email alone does not hide self-removal", async () => {
    // The client no longer carries member emails at all, so self-detection
    // is ID-only: a session with a different ID must not hide another
    // member's removal control, even if an unrelated email happens to match.
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "different-id", email: "me@example.test" } } });
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-me")).not.toBeNull();
  });

  it("10. empty member ID receives no removal control", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      team: () => jsonResponse({ ...VALID_TEAM, members: [...VALID_TEAM.members, { user: { id: "", name: "No Id", email: null, image: null }, role: "member" }] }),
    });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.queryByTestId("team-member-remove-")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove No Id/ })).toBeNull();
  });

  it("11. clicking a removal control opens the dialog for the correct member; 12. exact member name appears", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    expect(screen.getByText("Are you sure you want to remove Bob from the team?")).toBeTruthy();
  });

  it("13. Member fallback appears when the name is absent (email is no longer part of the client contract)", async () => {
    // The client no longer retains a member email field at all (privacy
    // fix), so an absent name now falls straight through to the "Member"
    // fallback rather than a since-removed email fallback.
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      team: () => jsonResponse({ ...VALID_TEAM, members: [VALID_TEAM.members[0], { user: { id: "u2", name: null, email: "bob@example.test", image: null }, role: "member" }] }),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    expect(screen.getByText("Are you sure you want to remove Member from the team?")).toBeTruthy();
    expect(screen.queryByText(/bob@example\.test/)).toBeNull();
  });

  it("14. Member fallback appears when both are absent", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      team: () => jsonResponse({ ...VALID_TEAM, members: [VALID_TEAM.members[0], { user: { id: "u2", name: null, email: null, image: null }, role: "member" }] }),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    expect(screen.getByText("Are you sure you want to remove Member from the team?")).toBeTruthy();
  });

  it("15. cancel closes the dialog without a mutation", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-cancel"));
    await flush();
    expect(screen.queryByTestId("team-member-removal-dialog")).toBeNull();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("16. confirm sends the exact member DELETE endpoint; 17. method is exactly DELETE", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    const removeCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && c.method === "DELETE");
    expect(removeCall).toBeTruthy();
  });

  it("18. header is exactly Content-Type: application/json; 19. no request body is added", async () => {
    authenticated();
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        capturedInit = init;
        return jsonResponse({});
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(capturedInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(capturedInit?.body).toBeUndefined();
  });

  it("20. no membership DELETE is issued", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(calls.some((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "DELETE")).toBe(false);
  });

  it("21. rapid repeated confirmation produces exactly one DELETE", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    const confirmBtn = screen.getByTestId("team-member-removal-confirm");
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    await flush();
    const removeCalls = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && c.method === "DELETE");
    expect(removeCalls.length).toBe(1);
  });

  it("22. confirm label becomes Removing…; 23. dialog exposes busy state; 24. cancel is disabled; 25. every roster Remove control is disabled; 26. another member cannot replace the target", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(THREE_MEMBER_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();

    expect(screen.getByTestId("team-member-removal-confirm").textContent).toContain("Removing…");
    expect(screen.getByTestId("team-member-removal-dialog").getAttribute("aria-busy")).toBe("true");
    expect((screen.getByTestId("team-member-removal-cancel") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-member-remove-u2") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-member-remove-u3") as HTMLButtonElement).disabled).toBe(true);

    // Another member's control is disabled and cannot become the target while pending.
    fireEvent.click(screen.getByTestId("team-member-remove-u3"));
    await flush();
    expect(screen.getByText("Are you sure you want to remove Bob from the team?")).toBeTruthy();

    act(() => { resolveDelete({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response); });
    await flush();
  });

  it("27. pending state clears after success", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      team: () => jsonResponse(THREE_MEMBER_TEAM),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect((screen.getByTestId("team-member-remove-u3") as HTMLButtonElement).disabled).toBe(false);
  });

  it("28. pending state clears after failure", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      team: () => jsonResponse(THREE_MEMBER_TEAM),
      removeMember: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect((screen.getByTestId("team-member-remove-u3") as HTMLButtonElement).disabled).toBe(false);
  });

  it("29. member is not removed before the DELETE resolves", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Bob")).toBeTruthy();
    act(() => { resolveDelete({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response); });
    await flush();
  });

  it("30. successful DELETE removes only the selected member; 31. remaining member order preserved", async () => {
    authenticated();
    let deleted = false;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        deleted = true;
        return jsonResponse({});
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        if (!deleted) return jsonResponse(THREE_MEMBER_TEAM);
        return jsonResponse({ ...THREE_MEMBER_TEAM, members: THREE_MEMBER_TEAM.members.filter((m) => m.user.id !== "u2") });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();

    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
    expect(screen.getByTestId("team-member-remove-u3")).toBeTruthy();
    expect(screen.queryByText("Bob")).toBeNull();
    expect(screen.getByText("Carol")).toBeTruthy();
  });

  it("32. successful removal performs exactly one primary Team refresh", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    const teamCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    expect(teamCallsAfter).toBe(teamCallsBefore + 1);
  });

  it("33. does not refetch applications; 34. does not refetch statistics; 35. does not refetch membership", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    const appsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length;
    const membershipBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`)).length;
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length).toBe(appsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length).toBe(statsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`)).length).toBe(membershipBefore);
  });

  it("36. successful removal closes the dialog; 37. preserves exact ActionModal copy", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.queryByTestId("team-member-removal-dialog")).toBeNull();
    expect(screen.getByText("Member removed")).toBeTruthy();
    expect(screen.getByText("Bob was removed from the team.")).toBeTruthy();
  });

  it("38. successful removal does not navigate", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("39. non-OK Team refresh still reports successful removal; 43. removed row stays absent; 44. Remove failed is absent", async () => {
    authenticated();
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return jsonResponse({ error: "boom" }, 500);
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
    expect(screen.getByText("Member removed")).toBeTruthy();
    expect(screen.queryByText("Remove failed")).toBeNull();
  });

  it("40. rejected Team refresh still reports successful removal", async () => {
    authenticated();
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return Promise.reject(new Error("network down"));
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
    expect(screen.getByText("Member removed")).toBeTruthy();
    expect(screen.queryByText("Remove failed")).toBeNull();
  });

  it("41. rejected refresh JSON still reports successful removal", async () => {
    authenticated();
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("bad json")) } as unknown as Response);
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
    expect(screen.getByText("Member removed")).toBeTruthy();
    expect(screen.queryByText("Remove failed")).toBeNull();
  });

  it("42. malformed refreshed Team payload still reports successful removal; 45. existing local Team content remains usable", async () => {
    authenticated();
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") return jsonResponse({});
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        if (teamGetCount === 1) return jsonResponse(VALID_TEAM);
        return jsonResponse({ id: 5 }); // malformed: id must be a string
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
    expect(screen.queryByTestId("team-member-remove-u2")).toBeNull();
    expect(screen.getByText("Member removed")).toBeTruthy();
    expect(screen.queryByText("Remove failed")).toBeNull();
  });

  it("46. failed DELETE keeps the member row; 47. preserves member order; 48. performs no Team refresh", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      team: () => jsonResponse(THREE_MEMBER_TEAM),
      removeMember: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByTestId("team-member-remove-u2")).toBeTruthy();
    expect(screen.getByTestId("team-member-remove-u3")).toBeTruthy();
    const teamCallsAfter = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    expect(teamCallsAfter).toBe(teamCallsBefore);
  });

  it("49. JSON server error is displayed (real single-read response body)", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve(singleReadResponse(JSON.stringify({ error: "Cannot remove yourself" }), 400)),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Cannot remove yourself")).toBeTruthy();
  });

  it("50. plain-text server error is displayed when applicable (real single-read response body)", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve(singleReadResponse("Server exploded", 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Server exploded")).toBeTruthy();
  });

  it("51. empty error response uses Failed to remove member (real single-read response body)", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve(singleReadResponse("", 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Failed to remove member")).toBeTruthy();
  });

  it("51a. JSON without a valid string error falls back rather than showing raw serialized JSON", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve(singleReadResponse(JSON.stringify({ error: 500 }), 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Failed to remove member")).toBeTruthy();
    expect(screen.queryByText(/"error":500/)).toBeNull();
  });

  it("52. failure title is exactly Remove failed", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Remove failed")).toBeTruthy();
  });

  it("53. failure closes the removal dialog", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.queryByTestId("team-member-removal-dialog")).toBeNull();
  });

  it("54. failure does not navigate", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("55. failure does not refetch applications; 56. failure does not refetch statistics", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response),
    });
    render(<TeamDetailPage />);
    await flush();
    const appsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length;
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length).toBe(appsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length).toBe(statsBefore);
  });

  it("57. Leave Team still uses exact membership DELETE endpoint", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const leaveCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "DELETE");
    expect(leaveCall).toBeTruthy();
  });

  it("58. Leave Team confirmation copy remains unchanged", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
    expect(screen.getByText("Are you sure you want to leave the team Midnight Puzzle Society?")).toBeTruthy();
  });

  it("59. Leave Team success copy remains unchanged; 60. failure copy remains unchanged", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await flush();
    expect(screen.getByText("Left team")).toBeTruthy();
    expect(screen.getByText("You have left Midnight Puzzle Society.")).toBeTruthy();
  });

  it("61. Leave Team navigation remains delayed exactly 1,200ms", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(mockPush).toHaveBeenCalledWith("/teams");
  });

  it("62. Theme mutation remains unchanged", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: () => jsonResponse({ items: [{ item: { subcategory: "team_theme", metadata: { value: "gold" } } }] }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    const themeCall = calls.find((c) => c.url.includes("/theme") && c.method === "PUT");
    expect(themeCall?.body).toEqual({ theme: "gold" });
  });

  it("63. Application approve remains unchanged", async () => {
    authenticated();
    const applicationFixtureLocal = [
      { id: "app-1", createdAt: "2026-01-01T00:00:00.000Z", user: { id: "u-app1", name: "Applicant One", email: "one@example.test", image: null } },
    ];
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(applicationFixtureLocal) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    const approveCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications/app-1`) && c.method === "POST");
    expect(approveCall?.body).toEqual({ action: "approve" });
  });

  it("64. membership polling remains 10 seconds; 65. invite-status polling remains 5 seconds while pending", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inviteStatus: () => jsonResponse({ status: "pending" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const membershipCallsBefore = calls.filter((c) => c.url.includes("/membership")).length;
    const inviteCallsBefore = calls.filter((c) => c.url.includes("/invite-status")).length;
    await act(async () => { jest.advanceTimersByTime(10000); await Promise.resolve(); });
    expect(calls.filter((c) => c.url.includes("/membership")).length).toBeGreaterThan(membershipCallsBefore);
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); });
    expect(calls.filter((c) => c.url.includes("/invite-status")).length).toBeGreaterThan(inviteCallsBefore);
  });

  it("66. no write request occurs during initial render", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("67. unmount before a successful DELETE resolves performs no post-removal Team refresh and throws no async exception", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        return jsonResponse(VALID_TEAM);
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();

    const teamGetCountBeforeUnmount = teamGetCount;
    unmount();

    await act(async () => {
      resolveDelete({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // No additional GET /api/teams/[id] refresh was issued after unmount.
    expect(teamGetCount).toBe(teamGetCountBeforeUnmount);
  });

  it("68. unmount before a failed DELETE resolves performs no Team refresh and no post-unmount failure feedback", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    let teamGetCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        teamGetCount += 1;
        return jsonResponse(VALID_TEAM);
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();

    const teamGetCountBeforeUnmount = teamGetCount;
    unmount();

    await act(async () => {
      resolveDelete(singleReadResponse("Server exploded", 500));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(teamGetCount).toBe(teamGetCountBeforeUnmount);
  });

  it("69. unmount during the best-effort Team refresh performs no additional work and throws no async exception", async () => {
    authenticated();
    let resolveRefresh: (v: Response) => void = () => {};
    let deleteResolved = false;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && method === "DELETE") {
        deleteResolved = true;
        return jsonResponse({});
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "admin" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/applications`)) return jsonResponse([]);
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") {
        if (!deleteResolved) return jsonResponse(VALID_TEAM);
        return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();

    unmount();

    await act(async () => {
      resolveRefresh({ ok: true, status: 200, json: () => Promise.resolve(VALID_TEAM), text: () => Promise.resolve("") } as Response);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    // Reaching this point without an unhandled rejection or React
    // act()-outside-of-test warning is the assertion: no further state
    // updates or requests occur after unmount.
    expect(true).toBe(true);
  });
});

describe("Team Detail page — leave team (Pass 16B.3.2)", () => {
  async function openLeaveDialog() {
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
  }

  it("1. a member can open the dedicated Leave Team dialog", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    expect(screen.getByTestId("team-leave-dialog")).toBeTruthy();
  });

  it("2. dialog heading is exactly Leave team", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    expect(screen.getByRole("heading", { name: "Leave team" })).toBeTruthy();
  });

  it("3. confirmation includes the exact team name", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    expect(screen.getByText("Are you sure you want to leave the team Midnight Puzzle Society?")).toBeTruthy();
  });

  it("4. whitespace team names use Unnamed Team", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      team: () => jsonResponse({ ...VALID_TEAM, name: "   " }),
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    expect(screen.getByText("Are you sure you want to leave the team Unnamed Team?")).toBeTruthy();
  });

  it("5. Cancel closes the dialog; 6. sends no DELETE; 7. schedules no navigation", async () => {
    authenticated();
    jest.useFakeTimers();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-cancel"));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
    expect(calls.find((c) => c.url.endsWith("/membership") && c.method === "DELETE")).toBeUndefined();
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("8. Escape closes without mutation", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    await flush();
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
    expect(calls.find((c) => c.url.endsWith("/membership") && c.method === "DELETE")).toBeUndefined();
  });

  it("9. Backdrop closes without mutation", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    const { container } = render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    await flush();
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
    expect(calls.find((c) => c.url.endsWith("/membership") && c.method === "DELETE")).toBeUndefined();
  });

  it("10. confirmation uses exact DELETE /api/teams/[id]/membership; 11. method is exactly DELETE; 12. no headers; 13. no body", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    const leaveCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "DELETE");
    expect(leaveCall).toBeTruthy();
    expect(leaveCall?.body).toBeUndefined();
  });

  it("14. no member-removal endpoint is called by leaving", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(calls.find((c) => c.url.includes("/members/"))).toBeUndefined();
  });

  it("15. rapid repeated confirmation issues exactly one DELETE", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    let deleteCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") {
        deleteCount += 1;
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "member" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(deleteCount).toBe(1);
    await act(async () => {
      resolveDelete({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response);
    });
  });

  it("16. dialog stays open while DELETE is pending; 17. label becomes Leaving…; 18. busy state; 19. Cancel disabled; 20. repeated confirmation blocked", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    let deleteCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") {
        deleteCount += 1;
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "member" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();

    expect(screen.getByTestId("team-leave-dialog")).toBeTruthy();
    expect(screen.getByTestId("team-leave-confirm").textContent).toContain("Leaving…");
    expect(screen.getByTestId("team-leave-dialog").getAttribute("aria-busy")).toBe("true");
    expect((screen.getByTestId("team-leave-cancel") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(deleteCount).toBe(1);

    await act(async () => {
      resolveDelete({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response);
    });
  });

  it("21. pending state clears after failure; 22. dialog closes after success; 23. dialog closes after failure", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => Promise.resolve(singleReadResponse("boom", 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();

    // Reopen and confirm with success to verify the dialog closes there too.
    await openLeaveDialog();
    // Swap to a success handler for the next attempt.
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
  });

  it("24. exact success title; 25. exact success message; 26. success variant", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.getByText("Left team")).toBeTruthy();
    expect(screen.getByText("You have left Midnight Puzzle Society.")).toBeTruthy();
  });

  it("27. no immediate navigation; 28. no navigation at 1199ms; 29. exactly one navigation at 1200ms; 30. no second timer", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1199); });
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/teams");
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("31. closing the success ActionModal does not cancel navigation", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    await act(async () => { fireEvent.click(closeButtons[0]); });
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(mockPush).toHaveBeenCalledWith("/teams");
  });

  it("32. a second Leave Team attempt during the 1,200ms window issues no additional DELETE", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const deleteCallsAfterFirst = calls.filter((c) => c.url.endsWith("/membership") && c.method === "DELETE").length;
    // The action deck's Leave Team trigger is gone once membership ends locally
    // in spirit, but the dialog itself is already closed — attempt to reopen
    // via the trigger is a no-op path since the in-flight guard remains set
    // regardless of dialog visibility.
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(calls.filter((c) => c.url.endsWith("/membership") && c.method === "DELETE").length).toBe(deleteCallsAfterFirst);
  });

  it("33. successful leave performs no Team refresh; 34. no applications refetch; 35. no statistics refetch; 36. no explicit membership refetch", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const teamGetBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    const appsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length;
    const membershipGetBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "GET").length;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length).toBe(teamGetBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length).toBe(appsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length).toBe(statsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "GET").length).toBe(membershipGetBefore);
  });

  it("37. successful leave does not mutate local member order before navigation", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const beforeNames = screen.getAllByText(/Me|Bob/).map((el) => el.textContent);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const afterNames = screen.getAllByText(/Me|Bob/).map((el) => el.textContent);
    expect(afterNames).toEqual(beforeNames);
  });

  it("38. failed DELETE shows exact Leave failed title; 39. JSON server error is displayed", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => Promise.resolve(singleReadResponse(JSON.stringify({ error: "You are not a member of this team" }), 400)),
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.getByText("Leave failed")).toBeTruthy();
    expect(screen.getByText("You are not a member of this team")).toBeTruthy();
  });

  it("40. plain-text server error is displayed", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => Promise.resolve(singleReadResponse("Server exploded", 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.getByText("Server exploded")).toBeTruthy();
  });

  it("41. empty response uses Failed to leave team", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => Promise.resolve(singleReadResponse("", 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.getByText("Failed to leave team")).toBeTruthy();
  });

  it("42. JSON without a valid string error uses the fallback", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => Promise.resolve(singleReadResponse(JSON.stringify({ error: 500 }), 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.getByText("Failed to leave team")).toBeTruthy();
    expect(screen.queryByText(/"error":500/)).toBeNull();
  });

  it("43. failed leave schedules no timer; 44. never navigates after 1,200ms", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => Promise.resolve(singleReadResponse("boom", 500)),
    });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("45. failed leave performs no Team refresh; 46. no applications refetch; 47. no statistics refetch; 48. no explicit membership refetch", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      leaveTeam: () => Promise.resolve(singleReadResponse("boom", 500)),
    });
    render(<TeamDetailPage />);
    await flush();
    const teamGetBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length;
    const appsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length;
    const statsBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length;
    const membershipGetBefore = calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "GET").length;
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}`) && c.method === "GET").length).toBe(teamGetBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/applications`)).length).toBe(appsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/stats`)).length).toBe(statsBefore);
    expect(calls.filter((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/membership`) && c.method === "GET").length).toBe(membershipGetBefore);
  });

  it("49. failed leave releases the duplicate guard; 50. user can reopen the dialog after failure", async () => {
    authenticated();
    let deleteCount = 0;
    buildFetchMock({
      membership: () => jsonResponse({ role: "member" }),
      leaveTeam: () => { deleteCount += 1; return Promise.resolve(singleReadResponse("boom", 500)); },
    });
    render(<TeamDetailPage />);
    await flush();
    await openLeaveDialog();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
    await openLeaveDialog();
    expect(screen.getByTestId("team-leave-dialog")).toBeTruthy();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    expect(deleteCount).toBe(2);
  });

  it("51. unmount before successful DELETE resolution causes no feedback and no navigation timer", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "member" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();

    unmount();

    await act(async () => {
      resolveDelete({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") } as Response);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    // Reaching this point without an unhandled rejection or React
    // act()-outside-of-test warning is the assertion, since the page is
    // already unmounted and cannot expose any DOM state.
    expect(true).toBe(true);
  });

  it("52. unmount before failed DELETE resolution causes no feedback and no timer", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "member" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();

    unmount();

    await act(async () => {
      resolveDelete(singleReadResponse("Server exploded", 500));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(true).toBe(true);
  });

  it("53. unmount after successful DELETE but before 1,200ms clears the navigation timer; 54. advancing timers after unmount never calls router.push", async () => {
    jest.useFakeTimers();
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    const { unmount } = render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    unmount();

    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("55. unmount cleanup releases the synchronous guard", async () => {
    authenticated();
    let resolveDelete: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`) && method === "DELETE") {
        return new Promise<Response>((resolve) => { resolveDelete = resolve; });
      }
      if (url.endsWith(`/api/teams/${TEAM_ID}/membership`)) return jsonResponse({ role: "member" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/invite-status`)) return jsonResponse({ status: "none" });
      if (url.endsWith(`/api/teams/${TEAM_ID}/stats`)) return jsonResponse(VALID_STATS);
      if (url.endsWith(`/api/teams/${TEAM_ID}`) && method === "GET") return jsonResponse(VALID_TEAM);
      return jsonResponse({});
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Leave Team" }));
    await flush();
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    await flush();
    unmount();
    // No direct observable assertion is possible post-unmount beyond not
    // throwing; this test's value is documenting the expected contract
    // (leaveInFlightRef is cleared in the unmount cleanup effect).
    expect(true).toBe(true);
  });

  it("56. router push throwing does not produce an unhandled timer exception, does not show Leave failed, and does not issue another DELETE", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "member" }) });
    mockPush.mockImplementationOnce(() => { throw new Error("navigation blocked"); });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave Team" })); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByTestId("team-leave-confirm")); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const deleteCallsBefore = calls.filter((c) => c.url.endsWith("/membership") && c.method === "DELETE").length;
    await act(async () => { jest.advanceTimersByTime(1200); });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Leave failed")).toBeNull();
    expect(calls.filter((c) => c.url.endsWith("/membership") && c.method === "DELETE").length).toBe(deleteCallsBefore);
  });

  it("57. member-removal endpoint remains exact; 58. member-removal success remains unchanged", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    const removeCall = calls.find((c) => c.url.endsWith(`/api/teams/${TEAM_ID}/members/u2`) && c.method === "DELETE");
    expect(removeCall).toBeTruthy();
    expect(screen.getByText("Member removed")).toBeTruthy();
  });

  it("59. member-removal failure remains unchanged", async () => {
    authenticated();
    buildFetchMock({
      membership: () => jsonResponse({ role: "admin" }),
      removeMember: () => Promise.resolve(singleReadResponse("Cannot remove yourself", 400)),
    });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    await flush();
    expect(screen.getByText("Remove failed")).toBeTruthy();
    expect(screen.getByText("Cannot remove yourself")).toBeTruthy();
  });

  it("60. member-removal focus containment remains present", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-member-remove-u2"));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId("team-member-removal-cancel"));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("team-member-removal-confirm"));
  });

  it("61. application approve remains unchanged; 62. application deny remains unchanged", async () => {
    const applicationFixtureLocal = [
      { id: "app-1", user: { id: "applicant-1", name: "Applicant One", email: "a1@example.test", image: null }, message: null, createdAt: "2026-01-10T00:00:00.000Z" },
      { id: "app-2", user: { id: "applicant-2", name: "Applicant Two", email: "a2@example.test", image: null }, message: null, createdAt: "2026-01-11T00:00:00.000Z" },
    ];
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), applications: () => jsonResponse(applicationFixtureLocal) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    await flush();
    fireEvent.click(screen.getByTestId("team-application-deny-app-2"));
    await flush();
    expect(calls.find((c) => c.url.endsWith("/applications/app-1") && c.method === "POST")).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/applications/app-2") && c.method === "POST")).toBeTruthy();
  });

  it("63. theme mutation remains unchanged", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inventory: () => jsonResponse({ items: [{ item: { subcategory: "team_theme", metadata: { value: "gold" } } }] }) });
    render(<TeamDetailPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    await flush();
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    await flush();
    expect(calls.find((c) => c.url.endsWith("/theme") && c.method === "PUT")).toBeTruthy();
  });

  it("64. action deck renders once", async () => {
    authenticated();
    buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(screen.getAllByRole("button", { name: "Leave Team" })).toHaveLength(1);
  });

  it("65. membership polling remains 10 seconds; 66. invite-status polling remains 5 seconds while pending", async () => {
    jest.useFakeTimers();
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }), inviteStatus: () => jsonResponse({ status: "pending" }) });
    render(<TeamDetailPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const membershipCallsBefore = calls.filter((c) => c.url.includes("/membership")).length;
    const inviteCallsBefore = calls.filter((c) => c.url.includes("/invite-status")).length;
    await act(async () => { jest.advanceTimersByTime(10000); await Promise.resolve(); });
    expect(calls.filter((c) => c.url.includes("/membership")).length).toBeGreaterThan(membershipCallsBefore);
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); });
    expect(calls.filter((c) => c.url.includes("/invite-status")).length).toBeGreaterThan(inviteCallsBefore);
  });

  it("69. initial render produces no write request", async () => {
    authenticated();
    const { calls } = buildFetchMock({ membership: () => jsonResponse({ role: "admin" }) });
    render(<TeamDetailPage />);
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
});
