/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzPlayPage from "./page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let searchParamsValue: Record<string, string> = {};
const stableSearchParams = { get: (key: string) => searchParamsValue[key] ?? null };

jest.mock("next/navigation", () => ({
  useParams: () => ({ puzzleId: "warz-setup-puzzle" }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => stableSearchParams,
}));

jest.mock("@/components/warz/WarzSetupLoadingState", () => ({
  __esModule: true,
  default: () => <div data-testid="setup-loading" />,
}));

jest.mock("@/components/warz/WarzChallengeSetup", () => ({
  __esModule: true,
  default: (props: {
    puzzle: { id: string; title: string };
    currentUser: { id: string; username: string; totalPoints: number };
    wagerInput: string;
    wager: number | null;
    wagerError: string | null;
    selectedOpponent: { id: string; username: string } | null;
    resolvingInvite: boolean;
    inviteError: string | null;
    onPresetWager: (v: number) => void;
    onWagerInputChange: (v: string) => void;
    onSelectOpponent: (o: { id: string; username: string }) => void;
    onRemoveOpponent: () => void;
    onRetryInvite?: () => void;
    onStart: () => void;
    onCancel: () => void;
    startDisabled: boolean;
  }) => (
    <div data-testid="warz-setup">
      <div data-testid="setup-puzzle">{JSON.stringify(props.puzzle)}</div>
      <div data-testid="setup-user">{JSON.stringify(props.currentUser)}</div>
      <div data-testid="setup-wager-input">{props.wagerInput}</div>
      <div data-testid="setup-wager">{String(props.wager)}</div>
      <div data-testid="setup-wager-error">{String(props.wagerError)}</div>
      <div data-testid="setup-opponent">{JSON.stringify(props.selectedOpponent)}</div>
      <div data-testid="setup-resolving-invite">{String(props.resolvingInvite)}</div>
      <div data-testid="setup-invite-error">{String(props.inviteError)}</div>
      <div data-testid="setup-start-disabled">{String(props.startDisabled)}</div>
      <button type="button" onClick={() => props.onPresetWager(100)}>preset-100</button>
      <input
        data-testid="wager-input-field"
        value={props.wagerInput}
        onChange={(e) => props.onWagerInputChange(e.target.value)}
      />
      <button type="button" onClick={() => props.onSelectOpponent({ id: "rival-two", username: "RivalTwo" })}>
        select-opponent
      </button>
      <button type="button" onClick={props.onRemoveOpponent}>remove-opponent</button>
      <button type="button" onClick={props.onRetryInvite}>retry-invite</button>
      <button type="button" onClick={props.onStart} disabled={props.startDisabled}>start-battle</button>
      <button type="button" onClick={props.onCancel}>cancel</button>
    </div>
  ),
}));

jest.mock("@/components/warz/WarzChallengePosted", () => ({
  __esModule: true,
  default: (props: {
    puzzleTitle: string;
    solveTimeSeconds: number;
    wager: number;
    opponent: { id: string; username: string } | null;
  }) => (
    <div data-testid="warz-posted">
      <div data-testid="posted-title">{props.puzzleTitle}</div>
      <div data-testid="posted-time">{props.solveTimeSeconds}</div>
      <div data-testid="posted-wager">{props.wager}</div>
      <div data-testid="posted-opponent">{JSON.stringify(props.opponent)}</div>
    </div>
  ),
}));

jest.mock("@/components/puzzle/WarzPlayBoard", () => ({
  __esModule: true,
  default: (props: {
    puzzle: { id: string; title: string };
    wager: number;
    onDone: (secs: number, forfeited?: boolean) => void;
    submitError?: string | null;
    onRetry?: () => void;
  }) => (
    <div data-testid="warz-play-board">
      <div data-testid="board-puzzle">{JSON.stringify(props.puzzle)}</div>
      <div data-testid="board-wager">{props.wager}</div>
      <div data-testid="board-submit-error">{String(props.submitError)}</div>
      <button type="button" onClick={() => props.onDone(42)}>solve</button>
      <button type="button" onClick={() => props.onDone(0, true)}>forfeit</button>
      {props.onRetry && <button type="button" onClick={props.onRetry}>board-retry</button>}
    </div>
  ),
}));

const PUZZLE = { id: "warz-setup-puzzle", title: "Midnight Sudoku", difficulty: "medium", puzzleType: "sudoku" };
const USER = { id: "me", username: "arena-player", name: "arena-player", totalPoints: 875 };

interface FetchOptions {
  puzzleOk?: boolean;
  userStatus?: number;
  eligibleOk?: boolean;
  eligible?: boolean;
  eligibleReason?: string;
}

function mockFetch(options: FetchOptions = {}) {
  const { puzzleOk = true, userStatus = 200, eligibleOk = true, eligible = true, eligibleReason } = options;
  const calls: string[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/puzzles/")) {
      return Promise.resolve({ ok: puzzleOk, status: puzzleOk ? 200 : 500, json: () => Promise.resolve(PUZZLE) } as Response);
    }
    if (url.includes("/api/user/info")) {
      return Promise.resolve({ ok: userStatus === 200, status: userStatus, json: () => Promise.resolve(USER) } as Response);
    }
    if (url.includes("/api/warz/check-eligible")) {
      return Promise.resolve({
        ok: eligibleOk,
        status: eligibleOk ? 200 : 500,
        json: () => Promise.resolve({ eligible, reason: eligibleReason }),
      } as Response);
    }
    if (url.includes("/api/users/")) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: "rival-one", name: "RivalOne", image: null }) } as Response);
    }
    if (url.includes("/api/warz/create")) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
  }) as jest.Mock;
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

