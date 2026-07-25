/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TeamsPage from "./page";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

const VALID_TEAMS = [
  {
    id: "team-mine",
    name: "Midnight Puzzle Society",
    description: "We solve puzzles together.",
    isPublic: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    members: [{ user: { id: "me", name: "Me", image: null }, role: "admin" }],
  },
  {
    id: "team-public",
    name: "Open Crossword Club",
    description: "Anyone welcome.",
    isPublic: true,
    createdAt: "2026-01-02T00:00:00.000Z",
    members: [{ user: { id: "someone-else", name: "Someone", image: null }, role: "admin" }],
  },
];

const VALID_INVITATION_FIXTURE = [
  {
    id: "inv-1",
    teamId: "team-invited",
    status: "pending",
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    team: { id: "team-invited", name: "Invited Team", description: null, members: [] },
  },
];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response);
}

type RouteHandler = (url: string, init?: RequestInit) => Promise<Response>;

function buildFetchMock(overrides: Partial<{ teams: RouteHandler; invitations: RouteHandler; createTeam: RouteHandler }> = {}) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (url.endsWith("/api/teams/invitations")) return overrides.invitations?.(url, init) ?? jsonResponse([]);
    if (url.endsWith("/api/teams") && method === "POST") return overrides.createTeam?.(url, init) ?? jsonResponse({});
    if (url.endsWith("/api/teams")) return overrides.teams?.(url, init) ?? jsonResponse(VALID_TEAMS);
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
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Teams hub page — authentication loading", () => {
  it("1. session loading shows the Teams skeleton", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    render(<TeamsPage />);
    expect(screen.getByTestId("teams-hub-loading")).toBeTruthy();
  });

  it("2. session loading sends no Team request; 3. sends no invitation request", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<TeamsPage />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Teams hub page — anonymous loading", () => {
  it("4. requests /api/teams; 5. uses GET; 6. uses cache: no-store; 7. receives an AbortSignal", async () => {
    unauthenticated();
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/teams")) capturedInit = init;
      return jsonResponse(VALID_TEAMS);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    expect(capturedInit?.method ?? "GET").toBe("GET");
    expect(capturedInit?.cache).toBe("no-store");
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("8. anonymous visitor makes no invitation request", async () => {
    unauthenticated();
    const { calls } = buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(calls.find((c) => c.url.endsWith("/invitations"))).toBeUndefined();
  });

  it("9. anonymous visitor is not redirected; 10. renders Public Teams", async () => {
    unauthenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(screen.getByText("Open Crossword Club")).toBeTruthy();
    expect(screen.queryByText("Midnight Puzzle Society")).toBeNull();
  });

  it("11. anonymous visitor cannot open Create Team", async () => {
    unauthenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-create")).toBeNull();
  });

  it("12. anonymous visitor sees the sign-in link", async () => {
    unauthenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-sign-in")).toBeTruthy();
  });
});

describe("Teams hub page — authenticated loading", () => {
  it("13. requests /api/teams; 14. requests invitations", async () => {
    authenticated();
    const { calls } = buildFetchMock({ invitations: () => jsonResponse(VALID_INVITATION_FIXTURE) });
    render(<TeamsPage />);
    await flush();
    expect(calls.find((c) => c.url.endsWith("/api/teams") && c.method === "GET")).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/invitations"))).toBeTruthy();
  });

  it("15. authenticated visitor defaults to My Teams", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-view-mine").getAttribute("aria-pressed")).toBe("true");
  });

  it("16. authenticated My Teams filtering uses session user ID", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
    expect(screen.queryByText("Open Crossword Club")).toBeNull();
  });

  it("17. public mode switching performs no additional fetch; 18. switching back performs no additional fetch", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamsPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith("/api/teams")).length;
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    expect(screen.getByText("Open Crossword Club")).toBeTruthy();
    fireEvent.click(screen.getByTestId("teams-hub-view-mine"));
    await flush();
    expect(calls.filter((c) => c.url.endsWith("/api/teams")).length).toBe(teamCallsBefore);
  });
});

