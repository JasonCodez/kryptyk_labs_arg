/** @jest-environment jsdom */
import { StrictMode } from "react";
import { act, render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import LeaderboardsPage, {
  formatCountdown,
  getCountdownUrgency,
  normalizeFollowingLeaderboardEntry,
  normalizeFollowingLeaderboardPayload,
  type FollowingLeaderboardEntry,
} from "./page";

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
// The real Following API always includes the current user in `entries`, even
// when followingCount is 0 — a bare `entries: []` fixture would hide the bug
// where the page renders that row/footer stats beneath its own empty panel.
const FOLLOWING_SELF_ENTRY = {
  userId: "me", userName: "Me", userImage: null, activeFlair: "none",
  isPremium: false, totalPoints: 200, puzzlesSolved: 4, rank: 1, isCurrentUser: true,
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
    expect(screen.getByText("500 Points")).toBeTruthy();
    expect(screen.getByText("100 XP")).toBeTruthy();
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
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Build your comparison group")).toBeTruthy();
  });

  it("the Following empty-state action switches to Global and fires one Global request", async () => {
    authenticate();
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") return jsonResponse({
        entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
      });
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
    expect(screen.getByText("500 Points")).toBeTruthy();
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

describe("Leaderboards page — React Strict Mode and unmount lifecycle", () => {
  it("still applies a successful Global response after a Strict Mode setup/cleanup/setup replay", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: GLOBAL_RANK })) as unknown as typeof fetch;
    render(
      <StrictMode>
        <LeaderboardsPage />
      </StrictMode>
    );
    await flush();
    // A cleanup-only mounted-state bug would leave mountedRef permanently
    // false after Strict Mode's synchronous mount→cleanup→mount replay,
    // silently discarding this (entirely valid) response forever.
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Loading leaderboard")).toBeNull();
  });

  it("aborts the in-flight foreground request on genuine unmount", async () => {
    authenticate();
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_url: string, opts?: { signal?: AbortSignal }) => {
      capturedSignal = opts?.signal;
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    const { unmount } = render(<LeaderboardsPage />);
    await flush();
    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("aborts an in-flight background request on genuine unmount", async () => {
    authenticate();
    let backgroundSignal: AbortSignal | undefined;
    let call = 0;
    global.fetch = jest.fn((_url: string, opts?: { signal?: AbortSignal }) => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      backgroundSignal = opts?.signal;
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    const { unmount } = render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });
    expect(backgroundSignal?.aborted).toBe(false);
    unmount();
    expect(backgroundSignal?.aborted).toBe(true);
  });
});

describe("Leaderboards page — foreground/background isolation", () => {
  it("a puzzle-solved event during initial loading creates no second request", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => new Promise(() => {}));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    const before = fetchMock.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it("a puzzle-solved event during tab foreground loading creates no background request", async () => {
    authenticate();
    let weeklyCalls = 0;
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/leaderboards/global") return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      weeklyCalls += 1;
      return new Promise(() => {});
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(weeklyCalls).toBe(1);
    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });
    // Still exactly one Weekly request — the event must not have added a
    // background refresh while the Weekly foreground load is in flight.
    expect(weeklyCalls).toBe(1);
  });

  it("switching tabs while a background refresh is held still reaches the new tab (background never blocks or aborts foreground)", async () => {
    authenticate();
    let globalCalls = 0;
    let weeklyCalls = 0;
    let releaseBackgroundGlobal: (() => void) | null = null;
    const fetchMock = jest.fn((url: string) => {
      if (url === "/api/leaderboards/global") {
        globalCalls += 1;
        if (globalCalls === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
        return new Promise((resolve) => {
          releaseBackgroundGlobal = () => resolve({ ok: true, json: () => Promise.resolve({ entries: [GLOBAL_ENTRY], userRank: null }) });
        });
      }
      weeklyCalls += 1;
      return jsonResponse({ entries: [PERIOD_ENTRY], userRank: PERIOD_RANK, endsAt: null, rewardTiers: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });
    expect(globalCalls).toBe(2); // held, in flight

    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(weeklyCalls).toBe(1);
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Loading leaderboard")).toBeNull();

    if (releaseBackgroundGlobal) act(() => releaseBackgroundGlobal!());
  });

  it("a background failure during ready state preserves content and never reverts to loading", async () => {
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

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Loading leaderboard")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Couldn.t refresh just now/)).toBeTruthy();
  });

  it("duplicate puzzle-solved events while a background refresh is in flight create exactly one request", async () => {
    authenticate();
    let call = 0;
    const fetchMock = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      return new Promise(() => {});
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.length).toBe(2); // one initial load + exactly one background refresh
  });
});

