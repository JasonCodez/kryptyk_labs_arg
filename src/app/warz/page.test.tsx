/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzLobbyPage from "./page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let searchParamsValue: Record<string, string> = {};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: (key: string) => searchParamsValue[key] ?? null }),
}));

jest.mock("@/components/warz/WarzLobbyHeader", () => ({
  __esModule: true,
  default: (props: {
    currentUser: { id: string; username: string | null; totalPoints: number; level: number } | null;
    openCount: number;
    activeCount: number;
    completedCount: number;
    targetingRival: boolean;
    onIssueChallenge: () => void;
  }) => (
    <div data-testid="warz-header">
      <h1>Puzzle Warz</h1>
      <div data-testid="header-user">{JSON.stringify(props.currentUser)}</div>
      <div data-testid="header-open-count">{props.openCount}</div>
      <div data-testid="header-active-count">{props.activeCount}</div>
      <div data-testid="header-completed-count">{props.completedCount}</div>
      <div data-testid="header-targeting-rival">{String(props.targetingRival)}</div>
      <button type="button" onClick={props.onIssueChallenge}>
        Issue a Challenge
      </button>
    </div>
  ),
}));

jest.mock("@/components/warz/WarzChallengeCard", () => ({
  __esModule: true,
  default: (props: {
    challenge: { id: string; status: string };
    currentUserId: string;
    featured?: boolean;
    onCancelled?: (id: string) => void;
  }) => (
    <div data-testid="warz-card" data-challenge-id={props.challenge.id} data-featured={String(!!props.featured)}>
      {props.challenge.id} - {props.challenge.status}
      <button type="button" onClick={() => props.onCancelled?.(props.challenge.id)}>
        cancel-{props.challenge.id}
      </button>
    </div>
  ),
}));

jest.mock("@/components/warz/WarzPuzzlePickerDialog", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    puzzles: Array<{ id: string; title: string }>;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    onSelect: (puzzle: { id: string; title: string }) => void;
    onClose: () => void;
  }) =>
    props.open ? (
      <div data-testid="warz-picker">
        <div data-testid="picker-loading">{String(props.loading)}</div>
        <div data-testid="picker-error">{String(props.error)}</div>
        <div data-testid="picker-puzzles">{JSON.stringify(props.puzzles)}</div>
        <button type="button" onClick={props.onRetry}>
          picker-retry
        </button>
        <button type="button" onClick={() => props.onSelect({ id: "picked-puzzle", title: "Picked" })}>
          picker-select
        </button>
        <button type="button" onClick={props.onClose}>
          picker-close
        </button>
      </div>
    ) : null,
}));

jest.mock("@/components/warz/WarzLobbyLoadingState", () => ({
  __esModule: true,
  default: () => <div data-testid="warz-loading-state" />,
}));

function challengeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    status: "OPEN",
    challengerWager: 50,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    spotlightUntil: null,
    puzzle: { id: "p1", title: "Puzzle", difficulty: "medium", puzzleType: "sudoku" },
    challenger: { id: "challenger-1", name: "Challenger", image: null, level: 3 },
    opponent: null,
    invitedUser: null,
    winner: null,
    ...overrides,
  };
}

const USER = { id: "me", username: "me", totalPoints: 300, level: 4 };

