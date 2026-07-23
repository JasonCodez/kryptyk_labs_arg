/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import TeamLeaderboardsPage from "./page";

const mockUseSession = jest.fn();
const mockReplace = jest.fn();
const stableRouter = { replace: mockReplace };
jest.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));
jest.mock("next/navigation", () => ({ useRouter: () => stableRouter }));

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

const ENTRY_1 = {
  teamId: "t1", teamName: "Alpha Squad", isPublic: true, bannerColor: "gold",
  totalPoints: 5000, totalPuzzlesSolved: 200, memberCount: 10, rank: 1,
};
const ENTRY_2 = {
  teamId: "t2", teamName: "Beta Crew", isPublic: false, bannerColor: "crimson",
  totalPoints: 3000, totalPuzzlesSolved: 100, memberCount: 5, rank: 2,
};
const ENTRY_4 = {
  teamId: "my-team", teamName: "My Team", isPublic: false, bannerColor: "neon",
  totalPoints: 1000, totalPuzzlesSolved: 40, memberCount: 3, rank: 4,
};
const USER_TEAM_RANK = ENTRY_4;

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

function authenticate() {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me" } } });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockReplace.mockReset();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

function mockFetch(entries: Array<Record<string, unknown>> = [ENTRY_1, ENTRY_2, ENTRY_4], userTeamRank: unknown = USER_TEAM_RANK) {
  const calls: string[] = [];
  const inits: RequestInit[] = [];
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    if (init) inits.push(init);
    return jsonResponse({ entries, userTeamRank });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { calls, inits, fetchMock };
}

describe("Team Leaderboards page — authentication", () => {
  it("1. session loading shows page header and loading skeleton", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    render(<TeamLeaderboardsPage />);
    expect(screen.getByText("Team Leaderboards")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading team leaderboard" })).toBeTruthy();
  });

  it("2. session loading does not call the Team API", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("3. unauthenticated redirects to /auth/signin", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    render(<TeamLeaderboardsPage />);
    expect(mockReplace).toHaveBeenCalledWith("/auth/signin");
  });

  it("4. unauthenticated does not call the Team API", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("5. authenticated calls /api/leaderboards/teams", async () => {
    authenticate();
    const { calls } = mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(calls.some((c) => c.includes("/api/leaderboards/teams"))).toBe(true);
  });

  it("6. API uses cache: no-store", async () => {
    authenticate();
    const { inits } = mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(inits[0]?.cache).toBe("no-store");
  });

  it("7. API receives an AbortSignal", async () => {
    authenticate();
    const { inits } = mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(inits[0]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("Team Leaderboards page — lifecycle", () => {
  it("8. Strict Mode replay still applies the successful response", async () => {
    const { StrictMode } = await import("react");
    authenticate();
    mockFetch();
    render(
      <StrictMode>
        <TeamLeaderboardsPage />
      </StrictMode>
    );
    await flush();
    expect(screen.getByText("Alpha Squad")).toBeTruthy();
  });

  it("9. unmount aborts the active request", async () => {
    authenticate();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_input, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    const { unmount } = render(<TeamLeaderboardsPage />);
    await flush();
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("10. a stale response is ignored", async () => {
    authenticate();
    // React Strict Mode replays mount → cleanup → mount once in dev: the
    // first (discarded) mount's request is superseded before it resolves.
    // If it later resolves anyway, its data must never overwrite the
    // second (real) mount's own response.
    const { StrictMode } = await import("react");
    let resolveFirst: (value: Response) => void = () => {};
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount += 1;
      if (callCount === 1) return new Promise((resolve) => { resolveFirst = resolve; });
      return jsonResponse({ entries: [ENTRY_2], userTeamRank: null });
    }) as unknown as typeof fetch;
    render(
      <StrictMode>
        <TeamLeaderboardsPage />
      </StrictMode>
    );
    await flush();
    expect(screen.getByText("Beta Crew")).toBeTruthy();

    act(() => {
      resolveFirst({ ok: true, status: 200, json: () => Promise.resolve({ entries: [ENTRY_1], userTeamRank: null }) } as Response);
    });
    await flush();
    expect(screen.queryByText("Alpha Squad")).toBeNull();
    expect(screen.getByText("Beta Crew")).toBeTruthy();
  });

  it("11. AbortError is silent (no error panel)", async () => {
    authenticate();
    global.fetch = jest.fn(() => {
      const err = new DOMException("aborted", "AbortError");
      return Promise.reject(err);
    }) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByText("We couldn’t load team rankings")).toBeNull();
  });

  it("12. a genuine failure shows the recoverable error panel", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("We couldn’t load team rankings")).toBeTruthy();
  });

  it("13. the technical thrown message is not exposed", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("ECONNREFUSED at 10.0.0.1"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
  });

  it("14. API 401 redirects to sign-in", async () => {
    authenticate();
    global.fetch = jest.fn(() => jsonResponse({ error: "Unauthorized" }, false, 401)) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(mockReplace).toHaveBeenCalledWith("/auth/signin");
  });

  it("15. API 401 does not show the retry panel", async () => {
    authenticate();
    global.fetch = jest.fn(() => jsonResponse({ error: "Unauthorized" }, false, 401)) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("16. success replaces the loading skeleton", async () => {
    authenticate();
    mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByTestId("team-leaderboard-loading")).toBeNull();
  });

  it("17. failure removes the loading skeleton", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByTestId("team-leaderboard-loading")).toBeNull();
  });

  it("18. no post-unmount update warning", async () => {
    authenticate();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    const { unmount } = render(<TeamLeaderboardsPage />);
    unmount();
    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ entries: [], userTeamRank: null }) } as Response);
      await Promise.resolve();
    });
    const badUpdateWarning = errorSpy.mock.calls.some((args) => String(args[0]).includes("not wrapped in act"));
    expect(badUpdateWarning).toBe(false);
    errorSpy.mockRestore();
  });
});

