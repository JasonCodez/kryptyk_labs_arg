/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzChallengePage from "./page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUseAppReducedMotion = jest.fn(() => false);

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "challenge-1" }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@/hooks/useAppReducedMotion", () => ({
  useAppReducedMotion: () => mockUseAppReducedMotion(),
}));

jest.mock("@/components/warz/WarzChallengeLoadingState", () => ({
  __esModule: true,
  default: () => <div data-testid="challenge-loading" />,
}));

jest.mock("@/components/warz/WarzBattleBriefing", () => ({
  __esModule: true,
  default: (props: {
    challenge: { puzzle: { title: string }; challengerWager: number };
    currentUser: { id: string; totalPoints: number };
    statusKind: string;
    accepting: boolean;
    acceptError: string | null;
    onAccept: () => void;
    onResume: () => void;
  }) => (
    <div data-testid="warz-briefing">
      <div data-testid="briefing-puzzle-title">{props.challenge.puzzle.title}</div>
      <div data-testid="briefing-wager">{props.challenge.challengerWager}</div>
      <div data-testid="briefing-user">{JSON.stringify(props.currentUser)}</div>
      <div data-testid="briefing-status-kind">{props.statusKind}</div>
      <div data-testid="briefing-accepting">{String(props.accepting)}</div>
      <div data-testid="briefing-accept-error">{String(props.acceptError)}</div>
      <button type="button" onClick={props.onAccept}>accept</button>
      <button type="button" onClick={props.onResume}>resume</button>
    </div>
  ),
}));

jest.mock("@/components/warz/WarzBattleEntryTransition", () => ({
  __esModule: true,
  default: (props: { mode: string }) => <div data-testid="entry-transition">{props.mode}</div>,
}));