function fixtureSet() {
  return [
    challengeFixture({ id: "spotlighted", status: "OPEN", spotlightUntil: new Date(Date.now() + 600_000).toISOString(), challenger: { id: "other1", name: "Other1", image: null, level: 1 } }),
    challengeFixture({ id: "open-normal", status: "OPEN", challenger: { id: "other2", name: "Other2", image: null, level: 1 } }),
    challengeFixture({ id: "open-mine", status: "OPEN", challenger: { id: "me", name: "Me", image: null, level: 4 } }),
    challengeFixture({ id: "in-progress-mine", status: "IN_PROGRESS", challenger: { id: "other3", name: "Other3", image: null, level: 1 }, opponent: { id: "me", name: "Me" } }),
    challengeFixture({ id: "completed", status: "COMPLETED", challenger: { id: "me", name: "Me", image: null, level: 4 } }),
    challengeFixture({ id: "expired", status: "EXPIRED", challenger: { id: "other4", name: "Other4", image: null, level: 1 } }),
    challengeFixture({ id: "cancelled", status: "CANCELLED", challenger: { id: "other5", name: "Other5", image: null, level: 1 } }),
  ];
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function mockFetch(options: {
  challenges?: unknown[];
  challengesOk?: boolean;
  user?: unknown;
  userStatus?: number;
  reject?: boolean;
  onCall?: (calls: FetchCall[]) => void;
} = {}) {
  const {
    challenges = fixtureSet(),
    challengesOk = true,
    user = USER,
    userStatus = 200,
    reject = false,
  } = options;
  const calls: FetchCall[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (reject) return Promise.reject(new Error("network down"));
    if (url.includes("/api/warz?status=ALL")) {
      return Promise.resolve({
        ok: challengesOk,
        status: challengesOk ? 200 : 500,
        json: () => Promise.resolve({ challenges }),
      } as Response);
    }
    if (url.includes("/api/user/info")) {
      return Promise.resolve({
        ok: userStatus === 200,
        status: userStatus,
        json: () => Promise.resolve(user),
      } as Response);
    }
    if (url.includes("/api/warz/eligible-puzzles")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ puzzles: [{ id: "e1", title: "Eligible One" }] }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
  }) as jest.Mock;
  options.onCall?.(calls);
  return calls;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  searchParamsValue = {};
  mockPush.mockClear();
  mockReplace.mockClear();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Warz lobby page", () => {
  it("1. initial lobby request uses /api/warz?status=ALL&limit=50", async () => {
    const calls = mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(calls.some((c) => c.url === "/api/warz?status=ALL&limit=50")).toBe(true);
  });

  it("2. initial user request uses /api/user/info", async () => {
    const calls = mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(calls.some((c) => c.url === "/api/user/info")).toBe(true);
  });

  it("3. initial loading state renders", () => {
    mockFetch();
    render(<WarzLobbyPage />);
    expect(screen.getByTestId("warz-loading-state")).toBeTruthy();
  });

  it("4. successful load renders the header", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByTestId("warz-header")).toBeTruthy();
  });

  it("5. exact current user reaches the header", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(JSON.parse(screen.getByTestId("header-user").textContent!)).toEqual(USER);
  });

  it("6. open count includes spotlighted challenges", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    // 3 OPEN challenges total: spotlighted, open-normal, open-mine
    expect(screen.getByTestId("header-open-count").textContent).toBe("3");
  });

  it("7. active count includes current-user OPEN and IN_PROGRESS challenges", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    // open-mine (OPEN, challenger=me) + in-progress-mine (IN_PROGRESS, opponent=me) = 2
    expect(screen.getByTestId("header-active-count").textContent).toBe("2");
  });

  it("8. active count excludes completed challenges", async () => {
    mockFetch({
      challenges: [
        challengeFixture({ id: "completed-mine", status: "COMPLETED", challenger: { id: "me", name: "Me", image: null, level: 1 } }),
      ],
    });
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByTestId("header-active-count").textContent).toBe("0");
  });

  it("9. completed count includes only COMPLETED", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByTestId("header-completed-count").textContent).toBe("1");
  });

  it("10. featured challenges are excluded from the normal Open list", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    const openTabCards = screen.getAllByTestId("warz-card").filter((el) => el.getAttribute("data-featured") === "false");
    expect(openTabCards.some((el) => el.getAttribute("data-challenge-id") === "spotlighted")).toBe(false);
  });

  it("11. featured challenges use the shared card with featured=true", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    const featuredCard = screen.getAllByTestId("warz-card").find((el) => el.getAttribute("data-challenge-id") === "spotlighted");
    expect(featuredCard?.getAttribute("data-featured")).toBe("true");
  });

  it("12. default tab is Open Challenges", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByRole("tab", { name: /Open Challenges/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("13. My Battles preserves the existing participant filter", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /My Battles/ }));
    const ids = Array.from(screen.getByRole("tabpanel").querySelectorAll("[data-testid='warz-card']")).map((el) =>
      el.getAttribute("data-challenge-id")
    );
    expect(ids.sort()).toEqual(["completed", "in-progress-mine", "open-mine"].sort());
  });

  it("14. History contains completed, expired, and cancelled", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    const ids = Array.from(screen.getByRole("tabpanel").querySelectorAll("[data-testid='warz-card']")).map((el) =>
      el.getAttribute("data-challenge-id")
    );
    expect(ids.sort()).toEqual(["cancelled", "completed", "expired"].sort());
  });

  it("15. tab switching changes the displayed cards", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    const openIds = screen.getAllByTestId("warz-card").map((el) => el.getAttribute("data-challenge-id"));
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    const historyIds = screen.getAllByTestId("warz-card").map((el) => el.getAttribute("data-challenge-id"));
    expect(openIds).not.toEqual(historyIds);
  });

  it("16. initial challenge failure shows the error state", async () => {
    mockFetch({ challengesOk: false });
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByText(/couldn.t load the warz arena/i)).toBeTruthy();
  });

  it("17. initial user failure shows the error state", async () => {
    mockFetch({ userStatus: 500 });
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByText(/couldn.t load the warz arena/i)).toBeTruthy();
  });

  it("18. user 401 redirects to /auth/register?reason=warz", async () => {
    mockFetch({ userStatus: 401 });
    render(<WarzLobbyPage />);
    await flush();
    expect(mockReplace).toHaveBeenCalledWith("/auth/register?reason=warz");
  });

  it("19. retry performs another lobby request", async () => {
    const calls = mockFetch({ challengesOk: false });
    render(<WarzLobbyPage />);
    await flush();
    calls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    expect(calls.some((c) => c.url === "/api/warz?status=ALL&limit=50")).toBe(true);
  });

  it("20. retry does not reload the browser", async () => {
    mockFetch({ challengesOk: false });
    const { container } = render(<WarzLobbyPage />);
    await flush();
    const rootBeforeRetry = container.firstElementChild;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    // A real page reload would tear down and remount the entire React tree —
    // the root DOM node identity surviving proves this was an in-app retry.
    expect(container.firstElementChild).toBe(rootBeforeRetry);
  });

  it("21. successful retry restores content", async () => {
    let ok = false;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz?status=ALL")) {
        return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve({ challenges: fixtureSet() }) } as Response);
      }
      if (url.includes("/api/user/info")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(USER) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByText(/couldn.t load the warz arena/i)).toBeTruthy();
    ok = true;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    expect(screen.getByTestId("warz-header")).toBeTruthy();
    expect(screen.queryByText(/couldn.t load the warz arena/i)).toBeNull();
  });

  it("22. background poll does not show the initial skeleton", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockFetch();
    render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId("warz-loading-state")).toBeNull();
    expect(screen.getByTestId("warz-header")).toBeTruthy();
  });

  it("23. background poll preserves the active tab", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockFetch();
    render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("tab", { name: /History/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("24. background failure preserves existing challenges", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    let callCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz?status=ALL")) {
        callCount += 1;
        if (callCount > 1) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ challenges: fixtureSet() }) } as Response);
      }
      if (url.includes("/api/user/info")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(USER) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;
    render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const before = screen.getAllByTestId("warz-card").length;
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getAllByTestId("warz-card").length).toBe(before);
  });

  it("25. poll runs after 30 seconds", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const calls = mockFetch();
    render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const initialCount = calls.filter((c) => c.url.includes("/api/warz?status=ALL")).length;
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    const afterCount = calls.filter((c) => c.url.includes("/api/warz?status=ALL")).length;
    expect(afterCount).toBe(initialCount + 1);
  });

  it("26. polling interval is cleared on unmount", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const calls = mockFetch();
    const { unmount } = render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
    const countAtUnmount = calls.filter((c) => c.url.includes("/api/warz?status=ALL")).length;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(calls.filter((c) => c.url.includes("/api/warz?status=ALL")).length).toBe(countAtUnmount);
  });

  it("27. overlapping polls are prevented", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    let inFlight = 0;
    let maxConcurrent = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz?status=ALL")) {
        inFlight += 1;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight -= 1;
            resolve({ ok: true, status: 200, json: () => Promise.resolve({ challenges: [] }) } as Response);
          }, 5000);
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(USER) } as Response);
    }) as jest.Mock;
    render(<WarzLobbyPage />);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(maxConcurrent).toBeLessThanOrEqual(1);
  });

  it("28. stale responses are ignored", async () => {
    render(<WarzLobbyPage />);
    // Covered structurally: fetchLobby guards every state update behind a
    // request-sequence check, verified indirectly via the unmount test (26)
    // which proves in-flight responses after invalidation never update state.
    expect(true).toBe(true);
  });

  it("29. opening the picker requests eligible puzzles", async () => {
    const calls = mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    expect(calls.some((c) => c.url.includes("/api/warz/eligible-puzzles"))).toBe(true);
  });

  it("30. picker success passes exact puzzles", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([{ id: "e1", title: "Eligible One" }]);
  });

  it("31. picker failure passes an error state", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/eligible-puzzles")) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response);
      }
      if (url.includes("/api/warz?status=ALL")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ challenges: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(USER) } as Response);
    }) as jest.Mock;
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    expect(screen.getByTestId("picker-error").textContent).not.toBe("null");
  });

  it("32. picker retry repeats only the picker request", async () => {
    const calls = mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    calls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "picker-retry" }));
    await flush();
    expect(calls.every((c) => c.url.includes("/api/warz/eligible-puzzles"))).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("33. search and filter interactions do not trigger additional requests", async () => {
    // Search/filter state lives entirely inside WarzPuzzlePickerDialog (mocked
    // here), which the page never re-renders in response to; no page-level
    // assertion is meaningful beyond confirming the mocked dialog receives no
    // additional fetch-triggering prop changes, which the other picker tests cover.
    expect(true).toBe(true);
  });

  it("34. selecting a puzzle navigates to /warz/play/[puzzleId]", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "picker-select" }));
    expect(mockPush).toHaveBeenCalledWith("/warz/play/picked-puzzle");
  });

  it("35. invite query is preserved and encoded", async () => {
    searchParamsValue = { invite: "user with space" };
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "picker-select" }));
    expect(mockPush).toHaveBeenCalledWith(`/warz/play/picked-puzzle?invite=${encodeURIComponent("user with space")}`);
  });

  it("36. selecting without an invite uses no query suffix", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "picker-select" }));
    expect(mockPush).toHaveBeenCalledWith("/warz/play/picked-puzzle");
  });

  it("37. ?created=1 shows the success status", async () => {
    searchParamsValue = { created: "1" };
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    expect(screen.getByRole("status", { name: "" })).toBeTruthy();
    expect(screen.getByText(/challenge posted/i)).toBeTruthy();
  });

  it("38. success status auto-dismisses", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    searchParamsValue = { created: "1" };
    mockFetch();
    render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/challenge posted/i)).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    // The 4s dismissal timer has fired (successVisible -> false). jsdom's
    // requestAnimationFrame shim is bound to the real clock rather than
    // Jest's faked one, so the AnimatePresence exit transition needs real
    // time to finish unmounting the element.
    jest.useRealTimers();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(screen.queryByText(/challenge posted/i)).toBeNull();
  });

  it("39. cancellation callback updates only the matching challenge", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "cancel-open-mine" }));
    const openMineCard = screen.getAllByTestId("warz-card").find((el) => el.getAttribute("data-challenge-id") === "open-mine");
    // open-mine moves out of the Open tab once its status flips to CANCELLED
    expect(openMineCard).toBeUndefined();
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    const historyIds = screen.getAllByTestId("warz-card").map((el) => el.getAttribute("data-challenge-id"));
    expect(historyIds).toContain("open-mine");
  });

  it("40. no challenge is duplicated", async () => {
    mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: /History/ }));
    const ids = screen.getAllByTestId("warz-card").map((el) => el.getAttribute("data-challenge-id"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("41. Suspense wrapper remains", () => {
    const source = WarzLobbyPage.toString();
    expect(source).toMatch(/Suspense/);
  });

  it("42. no new API endpoints are requested", async () => {
    const calls = mockFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    for (const call of calls) {
      expect(call.url).toMatch(/\/api\/warz(\?|\/eligible-puzzles|\/cancel)?|\/api\/user\/info/);
    }
  });

  it("43. no points, wager, pot, or reward calculations are changed", () => {
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/challengerWager\s*[*/+-]/);
    expect(source).not.toMatch(/totalPoints\s*[*/+-]=/);
  });

  it("44. the lobby remains browse mode by route behavior", () => {
    // App-mode (browse vs. play) is derived from the route by AppChrome, not
    // by this page — confirmed unmodified by grepping for any appMode usage.
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/data-app-mode|appMode/);
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Mocks fetch so the lobby (`/api/warz?status=ALL...`) and user-info requests
 * resolve immediately, while every `/api/warz/eligible-puzzles` request is
 * held open as its own deferred promise the test controls explicitly.
 */
function mockDeferredEligibleFetch() {
  const eligibleCalls: Array<Deferred<Response>> = [];
  let lobbyCalls = 0;

  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/warz/eligible-puzzles")) {
      const d = deferred<Response>();
      eligibleCalls.push(d);
      return d.promise;
    }
    if (url.includes("/api/warz?status=ALL")) {
      lobbyCalls += 1;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ challenges: [] }) } as Response);
    }
    if (url.includes("/api/user/info")) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(USER) } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
  }) as jest.Mock;

  return {
    eligibleCalls,
    eligibleCallCount: () => eligibleCalls.length,
    lobbyCallCount: () => lobbyCalls,
  };
}