describe("Team Leaderboards page — retry", () => {
  it("19. error panel heading is exact", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("We couldn’t load team rankings")).toBeTruthy();
  });

  it("20. support copy is exact", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
  });

  it("21. Try Again is visible", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("22. rapid retry activation creates one request", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();

    let resolveRetry: (value: Response) => void = () => {};
    const retryFetch = jest.fn(() => new Promise<Response>((resolve) => { resolveRetry = resolve; }));
    global.fetch = retryFetch as unknown as typeof fetch;

    const button = screen.getByRole("button", { name: "Try Again" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await flush();
    expect(retryFetch).toHaveBeenCalledTimes(1);

    act(() => {
      resolveRetry({ ok: true, status: 200, json: () => Promise.resolve({ entries: [], userTeamRank: null }) } as Response);
    });
    await flush();
  });

  it("23. pending button displays 'Trying…'", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();

    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(screen.getByRole("button", { name: "Trying…" })).toBeTruthy();
  });

  it("24. pending button is disabled", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();

    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect((screen.getByRole("button", { name: "Trying…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("25. successful retry renders content", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();

    mockFetch();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(screen.getByText("Alpha Squad")).toBeTruthy();
  });

  it("26. failed retry restores Try Again", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();

    global.fetch = jest.fn(() => Promise.reject(new Error("fail again"))) as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("27. retry guard resets after failure (a second retry attempt fires)", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();

    const secondFetch = jest.fn(() => Promise.reject(new Error("fail again")));
    global.fetch = secondFetch as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();

    const thirdFetch = jest.fn(() => jsonResponse({ entries: [], userTeamRank: null }));
    global.fetch = thirdFetch as unknown as typeof fetch;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(thirdFetch).toHaveBeenCalledTimes(1);
  });

  it("28. retry does not navigate or reload", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    mockFetch();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("Team Leaderboards page — mapping and integrity", () => {
  it("29-30. API order is preserved with no client sorting", async () => {
    authenticate();
    mockFetch([ENTRY_2, ENTRY_1, ENTRY_4]);
    const { container } = render(<TeamLeaderboardsPage />);
    await flush();
    const list = container.querySelector('[data-testid="team-leaderboard-list"]')!;
    const names = Array.from(list.querySelectorAll("li")).map((li) => (li.textContent ?? "").includes("Beta Crew") ? "Beta Crew" : (li.textContent ?? "").includes("Alpha Squad") ? "Alpha Squad" : "My Team");
    expect(names[0]).toBe("Beta Crew");
  });

  it("31. server rank remains unchanged", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("32. server points remain unchanged", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("5,000").length).toBeGreaterThan(0);
  });

  it("33. server puzzle totals remain unchanged", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText(/200 puzzles solved/).length).toBeGreaterThan(0);
  });

  it("34. server member count remains unchanged", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText(/10 members/).length).toBeGreaterThan(0);
  });

  it("35. current team is identified by team ID", async () => {
    authenticate();
    mockFetch([ENTRY_1, ENTRY_4], ENTRY_4);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("Your team").length).toBeGreaterThan(0);
  });

  it("36. current team is not duplicated in the list", async () => {
    authenticate();
    mockFetch([ENTRY_1, ENTRY_4], ENTRY_4);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("My Team").length).toBe(2); // rank summary + list row
  });

  it("37. every entry renders once", async () => {
    authenticate();
    mockFetch([ENTRY_1, ENTRY_2, ENTRY_4]);
    const { container } = render(<TeamLeaderboardsPage />);
    await flush();
    const list = container.querySelector('[data-testid="team-leaderboard-list"]')!;
    expect(list.querySelectorAll("li").length).toBe(3);
  });

  it("38. null name reaches the Unnamed Team fallback", async () => {
    authenticate();
    mockFetch([{ ...ENTRY_1, teamName: null }]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Unnamed Team")).toBeTruthy();
  });

  it("39. public/private values remain unchanged", async () => {
    authenticate();
    mockFetch([ENTRY_1, ENTRY_2]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("Public").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Private").length).toBeGreaterThan(0);
  });

  it("40. banner values are not written into arbitrary CSS", async () => {
    authenticate();
    mockFetch([{ ...ENTRY_1, bannerColor: "<script>alert(1)</script>" }]);
    const { container } = render(<TeamLeaderboardsPage />);
    await flush();
    expect(container.innerHTML).not.toContain("<script>alert(1)</script>");
  });

  it("41. no additional API request is introduced", async () => {
    authenticate();
    const { calls } = mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    const uniquePaths = new Set(calls.map((c) => c.split("?")[0]));
    expect(uniquePaths.size).toBe(1);
  });

  it("42. no write request is introduced", async () => {
    authenticate();
    const { fetchMock } = mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    fetchMock.mock.calls.forEach(([, init]) => {
      expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
    });
  });
});

