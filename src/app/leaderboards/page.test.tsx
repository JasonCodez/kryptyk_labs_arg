/** @jest-environment jsdom */
import { act, render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import LeaderboardsPage, { formatCountdown, getCountdownUrgency } from "./page";

const mockUseSession = jest.fn();
const mockPush = jest.fn();
const stableRouter = { push: mockPush };
jest.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));
jest.mock("next/navigation", () => ({ useRouter: () => stableRouter }));
jest.mock("@/hooks/useAppReducedMotion", () => ({ useAppReducedMotion: () => true }));
jest.mock("framer-motion", () => ({
  motion: {
    header: ({ initial: _i, animate: _a, transition: _t, ...props }: any) => <header {...props} />,
    section: ({ initial: _i, animate: _a, transition: _t, ...props }: any) => <section {...props} />,
  },
}));

const introCardCalls: Array<{ userId: string }> = [];
jest.mock("@/components/onboarding/LeaderboardIntroCard", () => ({
  __esModule: true,
  default: (props: { userId: string }) => {
    introCardCalls.push(props);
    return <div data-testid="intro-card">{props.userId}</div>;
  },
}));

const GLOBAL_ENTRY = {
  userId: "u1", userName: "Alice", userImage: null, activeFlair: "none",
  isPremium: false, totalPoints: 500, puzzlesSolved: 10, rank: 1,
};
const GLOBAL_RANK = {
  userId: "me", userName: "Me", userImage: null, activeFlair: "none",
  isPremium: false, totalPoints: 200, puzzlesSolved: 4, rank: 12,
};
const PERIOD_ENTRY = {
  userId: "u1", userName: "Alice", userImage: null, activeFlair: "none",
  isPremium: false, periodPoints: 100, puzzlesSolved: 3, rank: 1,
};
const PERIOD_RANK = {
  userId: "me", userName: "Me", userImage: null, activeFlair: "none",
  isPremium: false, periodPoints: 40, puzzlesSolved: 2, rank: 30,
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

function authenticate() {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me", email: "me@example.test" } } });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockPush.mockReset();
  introCardCalls.length = 0;
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("Leaderboards page — authentication", () => {
  it("renders the loading state while the session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    render(<LeaderboardsPage />);
    expect(screen.getByRole("status").textContent).toContain("Loading leaderboard");
  });

  it("redirects unauthenticated sessions to /auth/signin", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    render(<LeaderboardsPage />);
    expect(mockPush).toHaveBeenCalledWith("/auth/signin");
  });

  it("fires no leaderboard request while unauthenticated", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads Global once authenticated", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: GLOBAL_RANK }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/leaderboards/global", expect.anything());
  });
});

describe("Leaderboards page — endpoint selection", () => {
  it("Global calls /api/leaderboards/global", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leaderboards/global");
  });

  it("Weekly calls /api/leaderboards/period?type=weekly", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/leaderboards/period?type=weekly");
  });

  it("Monthly calls /api/leaderboards/period?type=monthly", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Monthly/ }));
    await flush();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/leaderboards/period?type=monthly");
  });

  it("Following calls /api/leaderboards/following", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, followingCount: 0 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/leaderboards/following");
  });

  it("clicking the already-active tab does not refetch", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    const callsAfterLoad = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("tab", { name: /Global/ }));
    await flush();
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
  });

  it("one tab click creates exactly one request", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, followingCount: 0 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });
});

describe("Leaderboards page — response mapping", () => {
  it("maps Global entries without reordering", async () => {
    authenticate();
    const entries = [GLOBAL_ENTRY, { ...GLOBAL_ENTRY, userId: "u2", userName: "Bob", rank: 2 }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("maps Global user rank to the rank summary", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: GLOBAL_RANK })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("#12")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
  });

  it("maps followingCount exactly", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, followingCount: 7 })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Following 7 players")).toBeTruthy();
  });

  it("maps Weekly period points correctly", async () => {
    authenticate();
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) {
        return jsonResponse({ entries: [PERIOD_ENTRY], userRank: PERIOD_RANK, endsAt: null, rewardTiers: [] });
      }
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("#30")).toBeTruthy();
  });

  it("maps Weekly endsAt to the countdown", async () => {
    authenticate();
    const endsAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt, rewardTiers: [] })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("Time Remaining")).toBeTruthy();
  });

  it("keeps reward tiers exactly as server-supplied", async () => {
    authenticate();
    const rewardTiers = [{ rank: 1, points: 500, xp: 100 }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("500 pts")).toBeTruthy();
    expect(screen.getByText("+100 XP")).toBeTruthy();
  });

  it("renders the unranked summary when userRank is null", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("Unranked")).toBeTruthy();
  });
});