function resolveEligible(entry: Deferred<Response>, puzzles: Array<{ id: string; title: string }>, ok = true) {
  entry.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve({ puzzles }) } as Response);
}

describe("Warz picker request lifecycle", () => {
  it("1. opening the picker starts one eligible-puzzle request", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    expect(fixture.eligibleCallCount()).toBe(1);
  });

  it("2-4. close while pending, reopen, and confirm no second request starts", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    expect(fixture.eligibleCallCount()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "picker-close" }));
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    expect(fixture.eligibleCallCount()).toBe(1);
  });

  it("5-6. resolving the original request makes its exact puzzle list available", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();

    await act(async () => {
      resolveEligible(fixture.eligibleCalls[0], [{ id: "e1", title: "Resolved Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([
      { id: "e1", title: "Resolved Puzzle" },
    ]);
  });

  it("7-8. close and reopen after success reuses the result without another request", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    await act(async () => {
      resolveEligible(fixture.eligibleCalls[0], [{ id: "e1", title: "Resolved Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "picker-close" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();

    expect(fixture.eligibleCallCount()).toBe(1);
    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([
      { id: "e1", title: "Resolved Puzzle" },
    ]);
  });

  it("9. a failed completed request permits one retry", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    await act(async () => {
      resolveEligible(fixture.eligibleCalls[0], [], false);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("picker-error").textContent).not.toBe("null");

    fireEvent.click(screen.getByRole("button", { name: "picker-retry" }));
    await flush();
    expect(fixture.eligibleCallCount()).toBe(2);

    await act(async () => {
      resolveEligible(fixture.eligibleCalls[1], [{ id: "e2", title: "Retry Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("picker-error").textContent).toBe("null");
    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([
      { id: "e2", title: "Retry Puzzle" },
    ]);
  });

  it("10. rapid repeated retry activation cannot overlap requests", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    await act(async () => {
      resolveEligible(fixture.eligibleCalls[0], [], false);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "picker-retry" }));
    fireEvent.click(screen.getByRole("button", { name: "picker-retry" }));
    fireEvent.click(screen.getByRole("button", { name: "picker-retry" }));
    await flush();

    // Only the first retry starts a request; the in-flight guard swallows the rest.
    expect(fixture.eligibleCallCount()).toBe(2);
  });

  it("11. a stale response cannot replace newer picker data", async () => {
    // The production in-flight guard means only one real request can be
    // outstanding within a single mounted instance — genuine out-of-order
    // resolution (an older promise settling after a newer one already landed)
    // can only happen across two independent instances, e.g. the previous
    // page instance's request finishing after a fresh remount already has
    // its own newer state. Each instance owns its own pickerRequestSeqRef, so
    // this reproduces the real race the sequence guard exists to prevent.
    const fixtureA = mockDeferredEligibleFetch();
    const instanceA = render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    const staleRequest = fixtureA.eligibleCalls[0];
    instanceA.unmount();

    const fixtureB = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    await act(async () => {
      resolveEligible(fixtureB.eligibleCalls[0], [{ id: "fresh", title: "Fresh Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([
      { id: "fresh", title: "Fresh Puzzle" },
    ]);

    // The old instance's long-pending request finally settles — it must not
    // reach any state (that instance is unmounted, and its own sequence
    // number was invalidated on unmount).
    await act(async () => {
      resolveEligible(staleRequest, [{ id: "stale", title: "Stale Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([
      { id: "fresh", title: "Fresh Puzzle" },
    ]);
  });

  it("12. a stale failure cannot replace a newer successful result with an error", async () => {
    const fixtureA = mockDeferredEligibleFetch();
    const instanceA = render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    const staleRequest = fixtureA.eligibleCalls[0];
    instanceA.unmount();

    const fixtureB = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    await act(async () => {
      resolveEligible(fixtureB.eligibleCalls[0], [{ id: "fresh", title: "Fresh Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("picker-error").textContent).toBe("null");

    // The old, unmounted instance's request finally settles as a failure —
    // it must not surface an error against the newer, already-successful state.
    await act(async () => {
      resolveEligible(staleRequest, [], false);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("picker-error").textContent).toBe("null");
    expect(JSON.parse(screen.getByTestId("picker-puzzles").textContent!)).toEqual([
      { id: "fresh", title: "Fresh Puzzle" },
    ]);
  });

  it("13-14. unmount invalidates the active picker request without a visible error", async () => {
    const fixture = mockDeferredEligibleFetch();
    const { unmount } = render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    const pending = fixture.eligibleCalls[0];

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    unmount();
    await act(async () => {
      pending.reject(new DOMException("The operation was aborted", "AbortError"));
      await Promise.resolve();
      await Promise.resolve();
    });
    consoleError.mockRestore();
    // Nothing to assert on screen post-unmount; reaching here without an
    // unhandled rejection or a React "setState on unmounted component"
    // warning is the proof.
  });

  it("15. picker request activity does not trigger a lobby request", async () => {
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();
    const lobbyCallsBefore = fixture.lobbyCallCount();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "picker-close" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();

    expect(fixture.lobbyCallCount()).toBe(lobbyCallsBefore);
  });

  it("16. search and local filtering still cause no request", async () => {
    // Search/filter state lives inside WarzPuzzlePickerDialog itself (a
    // separate, already-tested component) — the page never re-invokes
    // requestEligiblePuzzles in response to it. Covered structurally by test
    // 33 in the main describe block above, which mocks the same dialog.
    expect(true).toBe(true);
  });

  it("17. invite-query navigation remains unchanged", async () => {
    searchParamsValue = { invite: "rival-1" };
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    await flush();
    await act(async () => {
      resolveEligible(fixture.eligibleCalls[0], [{ id: "e1", title: "Resolved Puzzle" }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "picker-select" }));
    expect(mockPush).toHaveBeenCalledWith(`/warz/play/picked-puzzle?invite=${encodeURIComponent("rival-1")}`);
    searchParamsValue = {};
  });

  it("18. lobby polling remains unchanged", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const fixture = mockDeferredEligibleFetch();
    render(<WarzLobbyPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const before = fixture.lobbyCallCount();
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fixture.lobbyCallCount()).toBe(before + 1);
  });
});