describe("Team Leaderboards page — page states", () => {
  it("43. header remains during loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    render(<TeamLeaderboardsPage />);
    expect(screen.getByText("Team Leaderboards")).toBeTruthy();
  });

  it("44. header remains during error", async () => {
    authenticate();
    global.fetch = jest.fn(() => Promise.reject(new Error("fail"))) as unknown as typeof fetch;
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Team Leaderboards")).toBeTruthy();
  });

  it("45. header remains during ready", async () => {
    authenticate();
    mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Team Leaderboards")).toBeTruthy();
  });

  it("46. Back to Leaderboards route is exact", async () => {
    authenticate();
    mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByRole("link", { name: /Back to Leaderboards/ }).getAttribute("href")).toBe("/leaderboards");
  });

  it("47. Explore Teams route is exact", async () => {
    authenticate();
    mockFetch();
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByRole("link", { name: /Explore Teams/ })[0]?.getAttribute("href")).toBe("/teams");
  });

  it("48. ranked current-team summary renders", async () => {
    authenticate();
    mockFetch([ENTRY_1, ENTRY_4], ENTRY_4);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Your Team Rank")).toBeTruthy();
    expect(screen.getByTestId("team-rank-summary").textContent).toContain("#4");
  });

  it("49. null userTeamRank renders Not ranked", async () => {
    authenticate();
    mockFetch([ENTRY_1], null);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Not ranked")).toBeTruthy();
  });

  it("50. non-empty response renders the list", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByTestId("team-leaderboard-list")).toBeTruthy();
  });

  it("51. non-empty response renders stats", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByTestId("team-leaderboard-stats")).toBeTruthy();
  });

  it("52. empty response renders the empty state", async () => {
    authenticate();
    mockFetch([], null);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("No ranked teams yet")).toBeTruthy();
  });

  it("53. empty response suppresses the list", async () => {
    authenticate();
    mockFetch([], null);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByTestId("team-leaderboard-list")).toBeNull();
  });

  it("54. empty response suppresses stats", async () => {
    authenticate();
    mockFetch([], null);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.queryByTestId("team-leaderboard-stats")).toBeNull();
  });

  it("55. empty state keeps the rank summary visible", async () => {
    authenticate();
    mockFetch([], null);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getByText("Your Team Rank")).toBeTruthy();
  });

  it("56. rank summary appears exactly once", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("Your Team Rank").length).toBe(1);
  });

  it("57. stats appear exactly once", async () => {
    authenticate();
    mockFetch([ENTRY_1]);
    render(<TeamLeaderboardsPage />);
    await flush();
    expect(screen.getAllByTestId("team-leaderboard-stats").length).toBe(1);
  });

  it("58. legacy TeamLeaderboardRow inline function is gone", () => {
    expect(SOURCE.includes("function TeamLeaderboardRow")).toBe(false);
  });

  it("59. legacy RANK_STYLE is gone", () => {
    expect(SOURCE.includes("RANK_STYLE")).toBe(false);
  });

  it("60. legacy getMedalEmoji is gone", () => {
    expect(SOURCE.includes("getMedalEmoji")).toBe(false);
  });

  it("61. legacy BANNER_HEX is gone", () => {
    expect(SOURCE.includes("BANNER_HEX")).toBe(false);
  });

  it("62. legacy trophy heading emoji is gone", () => {
    expect(SOURCE.includes("🏆")).toBe(false);
  });

  it("63. page uses PageContainer", () => {
    expect(SOURCE.includes("PageContainer")).toBe(true);
  });

  it("64. page uses a semantic background", () => {
    expect(SOURCE.includes("var(--pw-bg-base)")).toBe(true);
  });

  it("65. page contains no raw hex or RGBA colors", () => {
    expect(RAW_HEX.test(SOURCE)).toBe(false);
    expect(RAW_RGB.test(SOURCE)).toBe(false);
  });
});