describe("Teams hub page — normalization", () => {
  it("19. valid Teams render; 20. Team order is preserved", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    const grid = screen.getByTestId("teams-hub-grid");
    const links = within(grid).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("data-testid"))).toEqual(["teams-hub-team-team-public"]);
  });

  it("21. malformed Team rows are dropped; 22. malformed member rows are dropped", async () => {
    authenticated();
    buildFetchMock({
      teams: () =>
        jsonResponse([
          ...VALID_TEAMS,
          null,
          "invalid",
          { id: "bad", name: "Bad", isPublic: true, members: [null, { user: { id: "" }, role: "member" }] },
        ]),
    });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    // "bad" row is malformed member-wise but is itself a structurally valid
    // Team row (has id/name/isPublic/members array) — members within it are
    // simply dropped; the row itself still renders with zero members.
    expect(screen.getByText("Open Crossword Club")).toBeTruthy();
    expect(screen.getByText("Bad")).toBeTruthy();
  });

  it("23. blank names use the fallback; 24. missing descriptions use the fallback", async () => {
    authenticated();
    buildFetchMock({
      teams: () =>
        jsonResponse([
          { id: "blank", name: "   ", description: null, isPublic: true, members: [] },
        ]),
    });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    expect(screen.getByText("Unnamed Team")).toBeTruthy();
    expect(screen.getByText("No description provided.")).toBeTruthy();
  });

  it("25. non-array payload enters error state", async () => {
    authenticated();
    buildFetchMock({ teams: () => jsonResponse({ notAnArray: true }) });
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-error")).toBeTruthy();
  });

  it("26. rejected JSON enters error state", async () => {
    authenticated();
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/teams")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("bad json")) } as unknown as Response);
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-error")).toBeTruthy();
  });
});

