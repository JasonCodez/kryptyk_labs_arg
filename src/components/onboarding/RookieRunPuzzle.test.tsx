/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RookieRunPuzzle from "./RookieRunPuzzle";
import { loadOnboardingState } from "@/lib/onboarding";

const USER = "u1";
const CLUE = "What do players do with puzzles?";
const SCRAMBLE = ["V", "E", "S", "O", "L"];

function tile(letter: string): HTMLButtonElement {
  return screen.getByRole("button", { name: `Letter ${letter}` }) as HTMLButtonElement;
}

function slot(n: number): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^Answer slot ${n}`) }) as HTMLButtonElement;
}

function checkButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /check answer/i }) as HTMLButtonElement;
}

function placeLetters(letters: string[]) {
  for (const letter of letters) fireEvent.click(tile(letter));
}

describe("RookieRunPuzzle", () => {
  const onReturnToDashboard = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    onReturnToDashboard.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  function show() {
    render(<RookieRunPuzzle userId={USER} onReturnToDashboard={onReturnToDashboard} />);
  }

  it("renders the clue and the scrambled letter tiles", () => {
    show();
    expect(screen.getByText(CLUE)).toBeTruthy();
    for (const letter of SCRAMBLE) {
      expect(tile(letter)).toBeTruthy();
    }
  });

  it("marks first_puzzle_started on mount", () => {
    show();
    const state = loadOnboardingState(USER);
    expect(state.completedSteps).toContain("first_puzzle_started");
    expect(state.completedSteps).not.toContain("first_puzzle_completed");
  });

  it("tapping letters fills answer slots in order", () => {
    show();
    fireEvent.click(tile("S"));
    fireEvent.click(tile("O"));
    expect(slot(1).getAttribute("aria-label")).toBe("Answer slot 1: S");
    expect(slot(2).getAttribute("aria-label")).toBe("Answer slot 2: O");
    expect(slot(3).getAttribute("aria-label")).toBe("Answer slot 3, empty");
  });

  it("used letter tiles become disabled", () => {
    show();
    fireEvent.click(tile("S"));
    expect(tile("S").disabled).toBe(true);
    expect(tile("O").disabled).toBe(false);
  });

  it("tapping a filled slot removes the most recent letter", () => {
    show();
    placeLetters(["S", "O"]);
    fireEvent.click(slot(1));
    expect(slot(1).getAttribute("aria-label")).toBe("Answer slot 1: S");
    expect(slot(2).getAttribute("aria-label")).toBe("Answer slot 2, empty");
    expect(tile("O").disabled).toBe(false);
  });

  it("Backspace removes the latest letter", () => {
    show();
    placeLetters(["S", "O"]);
    fireEvent.keyDown(screen.getByRole("group", { name: "Letter tiles" }), { key: "Backspace" });
    expect(slot(2).getAttribute("aria-label")).toBe("Answer slot 2, empty");
    expect(tile("O").disabled).toBe(false);
  });

  it("letter keys place matching tiles", () => {
    show();
    const tiles = screen.getByRole("group", { name: "Letter tiles" });
    fireEvent.keyDown(tiles, { key: "s" });
    expect(slot(1).getAttribute("aria-label")).toBe("Answer slot 1: S");
    expect(tile("S").disabled).toBe(true);
  });

  it("Check Answer stays disabled until all five slots are filled", () => {
    show();
    expect(checkButton().disabled).toBe(true);
    placeLetters(["S", "O", "L", "V"]);
    expect(checkButton().disabled).toBe(true);
    placeLetters(["E"]);
    expect(checkButton().disabled).toBe(false);
  });

  it("an incorrect answer shows feedback without completing the step", () => {
    show();
    placeLetters(["V", "E", "S", "O", "L"]);
    fireEvent.click(checkButton());
    expect(screen.getByText("Not quite—remove a letter and try again.")).toBeTruthy();
    expect(loadOnboardingState(USER).completedSteps).not.toContain("first_puzzle_completed");
    // Still solvable — the check button remains available
    expect(checkButton()).toBeTruthy();
  });

  it("correct SOLVE completes first_puzzle_completed and shows the success panel", () => {
    show();
    placeLetters(["S", "O", "L", "V", "E"]);
    fireEvent.click(checkButton());
    expect(screen.getByText("Starter puzzle complete.")).toBeTruthy();
    expect(loadOnboardingState(USER).completedSteps).toContain("first_puzzle_completed");
  });

  it("Enter checks the answer once all slots are full", () => {
    show();
    placeLetters(["S", "O", "L", "V", "E"]);
    fireEvent.keyDown(screen.getByRole("group", { name: "Answer slots" }), { key: "Enter" });
    expect(screen.getByText("Starter puzzle complete.")).toBeTruthy();
  });

  it("Return to Dashboard calls the supplied navigation action", () => {
    show();
    placeLetters(["S", "O", "L", "V", "E"]);
    fireEvent.click(checkButton());
    fireEvent.click(screen.getByRole("button", { name: /return to dashboard/i }));
    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
  });
});