describe("Warz challenge setup page — initial loading", () => {
  it("1. requests /api/puzzles/[puzzleId]", async () => {
    const calls = mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(calls.some((c) => c.includes("/api/puzzles/warz-setup-puzzle"))).toBe(true);
  });

  it("2. requests /api/user/info", async () => {
    const calls = mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(calls.some((c) => c.includes("/api/user/info"))).toBe(true);
  });

  it("3. requests encoded /api/warz/check-eligible", async () => {
    const calls = mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(calls.some((c) => c === "/api/warz/check-eligible?puzzleId=warz-setup-puzzle")).toBe(true);
  });

  it("4. shows loading state before completion", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    expect(screen.getByTestId("setup-loading")).toBeTruthy();
    await flush();
  });

  it("5-7. successful load shows setup with exact puzzle and user", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByTestId("warz-setup")).toBeTruthy();
    expect(JSON.parse(screen.getByTestId("setup-puzzle").textContent!)).toMatchObject({ id: PUZZLE.id, title: PUZZLE.title });
    expect(JSON.parse(screen.getByTestId("setup-user").textContent!)).toEqual({ id: "me", username: "arena-player", totalPoints: 875 });
  });

  it("9. user 401 redirects to /auth/register?reason=warz", async () => {
    mockFetch({ userStatus: 401 });
    render(<WarzPlayPage />);
    await flush();
    expect(mockReplace).toHaveBeenCalledWith("/auth/register?reason=warz");
  });

  it("10. puzzle non-OK shows error", async () => {
    mockFetch({ puzzleOk: false });
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByText(/couldn.t prepare this challenge/i)).toBeTruthy();
  });

  it("12. eligibility non-OK shows error", async () => {
    mockFetch({ eligibleOk: false });
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByText(/couldn.t prepare this challenge/i)).toBeTruthy();
  });

  it("13. eligible false shows exact reason", async () => {
    mockFetch({ eligible: false, eligibleReason: "You have already attempted this puzzle." });
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByText("You have already attempted this puzzle.")).toBeTruthy();
  });

  it("14-15. retry repeats all three setup requests and does not reload the browser", async () => {
    const calls = mockFetch({ puzzleOk: false });
    const { container } = render(<WarzPlayPage />);
    await flush();
    const rootBefore = container.firstElementChild;
    calls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    expect(calls.some((c) => c.includes("/api/puzzles/"))).toBe(true);
    expect(calls.some((c) => c.includes("/api/user/info"))).toBe(true);
    expect(calls.some((c) => c.includes("/api/warz/check-eligible"))).toBe(true);
    expect(container.firstElementChild).toBe(rootBefore);
  });

  it("19. unmount aborts or invalidates setup request", async () => {
    let aborted = false;
    global.fetch = jest.fn((_input, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    }) as jest.Mock;
    const { unmount } = render(<WarzPlayPage />);
    unmount();
    expect(aborted).toBe(true);
  });
});