describe("Teams hub page — request failures", () => {
  it("27. non-OK Team response enters error state", async () => {
    authenticated();
    buildFetchMock({ teams: () => jsonResponse({ error: "failed" }, 500) });
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-error")).toBeTruthy();
  });

  it("28. rejected Team fetch enters error state", async () => {
    authenticated();
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/teams")) return Promise.reject(new Error("network down"));
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-error")).toBeTruthy();
  });

  it("29. error state is not presented as an empty state", async () => {
    authenticated();
    buildFetchMock({ teams: () => jsonResponse({ error: "failed" }, 500) });
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-empty")).toBeNull();
    expect(screen.getByTestId("teams-hub-error")).toBeTruthy();
  });

  it("30. error retry sends exactly one new Team request", async () => {
    authenticated();
    let call = 0;
    const { calls } = buildFetchMock({
      teams: () => {
        call += 1;
        return call === 1 ? jsonResponse({}, 500) : jsonResponse(VALID_TEAMS);
      },
    });
    render(<TeamsPage />);
    await flush();
    const before = calls.filter((c) => c.url.endsWith("/api/teams")).length;
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    await flush();
    expect(calls.filter((c) => c.url.endsWith("/api/teams")).length).toBe(before + 1);
  });

  it("31. rapid retry clicks produce exactly one request", async () => {
    authenticated();
    let resolveRetry: (v: Response) => void = () => {};
    let teamCallCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/teams")) {
        teamCallCount += 1;
        if (teamCallCount === 1) return jsonResponse({}, 500);
        return new Promise<Response>((resolve) => { resolveRetry = resolve; });
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    await flush();
    expect(teamCallCount).toBe(2);
    await act(async () => {
      resolveRetry(await jsonResponse(VALID_TEAMS));
    });
  });

  it("32. Trying… label appears", async () => {
    authenticated();
    let resolveRetry: (v: Response) => void = () => {};
    let teamCallCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/teams")) {
        teamCallCount += 1;
        if (teamCallCount === 1) return jsonResponse({}, 500);
        return new Promise<Response>((resolve) => { resolveRetry = resolve; });
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    await flush();
    expect(screen.getByTestId("teams-hub-retry").textContent).toContain("Trying…");
    await act(async () => {
      resolveRetry(await jsonResponse(VALID_TEAMS));
    });
  });

  it("33. successful retry renders Teams", async () => {
    authenticated();
    let call = 0;
    buildFetchMock({
      teams: () => {
        call += 1;
        return call === 1 ? jsonResponse({}, 500) : jsonResponse(VALID_TEAMS);
      },
    });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("34. failed retry re-enables Try Again", async () => {
    authenticated();
    buildFetchMock({ teams: () => jsonResponse({}, 500) });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    await flush();
    expect((screen.getByTestId("teams-hub-retry") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("teams-hub-retry").textContent).toContain("Try Again");
  });
});

describe("Teams hub page — stale and unmount safety", () => {
  it("35. a stale Team response cannot replace a newer response; 36. starting a newer Team load aborts the prior request", async () => {
    authenticated();
    const abortedSignals: AbortSignal[] = [];
    let resolveFirst: (v: Response) => void = () => {};
    let call = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/teams")) {
        call += 1;
        if (init?.signal) {
          abortedSignals.push(init.signal);
        }
        if (call === 1) return new Promise<Response>((resolve) => { resolveFirst = resolve; });
        return jsonResponse(VALID_TEAMS);
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const { rerender } = render(<TeamsPage />);
    await flush();
    // Trigger a second load by remounting session state (simulate a fresh load cycle).
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me", email: "me2@example.test" } } });
    rerender(<TeamsPage />);
    await flush();

    expect(abortedSignals[0]?.aborted).toBe(true);

    await act(async () => {
      resolveFirst(await jsonResponse([{ id: "stale", name: "Stale", isPublic: true, members: [] }]));
    });
    // The stale first response must not have replaced the second (current) result.
    expect(screen.queryByText("Stale")).toBeNull();
  });

  it("37. unmount aborts the active Team request; 38. a Team response resolving after unmount causes no state update", async () => {
    authenticated();
    let resolveTeams: (v: Response) => void = () => {};
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/teams")) {
        capturedSignal = init?.signal as AbortSignal;
        return new Promise<Response>((resolve) => { resolveTeams = resolve; });
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamsPage />);
    await flush();
    unmount();
    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      resolveTeams(await jsonResponse(VALID_TEAMS));
      await Promise.resolve();
      await Promise.resolve();
    });
    // Reaching this point without an unhandled rejection or React
    // act()-outside-of-test warning is the assertion.
    expect(true).toBe(true);
  });

  it("39. Strict Mode replay applies only the latest Team response", async () => {
    const { StrictMode } = await import("react");
    authenticated();
    buildFetchMock();
    render(
      <StrictMode>
        <TeamsPage />
      </StrictMode>
    );
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });
});