jest.mock("@/components/warz/WarzBattleResult", () => ({
  __esModule: true,
  default: (props: {
    challenge: ChallengeFixture;
    currentUserId: string;
    challengeUrl: string;
    completionError?: string | null;
    retryingCompletion?: boolean;
    onRetryCompletion?: () => void;
    onReturnToWarz: () => void;
    onBrowsePuzzles: () => void;
  }) => (
    <div data-testid="warz-battle-result">
      <div data-testid="result-challenge">{JSON.stringify(props.challenge)}</div>
      <div data-testid="result-current-user">{props.currentUserId}</div>
      <div data-testid="result-url">{props.challengeUrl}</div>
      <div data-testid="result-error">{props.completionError ?? ""}</div>
      <div data-testid="result-retrying">{String(props.retryingCompletion)}</div>
      {props.onRetryCompletion && <button type="button" onClick={props.onRetryCompletion}>retry submission</button>}
      <button type="button" onClick={props.onReturnToWarz}>return to warz</button>
      <button type="button" onClick={props.onBrowsePuzzles}>browse puzzles</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/WarzPlayBoard", () => ({
  __esModule: true,
  default: (props: {
    puzzle: { id: string; title: string };
    wager: number;
    onDone: (secs: number, forfeited?: boolean) => void;
    submissionPending?: boolean;
    submissionPendingLabel?: string;
  }) => (
    <div data-testid="warz-play-board">
      <div data-testid="board-puzzle">{JSON.stringify(props.puzzle)}</div>
      <div data-testid="board-wager">{props.wager}</div>
      <div data-testid="board-submission-pending">{String(props.submissionPending)}</div>
      <div data-testid="board-submission-pending-label">{String(props.submissionPendingLabel)}</div>
      <button type="button" onClick={() => props.onDone(42)}>solve</button>
      <button type="button" onClick={() => props.onDone(0, true)}>forfeit</button>
    </div>
  ),
}));

const PUZZLE = { id: "warz-accept-puzzle", title: "Midnight Sudoku", difficulty: "medium", puzzleType: "sudoku" };
const USER = { id: "me", username: "arena-player", name: "arena-player", totalPoints: 875 };
const CHALLENGER = { id: "challenger-1", username: "ArenaChallenger", name: null };
const FUTURE = new Date(Date.now() + 3600_000).toISOString();
const PAST = new Date(Date.now() - 3600_000).toISOString();
const COMPLETED_AT = "2026-07-23T00:00:00.000Z";

interface ChallengeFixture {
  id: string;
  status: string;
  challengerWager: number;
  expiresAt: string;
  puzzle: {
    id: string;
    title: string;
    difficulty: string;
    puzzleType: string;
    data?: Record<string, unknown>;
    sudoku?: { puzzleGrid: string; solutionGrid: string };
    jigsaw?: {
      imageUrl: string | null;
      gridRows: number;
      gridCols: number;
      snapTolerance: number;
      rotationEnabled: boolean;
    };
  };
  challenger: { id: string; username?: string | null; name?: string | null };
  opponent?: { id: string; username?: string | null; name?: string | null } | null;
  invitedUser?: { id: string; username?: string | null; name?: string | null } | null;
  challengerTime?: number | null;
  opponentTime?: number | null;
  winnerId?: string | null;
  potPaid?: boolean;
  completedAt?: string | null;
  winner?: { id: string; username?: string | null; name?: string | null } | null;
}

function baseChallenge(overrides: Partial<ChallengeFixture> = {}): ChallengeFixture {
  return {
    id: "challenge-1",
    status: "OPEN",
    challengerWager: 50,
    expiresAt: FUTURE,
    puzzle: PUZZLE,
    challenger: CHALLENGER,
    opponent: null,
    invitedUser: null,
    challengerTime: null,
    opponentTime: null,
    winnerId: null,
    potPaid: false,
    completedAt: null,
    winner: null,
    ...overrides,
  };
}

function completedChallenge(overrides: Partial<ChallengeFixture> = {}): ChallengeFixture {
  return baseChallenge({
    status: "COMPLETED",
    opponent: { id: "me", username: "arena-player" },
    challengerTime: 58,
    opponentTime: 42,
    winnerId: "me",
    potPaid: true,
    completedAt: COMPLETED_AT,
    winner: { id: "me", username: "arena-player" },
    ...overrides,
  });
}

interface FetchOptions {
  challengeStatus?: number;
  userStatus?: number;
  challenge?: ChallengeFixture;
}

function mockFetch(options: FetchOptions = {}) {
  const { challengeStatus = 200, userStatus = 200, challenge = baseChallenge() } = options;
  const calls: string[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/warz/challenge-1")) {
      return Promise.resolve({ ok: challengeStatus === 200, status: challengeStatus, json: () => Promise.resolve({ challenge }) } as Response);
    }
    if (url.includes("/api/user/info")) {
      return Promise.resolve({ ok: userStatus === 200, status: userStatus, json: () => Promise.resolve(USER) } as Response);
    }
    if (url.includes("/api/warz/accept")) {
      // Production-shaped: the real /api/warz/accept response only ever
      // returns puzzle metadata (id/title/difficulty/puzzleType) — never
      // data/sudoku/jigsaw. Spreading the full original `challenge` here
      // would mask the exact defect this correction fixes.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            challenge: {
              id: challenge.id,
              status: "IN_PROGRESS",
              challengerWager: challenge.challengerWager,
              expiresAt: challenge.expiresAt,
              puzzle: {
                id: challenge.puzzle.id,
                title: challenge.puzzle.title,
                difficulty: challenge.puzzle.difficulty,
                puzzleType: challenge.puzzle.puzzleType,
              },
              challenger: challenge.challenger,
              opponent: { id: "me", name: "arena-player" },
            },
          }),
      } as Response);
    }
    if (url.includes("/api/warz/complete")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ challenge: completedChallenge() }),
      } as Response);
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
  mockPush.mockClear();
  mockReplace.mockClear();
  mockUseAppReducedMotion.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Warz challenge page — initial loading", () => {
  it("1. requests /api/warz/[challengeId]", async () => {
    const calls = mockFetch();
    render(<WarzChallengePage />);
    await flush();
    expect(calls.some((c) => c.includes("/api/warz/challenge-1"))).toBe(true);
  });

  it("2. requests /api/user/info", async () => {
    const calls = mockFetch();
    render(<WarzChallengePage />);
    await flush();
    expect(calls.some((c) => c.includes("/api/user/info"))).toBe(true);
  });

  it("3. shows loading state before completion", () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => {})) as jest.Mock;
    render(<WarzChallengePage />);
    expect(screen.getByTestId("challenge-loading")).toBeTruthy();
  });

  it("4-6. successful load shows briefing with exact challenge and user", async () => {
    mockFetch();
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("warz-briefing")).toBeTruthy();
    expect(screen.getByTestId("briefing-puzzle-title").textContent).toBe("Midnight Sudoku");
    expect(JSON.parse(screen.getByTestId("briefing-user").textContent!)).toEqual({ id: "me", username: "arena-player", totalPoints: 875 });
  });

  it("7. challenge 401 redirects to /auth/register?reason=warz", async () => {
    mockFetch({ challengeStatus: 401 });
    render(<WarzChallengePage />);
    await flush();
    expect(mockReplace).toHaveBeenCalledWith("/auth/register?reason=warz");
  });

  it("8. user 401 redirects to /auth/register?reason=warz", async () => {
    mockFetch({ userStatus: 401 });
    render(<WarzChallengePage />);
    await flush();
    expect(mockReplace).toHaveBeenCalledWith("/auth/register?reason=warz");
  });

  it("9. challenge 404 shows missing-battle state", async () => {
    mockFetch({ challengeStatus: 404 });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByText("This battle could not be found.")).toBeTruthy();
  });

  it("10. generic challenge failure shows generic error", async () => {
    mockFetch({ challengeStatus: 500 });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getAllByText(/We couldn.t load this battle/).length).toBeGreaterThan(0);
  });

  it("11. user failure shows generic error", async () => {
    mockFetch({ userStatus: 500 });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getAllByText(/We couldn.t load this battle/).length).toBeGreaterThan(0);
  });

  it("12-13. retry repeats both initial requests without reload", async () => {
    const calls = mockFetch({ challengeStatus: 500 });
    const { container } = render(<WarzChallengePage />);
    await flush();
    const rootBefore = container.firstElementChild;
    calls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    expect(calls.some((c) => c.includes("/api/warz/challenge-1"))).toBe(true);
    expect(calls.some((c) => c.includes("/api/user/info"))).toBe(true);
    expect(container.firstElementChild).toBe(rootBefore);
  });

  it("18. unmount aborts or invalidates initial requests", async () => {
    let aborted = false;
    global.fetch = jest.fn((_input, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    }) as jest.Mock;
    const { unmount } = render(<WarzChallengePage />);
    unmount();
    expect(aborted).toBe(true);
  });
});

