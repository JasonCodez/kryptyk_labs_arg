/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import WarzBattleResult from "./WarzBattleResult";
import type { WarzResultChallenge } from "@/lib/warzResult";

const mockUseAppReducedMotion = jest.fn(() => false);

jest.mock("@/hooks/useAppReducedMotion", () => ({
  useAppReducedMotion: () => mockUseAppReducedMotion(),
}));

jest.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({ children, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        void initial;
        void animate;
        void transition;
        const Tag = tag as keyof React.JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      };
      Component.displayName = `motion.${tag}`;
      return Component;
    },
  }),
}));

function challenge(overrides: Partial<WarzResultChallenge> = {}): WarzResultChallenge {
  return {
    id: "challenge-1",
    status: "COMPLETED",
    challengerWager: 50,
    challengerTime: 42,
    opponentTime: 58,
    winnerId: "challenger-id",
    potPaid: true,
    puzzle: { title: "Midnight Sudoku", puzzleType: "sudoku" },
    challenger: { id: "challenger-id", username: "Ada" },
    opponent: { id: "opponent-id", username: "Grace" },
    winner: { id: "challenger-id", username: "Ada" },
    ...overrides,
  };
}

const callbacks = {
  onReturnToWarz: jest.fn(),
  onBrowsePuzzles: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAppReducedMotion.mockReturnValue(false);
});

describe("WarzBattleResult", () => {
  it.each([
    ["victory", "challenger-id", "Victory", "POT CLAIMED", "100 Points"],
    ["defeat", "opponent-id", "Defeat", "WAGER LOST", "50 Points"],
    ["neutral", "spectator-id", "Battle Complete", "TOTAL POT", "100 Points"],
  ])("renders the %s presentation from the authoritative winner", (_kind, viewer, headline, economy, amount) => {
    render(
      <WarzBattleResult
        challenge={challenge()}
        currentUserId={viewer}
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        {...callbacks}
      />
    );
    expect(screen.getByRole("heading", { name: headline })).toBeTruthy();
    expect(screen.getByText(economy)).toBeTruthy();
    expect(screen.getByText(amount)).toBeTruthy();
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
  });

  it("renders draw and forfeit variants without a rematch or replay control", () => {
    const { rerender } = render(
      <WarzBattleResult
        challenge={challenge({ winnerId: null, winner: null, challengerTime: 42, opponentTime: 42 })}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        {...callbacks}
      />
    );
    expect(screen.getByRole("heading", { name: "Draw" })).toBeTruthy();
    expect(screen.getByText("WAGER RETURNED")).toBeTruthy();

    rerender(
      <WarzBattleResult
        challenge={challenge({ challengerTime: 999999, winnerId: "opponent-id", winner: { id: "opponent-id" } })}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        {...callbacks}
      />
    );
    expect(screen.getByRole("heading", { name: "Defeat by Forfeit" })).toBeTruthy();
    expect(screen.getByText("Forfeit")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /rematch|replay/i })).toBeNull();
  });

  it("renders unavailable data honestly and suppresses sharing and the scoreboard", () => {
    render(
      <WarzBattleResult
        challenge={challenge({ opponent: null, winnerId: null, winner: null })}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        {...callbacks}
      />
    );
    expect(screen.getByRole("heading", { name: "Result Unavailable" })).toBeTruthy();
    expect(screen.queryByText(/battle scoreboard/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Share Result" })).toBeNull();
  });

  it("renders a retryable result-not-recorded state and wires actions", () => {
    const retry = jest.fn();
    render(
      <WarzBattleResult
        challenge={challenge({ status: "IN_PROGRESS" })}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        completionError="The server rejected this result."
        onRetryCompletion={retry}
        {...callbacks}
      />
    );
    expect(screen.getByRole("heading", { name: "Result Not Recorded" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("The server rejected this result.");
    fireEvent.click(screen.getByRole("button", { name: "Retry Submission" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to Warz" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(callbacks.onReturnToWarz).toHaveBeenCalledTimes(1);
  });

  it("disables the retry control while retrying", () => {
    render(
      <WarzBattleResult
        challenge={challenge()}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        completionError="Still waiting."
        retryingCompletion
        onRetryCompletion={jest.fn()}
        {...callbacks}
      />
    );
    expect((screen.getByRole("button", { name: /Retrying/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("wires the stable navigation actions and performs no request itself", () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    render(
      <WarzBattleResult
        challenge={challenge()}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        {...callbacks}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Return to Warz" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse Puzzles" }));
    expect(callbacks.onReturnToWarz).toHaveBeenCalledTimes(1);
    expect(callbacks.onBrowsePuzzles).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it("honors application reduced motion and uses only semantic CSS color tokens", () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    const { container } = render(
      <WarzBattleResult
        challenge={challenge()}
        currentUserId="challenger-id"
        challengeUrl="https://puzzlewarz.test/warz/challenge/challenge-1"
        {...callbacks}
      />
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
    expect(container.querySelector('[data-testid="warz-battle-result"]')).toBeTruthy();
  });
});