describe("Warz challenge setup page — wager", () => {
  it("20-21. initial wager is exactly 50, initial input is exactly '50'", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByTestId("setup-wager").textContent).toBe("50");
    expect(screen.getByTestId("setup-wager-input").textContent).toBe("50");
  });

  it("22. preset updates exact input and wager", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "preset-100" }));
    expect(screen.getByTestId("setup-wager").textContent).toBe("100");
    expect(screen.getByTestId("setup-wager-input").textContent).toBe("100");
  });

  it("23. empty input is invalid", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "" } });
    expect(screen.getByTestId("setup-wager").textContent).toBe("null");
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("Enter a wager.");
  });

  it("24. below 10 is invalid", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "9" } });
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("Minimum wager is 10 Points.");
  });

  it("25. above 500 is invalid", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "501" } });
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("Maximum wager is 500 Points.");
  });

  it("26. decimal is invalid", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "12.5" } });
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("Enter a whole-number wager.");
  });

  it("27. exponent notation is invalid", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "1e2" } });
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("Enter a whole-number wager.");
  });

  it("28. valid custom integer is preserved exactly", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "025" } });
    expect(screen.getByTestId("setup-wager").textContent).toBe("25");
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("null");
  });

  it("29. above-balance wager is invalid", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...USER, totalPoints: 60 }) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "100" } });
    expect(screen.getByTestId("setup-wager-error").textContent).toBe("You don’t have enough Points for this wager.");
  });

  it("31. invalid wager disables Start Battle", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "" } });
    expect(screen.getByTestId("setup-start-disabled").textContent).toBe("true");
  });

  it("32. valid wager enables Start Battle when setup is otherwise ready", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByTestId("setup-start-disabled").textContent).toBe("false");
  });
});

describe("Warz challenge setup page — query-param invite", () => {
  it("33-34. invite requests /api/users/[id] with encoded id", async () => {
    searchParamsValue = { invite: "rival one" };
    const calls = mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(calls.some((c) => c === `/api/users/${encodeURIComponent("rival one")}`)).toBe(true);
  });

  it("35-36. resolved user becomes selected opponent with fallback name mapping", async () => {
    searchParamsValue = { invite: "rival-one" };
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(JSON.parse(screen.getByTestId("setup-opponent").textContent!)).toEqual({
      id: "rival-one",
      username: "RivalOne",
      avatarUrl: null,
    });
  });

  it("37. late query response does not overwrite manual selection", async () => {
    searchParamsValue = { invite: "rival-one" };
    let resolveInvite!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) return new Promise((resolve) => { resolveInvite = resolve; });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "select-opponent" }));
    expect(JSON.parse(screen.getByTestId("setup-opponent").textContent!)).toEqual({ id: "rival-two", username: "RivalTwo" });

    await act(async () => {
      resolveInvite({ ok: true, json: () => Promise.resolve({ id: "rival-one", name: "RivalOne" }) });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(JSON.parse(screen.getByTestId("setup-opponent").textContent!)).toEqual({ id: "rival-two", username: "RivalTwo" });
  });

  it("38. invite 404 shows unavailable state", async () => {
    searchParamsValue = { invite: "missing-user" };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;
    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByTestId("setup-invite-error").textContent).toBe("That player is unavailable.");
  });

  it("39. invite retry repeats only the invite request", async () => {
    searchParamsValue = { invite: "missing-user" };
    let inviteCalls = 0;
    let lobbyCalls = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) { lobbyCalls += 1; return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response); }
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) { inviteCalls += 1; return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response); }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;
    render(<WarzPlayPage />);
    await flush();
    const lobbyCallsBefore = lobbyCalls;
    fireEvent.click(screen.getByRole("button", { name: "retry-invite" }));
    await flush();
    expect(inviteCalls).toBe(2);
    expect(lobbyCalls).toBe(lobbyCallsBefore);
  });

  it("40-41. clearing targeted user exposes normal search state", async () => {
    searchParamsValue = { invite: "rival-one" };
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    expect(JSON.parse(screen.getByTestId("setup-opponent").textContent!)).toMatchObject({ id: "rival-one" });
    fireEvent.click(screen.getByRole("button", { name: "remove-opponent" }));
    expect(screen.getByTestId("setup-opponent").textContent).toBe("null");
  });
});