describe("Leaderboards page — retry guard", () => {
  it("rapid retry activation creates exactly one retry request", async () => {
    authenticate();
    let call = 0;
    let releaseRetry: (() => void) | null = null;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({}, false);
      return new Promise((resolve) => {
        releaseRetry = () => resolve({ ok: true, json: () => Promise.resolve({ entries: [GLOBAL_ENTRY], userRank: null }) });
      });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByRole("alert")).toBeTruthy();

    const retryButton = screen.getByRole("button", { name: /Try Again/i });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    await flush();

    expect(call).toBe(2); // initial failure + exactly one retry

    await act(async () => {
      releaseRetry?.();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("shows 'Trying…' on the retry button while a retry is pending", async () => {
    authenticate();
    let call = 0;
    let releaseRetry: (() => void) | null = null;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({}, false);
      return new Promise((resolve) => {
        releaseRetry = () => resolve({ ok: true, json: () => Promise.resolve({ entries: [GLOBAL_ENTRY], userRank: null }) });
      });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    await flush();
    expect(screen.getByRole("button", { name: /Trying…/i })).toBeTruthy();

    await act(async () => {
      releaseRetry?.();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("the retry guard resets after a failed retry, allowing another attempt", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call <= 2) return jsonResponse({}, false);
      return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    await flush();
    expect(screen.getByRole("alert")).toBeTruthy(); // still failing

    fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    await flush();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(call).toBe(3);
  });

  it("a successful retry renders real content", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({}, false);
      return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    await flush();
    expect(screen.getByText("Alice")).toBeTruthy();
  });
});

describe("Leaderboards page — countdown minute updates", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("updates the countdown text after a 60-second fake-timer advance", async () => {
    authenticate();
    const endsAt = new Date(Date.now() + 2 * 3600_000 + 500).toISOString();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt, rewardTiers: [] })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const before = formatCountdown(endsAt);
    expect(screen.getByText(before)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.queryByText(before)).toBeNull();
  });

  it("does not update the countdown every second", async () => {
    authenticate();
    const endsAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt, rewardTiers: [] })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const before = formatCountdown(endsAt);
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByText(before)).toBeTruthy();
  });

  it("clears the countdown interval when the active tab changes away", async () => {
    authenticate();
    const endsAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const clearSpy = jest.spyOn(window, "clearInterval");
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt, rewardTiers: [] })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    clearSpy.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: /Global/ }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(clearSpy).toHaveBeenCalled();
  });

  it("clears the countdown interval on unmount", async () => {
    authenticate();
    const endsAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const clearSpy = jest.spyOn(window, "clearInterval");
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt, rewardTiers: [] })) as unknown as typeof fetch;
    const { unmount } = render(<LeaderboardsPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    clearSpy.mockClear();
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("Global creates no countdown interval", async () => {
    authenticate();
    const setSpy = jest.spyOn(window, "setInterval");
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe("Leaderboards page — invalid period schedule", () => {
  it("shows 'Schedule unavailable' for an invalid endsAt", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt: "not-a-date", rewardTiers: [] })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("Schedule unavailable")).toBeTruthy();
  });

  it("never shows 'Invalid Date' for an invalid endsAt", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null, endsAt: "not-a-date", rewardTiers: [] })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });
});

describe("Leaderboards page — production-shaped Following empty state", () => {
  it("shows the empty panel even though the API returns a current-user entry", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Build your comparison group")).toBeTruthy();
  });

  it("suppresses the current-user-only leaderboard row", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.queryByRole("link", { name: "Me" })).toBeNull();
  });

  it("suppresses footer statistics", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.queryByText("Top Players")).toBeNull();
    expect(screen.queryByText("Total Points")).toBeNull();
  });

  it("the rank summary may still show the current user's API-provided rank", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Your Following Rank")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
  });

  it("renders Following entries normally once followingCount is greater than 0", async () => {
    authenticate();
    const entries = [FOLLOWING_SELF_ENTRY, { ...GLOBAL_ENTRY, userId: "u9", userName: "Zed", rank: 2, isCurrentUser: false }];
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries, userRank: FOLLOWING_SELF_ENTRY, followingCount: 1,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.queryByText("Build your comparison group")).toBeNull();
    expect(screen.getByText("Zed")).toBeTruthy();
    expect(screen.getByText("Top Players")).toBeTruthy();
  });
});