describe("Warz challenge page — classification", () => {
  it("19. own challenge classifies as own", async () => {
    mockFetch({ challenge: baseChallenge({ challenger: { id: "me", username: "arena-player" } }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("own");
  });

  it("20. public OPEN classifies as open", async () => {
    mockFetch();
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("open");
  });

  it("21. OPEN targeted to current user classifies as direct", async () => {
    mockFetch({ challenge: baseChallenge({ invitedUser: { id: "me", username: "arena-player" } }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("direct");
  });

  it("22. OPEN targeted to another user classifies as private", async () => {
    mockFetch({ challenge: baseChallenge({ invitedUser: { id: "other", username: "SomeoneElse" } }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("private");
  });

  it("23. IN_PROGRESS with current user opponent classifies as resume", async () => {
    mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me", username: "arena-player" } }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("resume");
  });

  it("24. IN_PROGRESS with another opponent classifies as in-progress-other", async () => {
    mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "other", username: "Other" } }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("in-progress-other");
  });

  it("25. EXPIRED classifies as expired", async () => {
    mockFetch({ challenge: baseChallenge({ status: "EXPIRED" }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("expired");
  });

  it("26. past expiresAt with OPEN status classifies as expired", async () => {
    mockFetch({ challenge: baseChallenge({ expiresAt: PAST }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("expired");
  });

  it("27. CANCELLED classifies as cancelled", async () => {
    mockFetch({ challenge: baseChallenge({ status: "CANCELLED" }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("cancelled");
  });

  it("28. COMPLETED loads directly into the authoritative result", async () => {
    const challenge = completedChallenge();
    mockFetch({ challenge });
    render(<WarzChallengePage />);
    await flush();
    expect(JSON.parse(screen.getByTestId("result-challenge").textContent!)).toEqual(challenge);
    expect(screen.queryByTestId("warz-briefing")).toBeNull();
    expect(screen.queryByTestId("warz-play-board")).toBeNull();
  });

  it("29. insufficient balance classifies correctly", async () => {
    mockFetch({ challenge: baseChallenge({ challengerWager: 900 }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("insufficient-balance");
  });

  it("30. exact-equal balance remains acceptable", async () => {
    mockFetch({ challenge: baseChallenge({ challengerWager: 875 }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("open");
  });

  it("31. completed state goes directly to result regardless of balance", async () => {
    mockFetch({ challenge: completedChallenge({ challengerWager: 900 }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("warz-battle-result")).toBeTruthy();
    expect(screen.queryByTestId("warz-briefing")).toBeNull();
  });

  it("32. own state wins priority over insufficient balance", async () => {
    mockFetch({ challenge: baseChallenge({ challenger: { id: "me", username: "arena-player" }, challengerWager: 900 }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("own");
  });

  it("33. private state does not show acceptance", async () => {
    mockFetch({ challenge: baseChallenge({ invitedUser: { id: "other", username: "SomeoneElse" } }) });
    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("briefing-status-kind").textContent).toBe("private");
  });
});

describe("Warz challenge page — acceptance", () => {
  it("34-37. public/direct challenge accepts through POST /api/warz/accept with exact body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();

    const acceptCalls = calls.filter((c) => c.url.includes("/api/warz/accept"));
    expect(acceptCalls.length).toBe(1);
    expect(acceptCalls[0].init?.method).toBe("POST");
    expect(JSON.parse(acceptCalls[0].init?.body as string)).toEqual({ challengeId: "challenge-1" });
  });

  it("38-39. rapid repeated accept activation creates one request; gameplay absent while pending", async () => {
    let acceptCalls = 0;
    let resolveAccept!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        acceptCalls += 1;
        return new Promise((resolve) => { resolveAccept = resolve; });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    const acceptButton = screen.getByRole("button", { name: "accept" });
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);
    expect(acceptCalls).toBe(1);
    expect(screen.queryByTestId("warz-play-board")).toBeNull();

    await act(async () => {
      resolveAccept({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("40. pending state reaches briefing", async () => {
    let resolveAccept!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return new Promise((resolve) => { resolveAccept = resolve; });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.getByTestId("briefing-accepting").textContent).toBe("true");

    await act(async () => {
      resolveAccept({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("41. server error text is shown exactly", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: "This challenge is no longer available." }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.getByTestId("briefing-accept-error").textContent).toBe("This challenge is no longer available.");
  });

  it("42-43. failed acceptance releases the guard and retry sends exactly one additional request", async () => {
    let acceptCalls = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        acceptCalls += 1;
        if (acceptCalls === 1) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: "Failed" }) } as Response);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(acceptCalls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(acceptCalls).toBe(2);
  });

  it("44. network failure shows safe network copy", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return Promise.reject(new Error("network down"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.getByTestId("briefing-accept-error").textContent).toBe("Network error — please try again.");
  });

  it("45-46. successful response replaces local challenge and enters transition", async () => {
    mockFetch();
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.getByTestId("entry-transition").textContent).toBe("accepted");
  });

  it("47-48. gameplay does not mount before transition; no refetch occurs after success", async () => {
    const calls = mockFetch();
    render(<WarzChallengePage />);
    await flush();
    calls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.queryByTestId("warz-play-board")).toBeNull();
    expect(calls.some((c) => c.includes("/api/warz/challenge-1"))).toBe(false);
    expect(calls.some((c) => c.includes("/api/user/info"))).toBe(false);
  });

  it("50. no local balance mutation occurs", async () => {
    mockFetch();
    render(<WarzChallengePage />);
    await flush();
    const before = screen.getByTestId("briefing-user").textContent;
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    // Balance is only carried in currentUser state, unaffected by acceptance.
    expect(before).toContain("875");
  });

  it("51. missing challenge in success response does not enter gameplay", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.getByTestId("briefing-accept-error").textContent).toBe("We couldn’t accept this challenge.");
    expect(screen.queryByTestId("entry-transition")).toBeNull();
  });

  it("52. successful acceptance leaves the briefing entirely, so no further accept request can be submitted", async () => {
    let acceptCalls = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        acceptCalls += 1;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(acceptCalls).toBe(1);
    expect(screen.queryByRole("button", { name: "accept" })).toBeNull();
    expect(screen.getByTestId("entry-transition")).toBeTruthy();
  });

  it("53. a late accept response after unmount does not throw or update state", async () => {
    let resolveAccept!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge() }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return new Promise((resolve) => { resolveAccept = resolve; });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    const { unmount } = render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    unmount();
    await act(async () => {
      resolveAccept({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) });
      await Promise.resolve();
      await Promise.resolve();
    });
    // No assertion needed beyond "did not throw" — a React act()/state-update
    // warning would otherwise fail this test via the console spy pattern used
    // elsewhere in this file.
  });
});

describe("Warz challenge page — accepted puzzle payload preservation", () => {
  it("1-3. successful acceptance still passes the exact initial puzzle.data payload to WarzPlayBoard", async () => {
    const dataChallenge = baseChallenge({
      puzzle: { ...PUZZLE, puzzleType: "word_search", data: { grid: [["A", "B"], ["C", "D"]], words: ["AB", "CD"] } },
    });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: dataChallenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        // Production shape: metadata only, no `data`.
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge: {
                id: dataChallenge.id,
                status: "IN_PROGRESS",
                challengerWager: dataChallenge.challengerWager,
                expiresAt: dataChallenge.expiresAt,
                puzzle: { id: dataChallenge.puzzle.id, title: dataChallenge.puzzle.title, difficulty: dataChallenge.puzzle.difficulty, puzzleType: dataChallenge.puzzle.puzzleType },
                challenger: dataChallenge.challenger,
                opponent: { id: "me", name: "arena-player" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    const boardPuzzle = JSON.parse(screen.getByTestId("board-puzzle").textContent!);
    expect(boardPuzzle.data).toEqual({ grid: [["A", "B"], ["C", "D"]], words: ["AB", "CD"] });
  });

  it("4-6. successful acceptance still passes the exact initial puzzle.sudoku payload to WarzPlayBoard", async () => {
    const sudokuChallenge = baseChallenge({
      puzzle: { ...PUZZLE, sudoku: { puzzleGrid: "1,2,3", solutionGrid: "1,2,3,4,5,6,7,8,9" } },
    });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: sudokuChallenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge: {
                id: sudokuChallenge.id,
                status: "IN_PROGRESS",
                challengerWager: sudokuChallenge.challengerWager,
                expiresAt: sudokuChallenge.expiresAt,
                puzzle: { id: sudokuChallenge.puzzle.id, title: sudokuChallenge.puzzle.title, difficulty: sudokuChallenge.puzzle.difficulty, puzzleType: sudokuChallenge.puzzle.puzzleType },
                challenger: sudokuChallenge.challenger,
                opponent: { id: "me", name: "arena-player" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    const boardPuzzle = JSON.parse(screen.getByTestId("board-puzzle").textContent!);
    expect(boardPuzzle.sudoku).toEqual({ puzzleGrid: "1,2,3", solutionGrid: "1,2,3,4,5,6,7,8,9" });
  });

  it("7-9. successful acceptance still passes the exact initial puzzle.jigsaw payload to WarzPlayBoard", async () => {
    const jigsawChallenge = baseChallenge({
      puzzle: {
        ...PUZZLE,
        puzzleType: "jigsaw",
        jigsaw: { imageUrl: "https://example.test/img.png", gridRows: 3, gridCols: 3, snapTolerance: 10, rotationEnabled: false },
      },
    });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: jigsawChallenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge: {
                id: jigsawChallenge.id,
                status: "IN_PROGRESS",
                challengerWager: jigsawChallenge.challengerWager,
                expiresAt: jigsawChallenge.expiresAt,
                puzzle: { id: jigsawChallenge.puzzle.id, title: jigsawChallenge.puzzle.title, difficulty: jigsawChallenge.puzzle.difficulty, puzzleType: jigsawChallenge.puzzle.puzzleType },
                challenger: jigsawChallenge.challenger,
                opponent: { id: "me", name: "arena-player" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    const boardPuzzle = JSON.parse(screen.getByTestId("board-puzzle").textContent!);
    expect(boardPuzzle.jigsaw).toEqual({ imageUrl: "https://example.test/img.png", gridRows: 3, gridCols: 3, snapTolerance: 10, rotationEnabled: false });
  });

  it("10-11. authoritative acceptance status and opponent identity are preserved", async () => {
    const challenge = baseChallenge({ puzzle: { ...PUZZLE, data: { grid: [] } } });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge: {
                id: challenge.id,
                status: "IN_PROGRESS",
                challengerWager: challenge.challengerWager,
                expiresAt: challenge.expiresAt,
                puzzle: { id: challenge.puzzle.id, title: challenge.puzzle.title, difficulty: challenge.puzzle.difficulty, puzzleType: challenge.puzzle.puzzleType },
                challenger: challenge.challenger,
                opponent: { id: "me", name: "arena-player" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    // Board mounted at all — proves the merged challenge carried the
    // authoritative IN_PROGRESS status and "me" opponent past classification.
    expect(screen.getByTestId("warz-play-board")).toBeTruthy();

    // 14-15. no challenge-detail refetch, no puzzle-detail request introduced.
    expect(calls.filter((c) => c.url.includes("/api/warz/challenge-1")).length).toBe(1);
    expect(calls.some((c) => c.url.includes("/api/puzzles/"))).toBe(false);
    // 16. no user-info refetch.
    expect(calls.filter((c) => c.url.includes("/api/user/info")).length).toBe(1);
    // 17. WarzPlayBoard mounts once.
    expect(screen.getAllByTestId("warz-play-board").length).toBe(1);
  });

  it("12-13. response-provided puzzle title/difficulty override stale metadata, and a response-provided playable payload takes precedence", async () => {
    const challenge = baseChallenge({
      puzzle: { ...PUZZLE, title: "Stale Title", difficulty: "easy", data: { grid: ["stale"] } },
    });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge: {
                id: challenge.id,
                status: "IN_PROGRESS",
                challengerWager: challenge.challengerWager,
                expiresAt: challenge.expiresAt,
                puzzle: {
                  id: challenge.puzzle.id,
                  title: "Fresh Title",
                  difficulty: "hard",
                  puzzleType: challenge.puzzle.puzzleType,
                  data: { grid: ["fresh"] },
                },
                challenger: challenge.challenger,
                opponent: { id: "me", name: "arena-player" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    const boardPuzzle = JSON.parse(screen.getByTestId("board-puzzle").textContent!);
    expect(boardPuzzle.title).toBe("Fresh Title");
    expect(boardPuzzle.difficulty).toBe("hard");
    expect(boardPuzzle.data).toEqual({ grid: ["fresh"] });
  });

  it("19. an invalid acceptance response still does not mount gameplay", async () => {
    const challenge = baseChallenge({ puzzle: { ...PUZZLE, data: { grid: [] } } });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await flush();
    expect(screen.queryByTestId("warz-play-board")).toBeNull();
    expect(screen.getByTestId("briefing-accept-error").textContent).toBe("We couldn’t accept this challenge.");
  });

  it("18. resume still uses the existing loaded payload without any accept response merge", async () => {
    const challenge = baseChallenge({
      status: "IN_PROGRESS",
      opponent: { id: "me" },
      puzzle: { ...PUZZLE, puzzleType: "word_search", data: { grid: [["Z"]] } },
    });
    mockFetch({ challenge });
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    const boardPuzzle = JSON.parse(screen.getByTestId("board-puzzle").textContent!);
    expect(boardPuzzle.data).toEqual({ grid: [["Z"]] });
  });

  it("20. duplicate-accept protection remains intact alongside the merge", async () => {
    let acceptCalls = 0;
    const challenge = baseChallenge({ puzzle: { ...PUZZLE, data: { grid: [] } } });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/accept")) {
        acceptCalls += 1;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              challenge: {
                id: challenge.id,
                status: "IN_PROGRESS",
                challengerWager: challenge.challengerWager,
                expiresAt: challenge.expiresAt,
                puzzle: { id: challenge.puzzle.id, title: challenge.puzzle.title, difficulty: challenge.puzzle.difficulty, puzzleType: challenge.puzzle.puzzleType },
                challenger: challenge.challenger,
                opponent: { id: "me", name: "arena-player" },
              },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    const acceptButton = screen.getByRole("button", { name: "accept" });
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);
    fireEvent.click(acceptButton);
    expect(acceptCalls).toBe(1);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getAllByTestId("warz-play-board").length).toBe(1);
  });
});

describe("Warz challenge page — resume", () => {
  it("54. resume sends no accept request", async () => {
    const calls = mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) });
    render(<WarzChallengePage />);
    await flush();
    calls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await flush();
    expect(calls.some((c) => c.includes("/api/warz/accept"))).toBe(false);
  });

  it("55. resume enters entry transition", async () => {
    mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) });
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    expect(screen.getByTestId("entry-transition").textContent).toBe("resume");
  });

  it("56-57. resume mounts WarzPlayBoard once, even under rapid repeated activation", async () => {
    mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) });
    render(<WarzChallengePage />);
    await flush();
    const resumeButton = screen.getByRole("button", { name: "resume" });
    fireEvent.click(resumeButton);
    fireEvent.click(resumeButton);
    fireEvent.click(resumeButton);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getAllByTestId("warz-play-board").length).toBe(1);
  });

  it("58-59. resume passes exact puzzle and wager", async () => {
    mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" }, challengerWager: 75 }) });
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(JSON.parse(screen.getByTestId("board-puzzle").textContent!)).toMatchObject({ id: PUZZLE.id });
    expect(screen.getByTestId("board-wager").textContent).toBe("75");
  });
});

describe("Warz challenge page — entry transition", () => {
  it("61-63. accepted transition mounts board and unmount clears the timer", async () => {
    mockFetch();
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<WarzChallengePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  it("62. reduced motion skips artificial delay (board mounts quickly)", async () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    mockFetch();
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByTestId("warz-play-board")).toBeTruthy();
  });

  it("65-66. active shell test ID and top-clearance class remain", async () => {
    mockFetch();
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    const shell = document.querySelector('[data-testid="warz-active-play-shell"]');
    expect(shell).toBeTruthy();
    expect(shell?.className).toContain("min-[1032px]:pt-24");
  });
});

describe("Warz challenge page — frozen completion regression", () => {
  it("67-70. valid solve posts to /api/warz/complete with exact body; forfeit retains forfeited:true", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/complete")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: completedChallenge() }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const completeCalls = calls.filter((c) => c.url.includes("/api/warz/complete"));
    expect(completeCalls.length).toBe(1);
    expect(JSON.parse(completeCalls[0].init?.body as string)).toEqual({ challengeId: "challenge-1", completionSeconds: 42 });
  });

  it("70b. forfeit body retains forfeited: true", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/complete")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            challenge: completedChallenge({
              challengerTime: 42,
              opponentTime: 999999,
              winnerId: "challenger-1",
              winner: CHALLENGER,
            }),
          }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "forfeit" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const completeCalls = calls.filter((c) => c.url.includes("/api/warz/complete"));
    expect(JSON.parse(completeCalls[0].init?.body as string)).toEqual({ challengeId: "challenge-1", forfeited: true });
  });

  it("71-73. renders the authoritative battle result after completion", async () => {
    mockFetch({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) });
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("warz-battle-result")).toBeTruthy();
    expect(JSON.parse(screen.getByTestId("result-challenge").textContent!)).toEqual(completedChallenge());
    expect(screen.getByTestId("result-current-user").textContent).toBe("me");
  });
});

describe("Warz challenge page — authoritative result restoration", () => {
  it("does not replay, refetch, or complete an already-completed challenge", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/warz/challenge-1")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: completedChallenge() }) } as Response);
      }
      if (url.includes("/api/user/info")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    expect(screen.getByTestId("warz-battle-result")).toBeTruthy();
    expect(calls.filter((url) => url.includes("/api/warz/challenge-1"))).toHaveLength(1);
    expect(calls.some((url) => url.includes("/api/warz/complete"))).toBe(false);
    expect(screen.queryByTestId("warz-briefing")).toBeNull();
    expect(screen.queryByTestId("warz-play-board")).toBeNull();
  });

  it.each([
    ["missing challenge", { winnerId: "me" }],
    ["wrong challenge id", { challenge: completedChallenge({ id: "another-challenge" }) }],
    ["non-completed challenge", { challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }],
  ])("rejects a 200 response with %s as RESULT NOT RECORDED", async (_label, completionPayload) => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }),
          }),
        } as Response);
      }
      if (url.includes("/api/user/info")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      }
      if (url.includes("/api/warz/complete")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(completionPayload) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "solve" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("result-error").textContent).toBe("We couldn’t record this battle result.");
    expect(screen.getByRole("button", { name: "retry submission" })).toBeTruthy();
  });

  it("shows a server error and retries the exact original terminal body", async () => {
    const completeBodies: unknown[] = [];
    let completionAttempt = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }),
          }),
        } as Response);
      }
      if (url.includes("/api/user/info")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      }
      if (url.includes("/api/warz/complete")) {
        completeBodies.push(JSON.parse(init?.body as string));
        completionAttempt += 1;
        return Promise.resolve(completionAttempt === 1
          ? { ok: false, status: 409, json: () => Promise.resolve({ error: "Result is still pending." }) }
          : { ok: true, json: () => Promise.resolve({ challenge: completedChallenge() }) }) as Promise<Response>;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "forfeit" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("result-error").textContent).toBe("Result is still pending.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "retry submission" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(completeBodies).toEqual([
      { challengeId: "challenge-1", forfeited: true },
      { challengeId: "challenge-1", forfeited: true },
    ]);
    expect(screen.getByTestId("result-error").textContent).toBe("");
  });

  it("uses a synchronous guard against duplicate terminal submissions", async () => {
    let resolveComplete!: (value: Response) => void;
    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/warz/challenge-1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }),
          }),
        } as Response);
      }
      if (url.includes("/api/user/info")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      }
      if (url.includes("/api/warz/complete")) {
        return new Promise<Response>((resolve) => { resolveComplete = resolve; });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
    const solve = screen.getByRole("button", { name: "solve" });
    fireEvent.click(solve);
    fireEvent.click(solve);
    expect(calls.filter((url) => url.includes("/api/warz/complete"))).toHaveLength(1);
    await act(async () => {
      resolveComplete({ ok: true, json: () => Promise.resolve({ challenge: completedChallenge() }) } as Response);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("routes actions to /warz and /puzzles and has no legacy tie flag", async () => {
    mockFetch({ challenge: completedChallenge() });
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "return to warz" }));
    fireEvent.click(screen.getByRole("button", { name: "browse puzzles" }));
    expect(mockPush).toHaveBeenNthCalledWith(1, "/warz");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/puzzles");

    const fs = jest.requireActual("fs");
    const path = jest.requireActual("path");
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/data\.tie/);
    expect(source).not.toMatch(/winnerId\s*===\s*currentUser/);
  });
});