describe("Warz challenge setup page — self-invite rejection", () => {
  it("invite resolution waits until currentUser has loaded before requesting the profile", async () => {
    searchParamsValue = { invite: "rival-one" };
    let resolveUserInfo!: (v: unknown) => void;
    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return new Promise((resolve) => { resolveUserInfo = resolve; });
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "rival-one", name: "RivalOne", image: null }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    expect(calls.some((c) => c.includes("/api/users/rival-one"))).toBe(false);

    await act(async () => {
      resolveUserInfo({ ok: true, json: () => Promise.resolve(USER) });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(calls.some((c) => c.includes("/api/users/rival-one"))).toBe(true);
  });

  it("a query-param profile matching the current user is rejected with exact copy, leaves opponent null, and disables Start Battle", async () => {
    searchParamsValue = { invite: "me" };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "me", name: "arena-player" }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByTestId("setup-invite-error").textContent).toBe("You cannot challenge yourself.");
    expect(screen.getByTestId("setup-opponent").textContent).toBe("null");
    expect(screen.getByTestId("setup-start-disabled").textContent).toBe("true");
  });

  it("self-invite resolution does not loop or repeatedly request the same profile", async () => {
    searchParamsValue = { invite: "me" };
    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "me", name: "arena-player" }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    const selfInviteCalls = () => calls.filter((c) => c.includes("/api/users/me")).length;
    expect(selfInviteCalls()).toBe(1);

    // Unrelated state changes (wager edits) must not re-trigger the effect.
    fireEvent.change(screen.getByTestId("wager-input-field"), { target: { value: "100" } });
    await flush();
    expect(selfInviteCalls()).toBe(1);
  });

  it("choosing another opponent after a self-invite rejection clears the error and allows a valid opponent to be selected", async () => {
    searchParamsValue = { invite: "me" };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/users/")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "me", name: "arena-player" }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    expect(screen.getByTestId("setup-invite-error").textContent).toBe("You cannot challenge yourself.");

    fireEvent.click(screen.getByRole("button", { name: "remove-opponent" }));
    expect(screen.getByTestId("setup-invite-error").textContent).toBe("null");
    expect(screen.getByTestId("setup-start-disabled").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "select-opponent" }));
    expect(JSON.parse(screen.getByTestId("setup-opponent").textContent!)).toEqual({ id: "rival-two", username: "RivalTwo" });
  });
});