describe("Leaderboards page — background aria-busy", () => {
  it("marks the tabpanel aria-busy=true during a background refresh", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });

    expect(screen.getByRole("tabpanel").getAttribute("aria-busy")).toBe("true");
  });

  it("keeps ready content mounted while a background refresh is in flight", async () => {
    authenticate();
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call === 1) return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
    });

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Loading leaderboard")).toBeNull();
  });
});

describe("Leaderboards page — Pass 14 rankings integration", () => {
  it("maps totalPoints to display points for Global", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    // 500 appears both on the featured row and (coincidentally, single entry)
    // the stats "Total Points" card — either is proof the mapping happened.
    expect(screen.getAllByText("500").length).toBeGreaterThanOrEqual(1);
  });

  it("maps periodPoints to display points for Weekly", async () => {
    authenticate();
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) return jsonResponse({ entries: [PERIOD_ENTRY], userRank: null, endsAt: null, rewardTiers: [] });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("preserves Global API entry order", async () => {
    authenticate();
    const entries = [
      { ...GLOBAL_ENTRY, userId: "u2", userName: "Bob", rank: 4 },
      { ...GLOBAL_ENTRY, userId: "u1", userName: "Alice", rank: 5 },
    ];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    const names = screen.getAllByText(/^(Bob|Alice)$/).map((el) => el.textContent);
    expect(names).toEqual(["Bob", "Alice"]);
  });

  it("preserves Period API entry order", async () => {
    authenticate();
    const entries = [
      { ...PERIOD_ENTRY, userId: "u2", userName: "Bob", rank: 4 },
      { ...PERIOD_ENTRY, userId: "u1", userName: "Alice", rank: 5 },
    ];
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) return jsonResponse({ entries, userRank: null, endsAt: null, rewardTiers: [] });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    const names = screen.getAllByText(/^(Bob|Alice)$/).map((el) => el.textContent);
    expect(names).toEqual(["Bob", "Alice"]);
  });

  it("determines current user by user ID", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [{ ...GLOBAL_ENTRY, userId: "me", userName: "Me", rank: 4 }], userRank: null,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("honors API isCurrentUser as well", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [{ ...GLOBAL_ENTRY, userId: "some-other-id", userName: "Weird", rank: 4, isCurrentUser: true }], userRank: null,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("Global top-three presentation appears", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("Top competitors")).toBeTruthy();
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("Global rank 4 uses the standard row", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [{ ...GLOBAL_ENTRY, rank: 4 }], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.queryByText("Top competitors")).toBeNull();
  });

  it("every Global entry renders once", async () => {
    authenticate();
    const entries = [
      { ...GLOBAL_ENTRY, userId: "u1", userName: "First", rank: 1 },
      { ...GLOBAL_ENTRY, userId: "u2", userName: "Fourth", rank: 4 },
    ];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("First").length).toBe(1);
    expect(screen.getAllByText("Fourth").length).toBe(1);
  });

  it("Weekly top-three presentation appears", async () => {
    authenticate();
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) return jsonResponse({ entries: [PERIOD_ENTRY], userRank: null, endsAt: null, rewardTiers: [] });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("Top competitors")).toBeTruthy();
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("Weekly reward tiers render exact values", async () => {
    authenticate();
    const rewardTiers = [{ rank: 1, points: 750, xp: 150 }];
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) return jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("750 Points")).toBeTruthy();
    expect(screen.getByText("150 XP")).toBeTruthy();
  });

  it("Monthly reward tiers render exact values", async () => {
    authenticate();
    const rewardTiers = [{ rank: 2, points: 300, xp: 60 }];
    global.fetch = jest.fn((url: string) => {
      if (url.includes("monthly")) return jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers });
      return jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers: [] });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Monthly/ }));
    await flush();
    expect(screen.getByText("300 Points")).toBeTruthy();
    expect(screen.getByText("60 XP")).toBeTruthy();
  });

  it("reward tiers preserve API order", async () => {
    authenticate();
    const rewardTiers = [{ rank: 3, points: 100, xp: 20 }, { rank: 1, points: 500, xp: 100 }];
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) return jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    const labels = screen.getAllByText(/Place$/).map((el) => el.textContent);
    expect(labels).toEqual(["3rd Place", "1st Place"]);
  });

  it("Global statistics use exact existing totals", async () => {
    authenticate();
    const entries = [{ ...GLOBAL_ENTRY, userId: "u1", totalPoints: 500 }, { ...GLOBAL_ENTRY, userId: "u2", totalPoints: 300, rank: 2 }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("Total Points")).toBeTruthy();
    expect(screen.getByText("800")).toBeTruthy();
  });

  it("Following statistics use exact returned entries", async () => {
    authenticate();
    const entries = [FOLLOWING_SELF_ENTRY, { ...GLOBAL_ENTRY, userId: "u9", userName: "Zed", rank: 2, isCurrentUser: false }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: FOLLOWING_SELF_ENTRY, followingCount: 1 })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Top Players")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("Following count zero still suppresses the list", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.queryByText("Rankings")).toBeNull();
    expect(screen.queryByText("Top competitors")).toBeNull();
  });

  it("Following count zero still suppresses statistics", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({
      entries: [FOLLOWING_SELF_ENTRY], userRank: FOLLOWING_SELF_ENTRY, followingCount: 0,
    })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.queryByText("Top Players")).toBeNull();
  });

  it("Following count greater than zero renders the list", async () => {
    authenticate();
    const entries = [FOLLOWING_SELF_ENTRY, { ...GLOBAL_ENTRY, userId: "u9", userName: "Zed", rank: 2, isCurrentUser: false }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: FOLLOWING_SELF_ENTRY, followingCount: 1 })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Zed")).toBeTruthy();
  });

  it("Following count greater than zero renders statistics", async () => {
    authenticate();
    const entries = [FOLLOWING_SELF_ENTRY, { ...GLOBAL_ENTRY, userId: "u9", userName: "Zed", rank: 2, isCurrentUser: false }];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: FOLLOWING_SELF_ENTRY, followingCount: 1 })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Top Players")).toBeTruthy();
  });

  it("Global empty state still suppresses list and stats", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("No ranked players yet")).toBeTruthy();
    expect(screen.queryByText("Top Players")).toBeNull();
    expect(screen.queryByText("Rankings")).toBeNull();
  });

  it("Period empty state still keeps reward tiers", async () => {
    authenticate();
    const rewardTiers = [{ rank: 1, points: 500, xp: 100 }];
    global.fetch = jest.fn((url: string) => {
      if (url.startsWith("/api/leaderboards/period")) return jsonResponse({ entries: [], userRank: null, endsAt: null, rewardTiers });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    await flush();
    expect(screen.getByText("No weekly activity yet")).toBeTruthy();
    expect(screen.getByText("500 Points")).toBeTruthy();
  });

  it("preserves exact profile routes", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [{ ...GLOBAL_ENTRY, userId: "abc123", rank: 4 }], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByRole("link", { name: /Alice/ }).getAttribute("href")).toBe("/profile/abc123");
  });

  it("Premium badge reflects the API value", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [{ ...GLOBAL_ENTRY, isPremium: true, rank: 4 }], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("Premium")).toBeTruthy();
  });

  it("Flair reflects the API value", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [{ ...GLOBAL_ENTRY, activeFlair: "⭐ Star", rank: 4 }], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getByText("⭐ Star")).toBeTruthy();
  });

  it("introduces no additional API request", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it("introduces no write request", async () => {
    authenticate();
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      expect(init?.method ?? "GET").toBe("GET");
      return jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
  });

  it("does not sort client-side — server order is preserved regardless of rank ordering", async () => {
    authenticate();
    const entries = [
      { ...GLOBAL_ENTRY, userId: "u5", userName: "OutOfOrderFirst", rank: 5 },
      { ...GLOBAL_ENTRY, userId: "u1", userName: "OutOfOrderTop", rank: 1 },
    ];
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries, userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    // Top-three section shows the rank-1 entry regardless of its array position.
    expect(screen.getByText("OutOfOrderTop")).toBeTruthy();
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("rank summary remains present exactly once", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: GLOBAL_RANK })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.getAllByText("Your Global Rank").length).toBe(1);
  });

  it("legacy 'All-Time Leaderboard' heading remains absent", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null })) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    expect(screen.queryByText(/All-Time Leaderboard/i)).toBeNull();
  });

  it("legacy medal emoji is absent from page-owned presentation", async () => {
    authenticate();
    global.fetch = jest.fn((_url: string) => jsonResponse({ entries: [GLOBAL_ENTRY], userRank: null })) as unknown as typeof fetch;
    const { container } = render(<LeaderboardsPage />);
    await flush();
    expect(/🥇|🥈|🥉/.test(container.textContent ?? "")).toBe(false);
  });

  it("legacy inline LeaderboardRow function no longer exists in page.tsx source", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/function LeaderboardRow\(/);
    expect(source).not.toMatch(/RANK_STYLE/);
    expect(source).not.toMatch(/getMedalEmoji/);
  });

  it("legacy inline RewardTiers function no longer exists in page.tsx source", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/function RewardTiers\(/);
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

// ── Following leaderboard payload normalization (Pass 25C4) ────────────────

const FOLLOWING_VALID_ENTRY: FollowingLeaderboardEntry = {
  userId: "player-2",
  userName: "Alpha Player",
  userImage: null,
  activeFlair: "none",
  isPremium: false,
  totalPoints: 250,
  puzzlesSolved: 5,
  rank: 1,
  isCurrentUser: false,
};

const FOLLOWING_VALID_PAYLOAD = {
  entries: [FOLLOWING_VALID_ENTRY],
  userRank: null,
  followingCount: 1,
};

describe("normalizeFollowingLeaderboardEntry", () => {
  test("non-object value returns null", () => {
    expect(normalizeFollowingLeaderboardEntry("nope")).toBeNull();
    expect(normalizeFollowingLeaderboardEntry(null)).toBeNull();
    expect(normalizeFollowingLeaderboardEntry([FOLLOWING_VALID_ENTRY])).toBeNull();
  });

  test("valid entry normalizes correctly", () => {
    expect(normalizeFollowingLeaderboardEntry(FOLLOWING_VALID_ENTRY)).toEqual(FOLLOWING_VALID_ENTRY);
  });

  test("blank userId is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, userId: "" })).toBeNull();
  });

  test("invalid userName is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, userName: 42 })).toBeNull();
  });

  test("invalid userImage is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, userImage: 42 })).toBeNull();
  });

  test("invalid activeFlair is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, activeFlair: null })).toBeNull();
  });

  test("non-boolean or missing isPremium defaults to false instead of dropping the row", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, isPremium: "yes" })).toEqual({
      ...FOLLOWING_VALID_ENTRY,
      isPremium: false,
    });
    const { isPremium: _omit, ...withoutFlag } = FOLLOWING_VALID_ENTRY;
    expect(normalizeFollowingLeaderboardEntry(withoutFlag)).toEqual({
      ...FOLLOWING_VALID_ENTRY,
      isPremium: false,
    });
  });

  test("invalid totalPoints is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, totalPoints: "10" })).toBeNull();
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, totalPoints: Infinity })).toBeNull();
  });

  test("invalid puzzlesSolved is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, puzzlesSolved: -1 })).toBeNull();
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, puzzlesSolved: 1.5 })).toBeNull();
  });

  test("invalid rank is dropped", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, rank: 0 })).toBeNull();
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, rank: 1.5 })).toBeNull();
  });

  test("non-boolean or missing isCurrentUser defaults to false instead of dropping the row", () => {
    expect(normalizeFollowingLeaderboardEntry({ ...FOLLOWING_VALID_ENTRY, isCurrentUser: 1 })).toEqual({
      ...FOLLOWING_VALID_ENTRY,
      isCurrentUser: false,
    });
    const { isCurrentUser: _omit, ...withoutFlag } = FOLLOWING_VALID_ENTRY;
    expect(normalizeFollowingLeaderboardEntry(withoutFlag)).toEqual({
      ...FOLLOWING_VALID_ENTRY,
      isCurrentUser: false,
    });
  });

  test("unknown private fields do not survive", () => {
    const contaminated = {
      ...FOLLOWING_VALID_ENTRY,
      email: "leaked.private@example.test",
      purchasedPoints: 999,
      role: "admin",
      isHidden: false,
      isBot: false,
    };
    const result = normalizeFollowingLeaderboardEntry(contaminated);
    expect(result).toEqual(FOLLOWING_VALID_ENTRY);
    expect(JSON.stringify(result)).not.toMatch(/private@example\.test|purchasedPoints|role|isHidden|isBot/);
  });
});

