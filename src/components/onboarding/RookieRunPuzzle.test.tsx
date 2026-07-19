/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import RookieRunPuzzle from "./RookieRunPuzzle";
import { completeOnboardingStep, loadOnboardingState } from "@/lib/onboarding";

jest.mock("@/lib/onboarding", () => {
  const actual = jest.requireActual("@/lib/onboarding");
  return { ...actual, completeOnboardingStep: jest.fn(actual.completeOnboardingStep) };
});

const completeStepMock = completeOnboardingStep as jest.Mock;

const USER = "u1";
const CLUE = "What do players do with puzzles?";
const SCRAMBLE = ["V", "E", "S", "O", "L"];
const VICTORY_HEADING = "First solve complete.";

function tile(letter: string): HTMLButtonElement {
  return screen.getByRole("button", { name: `Letter ${letter}` }) as HTMLButtonElement;
}

function slot(n: number): HTMLButtonElement {
  return screen.getByRole("button", { name: new RegExp(`^Answer slot ${n}`) }) as HTMLButtonElement;
}

function checkButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /check answer/i }) as HTMLButtonElement;
}

function continueButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /continue to dashboard/i }) as HTMLButtonElement;
}

function placeLetters(letters: string[]) {
  for (const letter of letters) fireEvent.click(tile(letter));
}

function solvePuzzle() {
  placeLetters(["S", "O", "L", "V", "E"]);
  fireEvent.click(checkButton());
}

function railStage(label: string): HTMLElement {
  const rail = screen.getByRole("list", { name: "Rookie Run progress" });
  const item = within(rail)
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes(label));
  if (!item) throw new Error(`No rail stage labeled ${label}`);
  return item;
}

describe("RookieRunPuzzle", () => {
  const onReturnToDashboard = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    onReturnToDashboard.mockClear();
    completeStepMock.mockClear();
    document.documentElement.removeAttribute("data-reduce-animations");
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

  it("correct SOLVE completes first_puzzle_completed and shows the victory card", () => {
    show();
    solvePuzzle();
    expect(screen.getByText(VICTORY_HEADING)).toBeTruthy();
    expect(screen.getByText("Rookie Run // Mission Complete")).toBeTruthy();
    expect(screen.getByText("You learned the core loop: choose, solve, confirm.")).toBeTruthy();
    expect(screen.getByText("First Solve")).toBeTruthy();
    expect(loadOnboardingState(USER).completedSteps).toContain("first_puzzle_completed");
  });

  it("records first_puzzle_completed exactly once", () => {
    show();
    solvePuzzle();
    const completedCalls = completeStepMock.mock.calls.filter(
      ([, step]) => step === "first_puzzle_completed",
    );
    expect(completedCalls).toEqual([[USER, "first_puzzle_completed"]]);
  });

  it("solving advances the rail: Learn and Solve complete, Celebrate active", () => {
    show();
    expect(railStage("Solve").textContent).toContain("(active)");
    solvePuzzle();
    expect(railStage("Learn").textContent).toContain("(complete)");
    expect(railStage("Solve").textContent).toContain("(complete)");
    expect(railStage("Celebrate").textContent).toContain("(active)");
    expect(railStage("Celebrate").getAttribute("aria-current")).toBe("step");
  });

  it("solving removes the letter tray and Check Answer button", () => {
    show();
    solvePuzzle();
    expect(screen.queryByRole("group", { name: "Letter tiles" })).toBeNull();
    expect(screen.queryByRole("button", { name: /check answer/i })).toBeNull();
    // Completed answer slots stay visible
    expect(slot(1).getAttribute("aria-label")).toBe("Answer slot 1: S");
  });

  it("victory card shows Starter Path progress and the next Daily objective", () => {
    show();
    solvePuzzle();
    expect(screen.getByText("Starter Path • 1 of 4 complete")).toBeTruthy();
    expect(screen.getByText("Discover today’s Daily Puzzle")).toBeTruthy();
  });

  it("moves focus to the Continue to Dashboard button on victory", () => {
    show();
    solvePuzzle();
    expect(document.activeElement).toBe(continueButton());
  });

  it("Enter checks the answer once all slots are full", () => {
    show();
    placeLetters(["S", "O", "L", "V", "E"]);
    fireEvent.keyDown(screen.getByRole("group", { name: "Answer slots" }), { key: "Enter" });
    expect(screen.getByText(VICTORY_HEADING)).toBeTruthy();
  });

  it("Continue to Dashboard calls the supplied navigation action", () => {
    show();
    solvePuzzle();
    fireEvent.click(continueButton());
    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
  });

  it("renders sparkle and ring effects when motion is allowed", () => {
    show();
    solvePuzzle();
    expect(screen.getByTestId("victory-ring")).toBeTruthy();
    expect(screen.getByTestId("victory-sparkles")).toBeTruthy();
  });

  it("reduced motion renders the victory card with no sparkle or ring effects", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    show();
    solvePuzzle();
    expect(screen.getByText(VICTORY_HEADING)).toBeTruthy();
    expect(screen.queryByTestId("victory-ring")).toBeNull();
    expect(screen.queryByTestId("victory-sparkles")).toBeNull();
    expect(document.activeElement).toBe(continueButton());
  });
});