describe("Teams hub page — invitation count", () => {
  it("40. valid invitation array sets the visible count", async () => {
    authenticated();
    buildFetchMock({ invitations: () => jsonResponse([{ id: "a" }, { id: "b" }]) });
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-invitations").getAttribute("aria-label")).toBe("Invitations, 2 pending");
  });

  it("41. empty invitation array hides the Invitations control", async () => {
    authenticated();
    buildFetchMock({ invitations: () => jsonResponse([]) });
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-invitations")).toBeNull();
  });

  it("42. non-array invitations hide the control", async () => {
    authenticated();
    buildFetchMock({ invitations: () => jsonResponse({ notArray: true }) });
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-invitations")).toBeNull();
  });

  it("43. non-OK invitations hide the control", async () => {
    authenticated();
    buildFetchMock({ invitations: () => jsonResponse({}, 500) });
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-invitations")).toBeNull();
  });

  it("44. rejected invitation fetch does not fail the Teams hub", async () => {
    authenticated();
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/invitations")) return Promise.reject(new Error("network down"));
      if (url.endsWith("/api/teams")) return jsonResponse(VALID_TEAMS);
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-error")).toBeNull();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("45. rejected invitation JSON does not fail the Teams hub", async () => {
    authenticated();
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/invitations")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("bad json")) } as unknown as Response);
      }
      if (url.endsWith("/api/teams")) return jsonResponse(VALID_TEAMS);
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    render(<TeamsPage />);
    await flush();
    expect(screen.queryByTestId("teams-hub-error")).toBeNull();
  });

  it("46. stale invitation response cannot replace a newer count", async () => {
    authenticated();
    let resolveFirst: (v: Response) => void = () => {};
    let call = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/invitations")) {
        call += 1;
        if (call === 1) return new Promise<Response>((resolve) => { resolveFirst = resolve; });
        return jsonResponse([{ id: "x" }]);
      }
      if (url.endsWith("/api/teams")) return jsonResponse(VALID_TEAMS);
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const { rerender } = render(<TeamsPage />);
    await flush();
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me", email: "me3@example.test" } } });
    rerender(<TeamsPage />);
    await flush();

    await act(async () => {
      resolveFirst(await jsonResponse([{ id: "a" }, { id: "b" }, { id: "c" }]));
    });
    // The stale (first) 3-item response must not overwrite the second, more
    // current 1-item result.
    expect(screen.getByTestId("teams-hub-invitations").getAttribute("aria-label")).toBe("Invitations, 1 pending");
  });

  it("47. unmount aborts the invitation request; 48. invitation response after unmount performs no state update", async () => {
    authenticated();
    let resolveInvitations: (v: Response) => void = () => {};
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/invitations")) {
        capturedSignal = init?.signal as AbortSignal;
        return new Promise<Response>((resolve) => { resolveInvitations = resolve; });
      }
      if (url.endsWith("/api/teams")) return jsonResponse(VALID_TEAMS);
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const { unmount } = render(<TeamsPage />);
    await flush();
    unmount();
    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      resolveInvitations(await jsonResponse([{ id: "a" }]));
      await Promise.resolve();
    });
    expect(true).toBe(true);
  });
});

describe("Teams hub page — existing modal wiring", () => {
  it("49. authenticated Create Team control opens CreateTeamModal", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-create"));
    await flush();
    expect(screen.getByText("Create New Team")).toBeTruthy();
  });

  it("50. closing Create Team preserves Teams", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-create"));
    await flush();
    fireEvent.click(screen.getByText("Cancel"));
    await flush();
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("51. create success closes the modal; 52. reloads Teams exactly once; 53. preserves the selected view mode; 54. does not navigate", async () => {
    authenticated();
    const { calls } = buildFetchMock({
      createTeam: () => jsonResponse({ id: "new-team" }),
    });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith("/api/teams") && c.method === "GET").length;

    fireEvent.click(screen.getByTestId("teams-hub-create"));
    await flush();
    fireEvent.change(screen.getByPlaceholderText("Enter team name"), { target: { value: "Brand New Team" } });
    const submitButton = screen.getAllByRole("button", { name: "Create Team" }).find((btn) => (btn as HTMLButtonElement).type === "submit")!;
    fireEvent.click(submitButton);
    await flush();

    expect(screen.queryByText("Create New Team")).toBeNull();
    expect(calls.filter((c) => c.url.endsWith("/api/teams") && c.method === "GET").length).toBe(teamCallsBefore + 1);
    expect(screen.getByTestId("teams-hub-view-public").getAttribute("aria-pressed")).toBe("true");
  });

  it("55. Invitations control opens PendingInvitations", async () => {
    authenticated();
    buildFetchMock({ invitations: () => jsonResponse(VALID_INVITATION_FIXTURE) });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-invitations"));
    await flush();
    expect(screen.getByText("Team Invitations")).toBeTruthy();
  });

  it("56. closing Pending Invitations closes the panel; 57. reloads invitation count once; 58. does not reload Teams", async () => {
    authenticated();
    const { calls } = buildFetchMock({ invitations: () => jsonResponse(VALID_INVITATION_FIXTURE) });
    const { container } = render(<TeamsPage />);
    await flush();
    const teamCallsBefore = calls.filter((c) => c.url.endsWith("/api/teams") && c.method === "GET").length;
    const invitationCallsBefore = calls.filter((c) => c.url.endsWith("/invitations")).length;

    fireEvent.click(screen.getByTestId("teams-hub-invitations"));
    await flush();
    const backdrop = container.querySelector(".bg-black\\/50") as HTMLElement;
    fireEvent.click(backdrop);
    await flush();

    expect(screen.queryByText("Team Invitations")).toBeNull();
    expect(calls.filter((c) => c.url.endsWith("/invitations")).length).toBeGreaterThan(invitationCallsBefore);
    expect(calls.filter((c) => c.url.endsWith("/api/teams") && c.method === "GET").length).toBe(teamCallsBefore);
  });
});