describe("normalizeFollowingLeaderboardPayload", () => {
  test("non-object top-level value returns null", () => {
    expect(normalizeFollowingLeaderboardPayload("nope")).toBeNull();
    expect(normalizeFollowingLeaderboardPayload(null)).toBeNull();
    expect(normalizeFollowingLeaderboardPayload(undefined)).toBeNull();
  });

  test("array top-level value returns null", () => {
    expect(normalizeFollowingLeaderboardPayload([FOLLOWING_VALID_PAYLOAD])).toBeNull();
  });

  test("missing or non-array entries returns null", () => {
    expect(normalizeFollowingLeaderboardPayload({ userRank: null, followingCount: 0 })).toBeNull();
    expect(normalizeFollowingLeaderboardPayload({ entries: "nope", userRank: null, followingCount: 0 })).toBeNull();
  });

  test("invalid following count returns null", () => {
    expect(normalizeFollowingLeaderboardPayload({ ...FOLLOWING_VALID_PAYLOAD, followingCount: "1" })).toBeNull();
  });

  test("negative following count returns null", () => {
    expect(normalizeFollowingLeaderboardPayload({ ...FOLLOWING_VALID_PAYLOAD, followingCount: -1 })).toBeNull();
  });

  test("non-integer following count returns null", () => {
    expect(normalizeFollowingLeaderboardPayload({ ...FOLLOWING_VALID_PAYLOAD, followingCount: 1.5 })).toBeNull();
  });

  test("invalid non-null userRank rejects the entire payload", () => {
    expect(
      normalizeFollowingLeaderboardPayload({ ...FOLLOWING_VALID_PAYLOAD, userRank: { bad: true } })
    ).toBeNull();
  });

  test("malformed entries are dropped while valid order is preserved", () => {
    const second = { ...FOLLOWING_VALID_ENTRY, userId: "player-3", rank: 2 };
    const result = normalizeFollowingLeaderboardPayload({
      entries: [null, "invalid", FOLLOWING_VALID_ENTRY, { bad: true }, second],
      userRank: null,
      followingCount: 2,
    });
    expect(result?.entries.map((e) => e.userId)).toEqual(["player-2", "player-3"]);
  });

  test("input objects are not mutated", () => {
    const original = JSON.parse(JSON.stringify(FOLLOWING_VALID_PAYLOAD));
    normalizeFollowingLeaderboardPayload(FOLLOWING_VALID_PAYLOAD);
    expect(FOLLOWING_VALID_PAYLOAD).toEqual(original);
  });

  test("valid payload normalizes correctly", () => {
    expect(normalizeFollowingLeaderboardPayload(FOLLOWING_VALID_PAYLOAD)).toEqual(FOLLOWING_VALID_PAYLOAD);
  });

  test("privacy: unexpected private fields at every depth do not survive", () => {
    const contaminated = {
      email: "root.private@example.test",
      accountId: "root-account-private",
      entries: [
        {
          ...FOLLOWING_VALID_ENTRY,
          email: "entry.private@example.test",
          purchasedPoints: 999,
          role: "admin",
          isHidden: false,
          isBot: false,
          provider: "credentials",
          token: "secret-token",
          nested: { email: "nested.private@example.test" },
        },
      ],
      userRank: {
        ...FOLLOWING_VALID_ENTRY,
        userId: "me",
        isCurrentUser: true,
        email: "rank.private@example.test",
        purchasedPoints: 500,
      },
      followingCount: 1,
    };

    const result = normalizeFollowingLeaderboardPayload(contaminated);
    expect(result?.entries).toEqual([FOLLOWING_VALID_ENTRY]);
    expect(result?.userRank).toEqual({ ...FOLLOWING_VALID_ENTRY, userId: "me", isCurrentUser: true });
    expect(Object.keys(result!)).toEqual(["entries", "userRank", "followingCount"]);
    expect(JSON.stringify(result)).not.toMatch(/private@example\.test|root-account|purchasedPoints|"role"|"provider"|"token"/);
  });
});