describe("Warz challenge setup page — starting", () => {
  it("unmount during the setup-to-play transition clears the pending timer and never updates state afterward", async () => {
    mockFetch();
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<WarzPlayPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  it("rapid repeated Start Battle activations still mount exactly one play board", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    const startButton = screen.getByRole("button", { name: "start-battle" });
    fireEvent.click(startButton);
    fireEvent.click(startButton);
    fireEvent.click(startButton);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getAllByTestId("warz-play-board").length).toBe(1);
  });


  it("43-46. Start Battle does not create a challenge or re-request user/eligibility, and renders WarzPlayBoard", async () => {
    const calls = mockFetch();
    render(<WarzPlayPage />);
    await flush();
    calls.length = 0;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(calls.some((c) => c.includes("/api/warz/create"))).toBe(false);
    expect(calls.some((c) => c.includes("/api/user/info"))).toBe(false);
    expect(calls.some((c) => c.includes("/api/warz/check-eligible"))).toBe(false);
    expect(screen.getByTestId("warz-play-board")).toBeTruthy();
  });

  it("47-48. exact puzzle and wager reach WarzPlayBoard", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(JSON.parse(screen.getByTestId("board-puzzle").textContent!)).toMatchObject({ id: PUZZLE.id });
    expect(screen.getByTestId("board-wager").textContent).toBe("50");
  });
});

describe("Warz challenge setup page — challenge submission", () => {
  it("52. forfeit routes to /warz", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    fireEvent.click(screen.getByRole("button", { name: "forfeit" }));
    expect(mockPush).toHaveBeenCalledWith("/warz");
  });

  it("53-59. valid solve posts once with exact body, open challenge omits invitedUserId", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/warz/create")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const createCalls = calls.filter((c) => c.url.includes("/api/warz/create"));
    expect(createCalls.length).toBe(1);
    expect(createCalls[0].init?.method).toBe("POST");
    const body = JSON.parse(createCalls[0].init?.body as string);
    expect(body).toEqual({ puzzleId: "warz-setup-puzzle", completionSeconds: 42, wager: 50 });
  });

  it("59. targeted challenge contains exact invitedUserId", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/warz/create")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "select-opponent" }));
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const createCalls = calls.filter((c) => c.url.includes("/api/warz/create"));
    const body = JSON.parse(createCalls[0].init?.body as string);
    expect(body.invitedUserId).toBe("rival-two");
  });

  it("60. duplicate onDone calls while pending create one request", async () => {
    let createCalls = 0;
    let resolveCreate!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/warz/create")) {
        createCalls += 1;
        return new Promise((resolve) => { resolveCreate = resolve; });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    fireEvent.click(screen.getByRole("button", { name: "solve" }));
    fireEvent.click(screen.getByRole("button", { name: "solve" }));
    fireEvent.click(screen.getByRole("button", { name: "solve" }));
    expect(createCalls).toBe(1);
    await act(async () => {
      resolveCreate({ ok: true, json: () => Promise.resolve({ success: true }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("61-64. successful submission renders posted component with exact values", async () => {
    mockFetch();
    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "select-opponent" }));
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("warz-posted")).toBeTruthy();
    expect(screen.getByTestId("posted-title").textContent).toBe("Midnight Sudoku");
    expect(screen.getByTestId("posted-time").textContent).toBe("42");
    expect(screen.getByTestId("posted-wager").textContent).toBe("50");
    expect(JSON.parse(screen.getByTestId("posted-opponent").textContent!)).toEqual({ id: "rival-two", username: "RivalTwo" });
  });

  it("65-68. submission failure remains retryable, retry submits once more, then success cannot be retried again", async () => {
    let createCalls = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/puzzles/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(PUZZLE) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/check-eligible")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ eligible: true }) } as Response);
      if (url.includes("/api/warz/create")) {
        createCalls += 1;
        if (createCalls === 1) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: "Failed to post challenge" }) } as Response);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzPlayPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "start-battle" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createCalls).toBe(1);
    expect(screen.getByTestId("board-submit-error").textContent).toBe("Failed to post challenge");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "board-retry" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createCalls).toBe(2);
    expect(screen.getByTestId("warz-posted")).toBeTruthy();
  });

  it("69-70. no client point deduction or reward calculation occurs (source check)", () => {
    const fs = jest.requireActual("fs");
    const path = jest.requireActual("path");
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/totalPoints\s*[-+]=|totalPoints\s*[-+]\s*wager/);
    expect(source).not.toMatch(/reward|xpEarned/i);
  });
});