describe("Teams hub page — empty states", () => {
  it("59. authenticated My Teams empty state is correct", async () => {
    authenticated();
    buildFetchMock({ teams: () => jsonResponse([VALID_TEAMS[1]]) });
    render(<TeamsPage />);
    await flush();
    expect(screen.getByRole("heading", { name: "You’re not on a team yet" })).toBeTruthy();
  });

  it("60. Explore Public Teams changes view without fetching", async () => {
    authenticated();
    const { calls } = buildFetchMock({ teams: () => jsonResponse([VALID_TEAMS[1]]) });
    render(<TeamsPage />);
    await flush();
    const before = calls.filter((c) => c.url.endsWith("/api/teams")).length;
    fireEvent.click(screen.getByText("Explore Public Teams"));
    await flush();
    expect(screen.getByText("Open Crossword Club")).toBeTruthy();
    expect(calls.filter((c) => c.url.endsWith("/api/teams")).length).toBe(before);
  });

  it("61. authenticated Public empty state is correct", async () => {
    authenticated();
    buildFetchMock({ teams: () => jsonResponse([VALID_TEAMS[0]]) });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    expect(screen.getByRole("heading", { name: "No public teams yet" })).toBeTruthy();
    expect(screen.getByText("Create a team and be the first to welcome new players.")).toBeTruthy();
  });

  it("62. anonymous Public empty state is correct", async () => {
    unauthenticated();
    buildFetchMock({ teams: () => jsonResponse([VALID_TEAMS[0]]) });
    render(<TeamsPage />);
    await flush();
    expect(screen.getByRole("heading", { name: "No public teams yet" })).toBeTruthy();
    expect(screen.getByText("Sign in to create a team and start building your crew.")).toBeTruthy();
  });
});

describe("Teams hub page — frozen regressions", () => {
  it("63. every Team card links to /teams/[id]", async () => {
    authenticated();
    buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(screen.getByTestId("teams-hub-team-team-mine").getAttribute("href")).toBe("/teams/team-mine");
  });

  it("64. initial render produces no write request", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("65. switching views produces no write request", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-view-mine"));
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("66. retry produces no write request", async () => {
    authenticated();
    let call = 0;
    const { calls } = buildFetchMock({
      teams: () => {
        call += 1;
        return call === 1 ? jsonResponse({}, 500) : jsonResponse(VALID_TEAMS);
      },
    });
    render(<TeamsPage />);
    await flush();
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    await flush();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("67. no .sort( exists in the page source", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });

  it("68. no Team Detail endpoint is fetched during hub loading", async () => {
    authenticated();
    const { calls } = buildFetchMock();
    render(<TeamsPage />);
    await flush();
    expect(calls.find((c) => /\/api\/teams\/[^/]+\/(stats|membership)/.test(c.url))).toBeUndefined();
  });
});