describe("Leaderboards page — Following tab payload hardening (Pass 25C4)", () => {
  it("renders a contaminated but valid Following payload without leaking private fields", async () => {
    authenticate();
    const contaminatedPayload = {
      entries: [
        FOLLOWING_VALID_ENTRY,
        { ...FOLLOWING_VALID_ENTRY, userId: "me", userName: "Me", rank: 2, isCurrentUser: true },
      ],
      userRank: { ...FOLLOWING_VALID_ENTRY, userId: "me", userName: "Me", rank: 2, isCurrentUser: true },
      followingCount: 1,
      email: "root.private@example.test",
    };
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") return jsonResponse(contaminatedPayload);
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();

    expect(screen.getByText("Alpha Player")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("Following 1 player")).toBeTruthy();
    expect(screen.queryByText(/private@example\.test/)).toBeNull();
    expect(screen.getByText("Your Following Rank")).toBeTruthy();
  });

  it("shows the existing error panel for a malformed top-level Following payload", async () => {
    authenticate();
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") return jsonResponse({ notTheRightShape: true, email: "leak.private@example.test" });
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();

    expect(screen.getByText("We couldn’t load this leaderboard")).toBeTruthy();
    expect(screen.queryByText(/leak\.private@example\.test/)).toBeNull();
    expect(screen.queryByText(/notTheRightShape/)).toBeNull();
  });

  it("drops malformed entries inside an otherwise valid payload while staying ready", async () => {
    authenticate();
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") {
        return jsonResponse({
          entries: [FOLLOWING_VALID_ENTRY, { bad: true }, null, "invalid"],
          userRank: null,
          followingCount: 3,
        });
      }
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();

    expect(screen.getByText("Alpha Player")).toBeTruthy();
    expect(screen.queryByText("We couldn’t load this leaderboard")).toBeNull();
    // followingCount uses the validated top-level value (3), not entries.length (1).
    expect(screen.getByText("Following 3 players")).toBeTruthy();
  });

  it("rejects a malformed non-null userRank and shows the error panel", async () => {
    authenticate();
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") {
        return jsonResponse({
          entries: [FOLLOWING_VALID_ENTRY],
          userRank: { totallyWrong: true },
          followingCount: 1,
        });
      }
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();

    expect(screen.getByText("We couldn’t load this leaderboard")).toBeTruthy();
  });

  it("background refresh applies refreshed valid public values without leaking private fields", async () => {
    authenticate();
    let followingCall = 0;
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") {
        followingCall += 1;
        if (followingCall === 1) {
          return jsonResponse({ entries: [FOLLOWING_VALID_ENTRY], userRank: null, followingCount: 1 });
        }
        return jsonResponse({
          entries: [{ ...FOLLOWING_VALID_ENTRY, userName: "Alpha-Updated", email: "refresh.private@example.test" }],
          userRank: null,
          followingCount: 1,
        });
      }
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Alpha Player")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Alpha-Updated")).toBeTruthy();
    expect(screen.queryByText(/refresh\.private@example\.test/)).toBeNull();
  });

  it("a failed background refresh preserves previous rankings and shows the refresh warning", async () => {
    authenticate();
    let followingCall = 0;
    global.fetch = jest.fn((url: string) => {
      if (url === "/api/leaderboards/following") {
        followingCall += 1;
        if (followingCall === 1) {
          return jsonResponse({ entries: [FOLLOWING_VALID_ENTRY], userRank: null, followingCount: 1 });
        }
        return jsonResponse({ notTheRightShape: true, email: "malformed-refresh.private@example.test" });
      }
      return jsonResponse({ entries: [], userRank: null });
    }) as unknown as typeof fetch;
    render(<LeaderboardsPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /Following/ }));
    await flush();
    expect(screen.getByText("Alpha Player")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new Event("puzzlewarz:puzzle-solved"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Alpha Player")).toBeTruthy();
    expect(screen.getByText(/Couldn.t refresh just now/)).toBeTruthy();
    expect(screen.queryByText(/malformed-refresh\.private@example\.test/)).toBeNull();
  });
});