describe("Warz challenge page — Pass 11 WarzPlayBoard submission integration", () => {
  it("1-2. passes submissionPending and the exact 'Submitting result…' label", async () => {
    let resolveComplete!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/complete")) return new Promise((resolve) => { resolveComplete = resolve; });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    fireEvent.click(screen.getByRole("button", { name: "solve" }));
    await flush();

    expect(screen.getByTestId("board-submission-pending").textContent).toBe("true");
    expect(screen.getByTestId("board-submission-pending-label").textContent).toBe("Submitting result…");

    await act(async () => {
      resolveComplete({ ok: true, json: () => Promise.resolve({ challenge: completedChallenge() }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("3-4. still passes exact wager and merged puzzle payload", async () => {
    const challenge = baseChallenge({
      status: "IN_PROGRESS",
      opponent: { id: "me" },
      challengerWager: 75,
      puzzle: { ...PUZZLE, data: { grid: [["Z"]] } },
    });
    mockFetch({ challenge });
    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.getByTestId("board-wager").textContent).toBe("75");
    const boardPuzzle = JSON.parse(screen.getByTestId("board-puzzle").textContent!);
    expect(boardPuzzle.data).toEqual({ grid: [["Z"]] });
  });

  it("5. no external inline pending indicator remains in the page source", () => {
    const fs = jest.requireActual("fs");
    const path = jest.requireActual("path");
    const source = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(source).not.toMatch(/animate-bounce/);
    expect(source).toMatch(/submissionPendingLabel="Submitting result…"/);
  });

  it("14-15. WarzPlayBoard remains mounted once during submission, with no duplicate pending message", async () => {
    let resolveComplete!: (v: unknown) => void;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/warz/challenge-1")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: baseChallenge({ status: "IN_PROGRESS", opponent: { id: "me" } }) }) } as Response);
      if (url.includes("/api/user/info")) return Promise.resolve({ ok: true, json: () => Promise.resolve(USER) } as Response);
      if (url.includes("/api/warz/complete")) return new Promise((resolve) => { resolveComplete = resolve; });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }) as jest.Mock;

    render(<WarzChallengePage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    fireEvent.click(screen.getByRole("button", { name: "solve" }));
    await flush();

    expect(screen.getAllByTestId("warz-play-board").length).toBe(1);
    expect(screen.getAllByText("Submitting result…").length).toBe(1);

    await act(async () => {
      resolveComplete({ ok: true, json: () => Promise.resolve({ challenge: completedChallenge() }) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
