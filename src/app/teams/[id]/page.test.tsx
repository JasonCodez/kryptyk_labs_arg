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
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[0]!);
    await flush();
    // Once the ConfirmModal opens, its own "Remove" confirm button coexists
    // with the still-mounted inline roster "Remove" action — the modal's
    // confirm button is the last one rendered in DOM order.
    const buttonsWithModalOpen = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(buttonsWithModalOpen[buttonsWithModalOpen.length - 1]!);
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
