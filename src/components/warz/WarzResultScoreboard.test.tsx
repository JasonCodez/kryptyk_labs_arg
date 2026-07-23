/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import WarzResultScoreboard from "./WarzResultScoreboard";
import type { WarzResultPlayer } from "@/lib/warzResult";

function player(overrides: Partial<WarzResultPlayer> = {}): WarzResultPlayer {
  return {
    id: "challenger-id",
    displayName: "Ada",
    image: null,
    roleLabel: "Challenger",
    isCurrentUser: true,
    isWinner: true,
    finishKind: "time",
    rawTime: 42,
    displayTime: "00:42",
    ...overrides,
  };
}

describe("WarzResultScoreboard", () => {
  it("renders semantic participant cards, roles, current-user and winner labels", () => {
    render(
      <WarzResultScoreboard
        challenger={player()}
        opponent={player({
          id: "opponent-id",
          displayName: "Grace",
          roleLabel: "Opponent",
          isCurrentUser: false,
          isWinner: false,
          rawTime: 58,
          displayTime: "00:58",
        })}
        battleOutcome="challenger-win"
      />
    );

    expect(screen.getByRole("heading", { name: /battle scoreboard/i })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("You · Challenger")).toBeTruthy();
    expect(screen.getByText("Opponent")).toBeTruthy();
    expect(screen.getByText("Winner")).toBeTruthy();
    expect(screen.getByText("00:42")).toBeTruthy();
    expect(screen.getByText("00:58")).toBeTruthy();
  });

  it("shows forfeit and missing-time labels without inventing a result", () => {
    render(
      <WarzResultScoreboard
        challenger={player({ isWinner: false, finishKind: "forfeit", displayTime: "Forfeit" })}
        opponent={player({
          id: null,
          displayName: "Player",
          roleLabel: "Opponent",
          isCurrentUser: false,
          isWinner: false,
          finishKind: "missing",
          rawTime: null,
          displayTime: "—",
        })}
        battleOutcome="unavailable"
      />
    );

    expect(screen.getByText("Forfeit")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("Winner")).toBeNull();
  });

  it("uses the profile image when available and falls back after an image error", () => {
    render(
      <WarzResultScoreboard
        challenger={player({ image: "https://example.test/ada.png" })}
        opponent={player({
          id: "opponent-id",
          displayName: "Grace",
          roleLabel: "Opponent",
          isCurrentUser: false,
          isWinner: false,
        })}
        battleOutcome="challenger-win"
      />
    );

    const image = document.querySelector('img[src="https://example.test/ada.png"]');
    expect(image).toBeTruthy();
    fireEvent.error(image!);
    expect(document.querySelector('img[src="https://example.test/ada.png"]')).toBeNull();
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("keeps long names breakable and has no controls or network side effects", () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    const longName = "A-name-that-is-deliberately-long-enough-to-wrap-without-overflow";
    render(
      <WarzResultScoreboard
        challenger={player({ displayName: longName })}
        opponent={player({ roleLabel: "Opponent", isCurrentUser: false, isWinner: false })}
        battleOutcome="challenger-win"
      />
    );

    expect(screen.getByText(longName).className).toContain("break-words");
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