describe("Leaderboards page — stale request lifecycle", () => {
  it("ignores a late Global response after switching to Weekly", async () => {
    authenticate();
    let resolveGlobal!: (v: unknown) => void;
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/leaderboards/global") {
        return new Promise((resolve) => { resolveGlobal = resolve; });
      }
      return jsonResponse({ entries: [PERIOD_ENTRY], userRank: PERIOD_RANK, endsAt: null, rewardTiers: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("Alice")).toBeTruthy();

    await act(async () => {
      resolveGlobal({ ok: true, json: () => Promise.resolve({ entries: [GLOBAL_ENTRY], userRank: GLOBAL_RANK }) });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Weekly content must still be shown; the tab must not have flipped back.
    expect(screen.getByRole("tab", { name: /Weekly/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("does not show an error for an aborted request", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string, opts?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
      opts?.signal?.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Leaderboards page — errors and retry", () => {
  it("shows the error panel when the initial request fails", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({}, false)) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("We couldn’t load this leaderboard")).toBeTruthy();
  });

  it("retry calls the active tab's endpoint again and clears the error on success", async () => {
    authenticate();
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount += 1;
      if (callCount === 1) return jsonResponse({}, false);
      return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(callCount).toBe(2);
  });
});

describe("Leaderboards page — background refresh", () => {
  it("refreshes the active tab on puzzlewarz:puzzle-solved without clearing content", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      return jsonResponse({ entries: [{ ...GLOBAL_ENTRY, userName: "Alice-Updated" }], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("Alice")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Alice-Updated")).toBeTruthy();
    // The full-page loading skeleton must not have replaced the ready content.
    expect(screen.queryByText("Loading leaderboard")).toBeNull();
  });

  it("shows the refresh warning on background failure and keeps existing content", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      return jsonResponse({}, false);
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Couldn.t refresh just now/)).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the refresh warning after the next successful refresh", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      if (call === 2) return jsonResponse({}, false);
      return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Couldn.t refresh just now/)).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText(/Couldn.t refresh just now/)).toBeNull();
  });

  it("does not respond to unrelated browser events", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    const before = fetchMock.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("some:other-event"));
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});

describe("Leaderboards page — empty states", () => {
  it("shows the Following empty state when followingCount is 0", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, followingCount: 0 })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Build your comparison group")).toBeTruthy();
  });

  it("the Following empty-state action switches to Global and fires one Global request", async () => {
    authenticate();
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") return jsonResponse({ entries: [], userRank: null, followingCount: 0 });
      return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    const globalCallsBefore = fetchMock.mock.calls.filter((c) => c[0] === "/api/leaderboards/global").length;
    fireEvent.click(screen.getByRole("button", { name: /Browse Global Leaderboard/i }));
    await flush();
    const globalCallsAfter = fetchMock.mock.calls.filter((c) => c[0] === "/api/leaderboards/global").length;
    expect(globalCallsAfter).toBe(globalCallsBefore + 1);
    expect(screen.getByRole("tab", { name: /Global/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows the Global empty state when entries are empty", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("No ranked players yet")).toBeTruthy();
  });

  it("shows the Weekly empty state and keeps period context visible", async () => {
    authenticate();
    const endsAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const rewardTiers = [{ rank: 1, points: 500, xp: 100 }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt, rewardTiers })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("No weekly activity yet")).toBeTruthy();
    expect(screen.getByText("Time Remaining")).toBeTruthy();
    expect(screen.getByText("500 pts")).toBeTruthy();
  });
});

describe("Leaderboards page — existing behavior preserved", () => {
  it("passes the onboarding user id to LeaderboardIntroCard", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(introCardCalls.at(-1)?.userId).toBe("me");
  });

  it("existing profile route remains /profile/[userId]", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByRole("link", { name: /Alice/ }).getAttribute("href")).toBe("/profile/u1");
  });

  it("does not fire an extra /api/user/info request", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/user/info"))).toBe(false);
  });
});

describe("formatCountdown / getCountdownUrgency", () => {
  it("formats valid, expired, and invalid schedules safely", () => {
    const now = Date.parse("2026-07-23T00:00:00Z");
    expect(formatCountdown("2026-07-25T04:00:00Z", now)).toBe("2d 4h remaining");
    expect(formatCountdown("2026-07-22T00:00:00Z", now)).toBe("Ended");
    expect(formatCountdown("invalid", now)).toBe("Schedule unavailable");
  });

  it("classifies countdown urgency", () => {
    const now = Date.parse("2026-07-23T00:00:00Z");
    expect(getCountdownUrgency(new Date(now + 72 * 3600_000).toISOString(), now)).toBe("normal");
    expect(getCountdownUrgency(new Date(now + 24 * 3600_000).toISOString(), now)).toBe("warning");
    expect(getCountdownUrgency(new Date(now + 3 * 3600_000).toISOString(), now)).toBe("critical");
  });
});
