/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DailyIntroCard from "./DailyIntroCard";
import {
  completeOnboardingStep,
  getOnboardingStorageKey,
  loadOnboardingState,
  saveOnboardingState,
  skipOnboarding,
  startOnboarding,
} from "@/lib/onboarding";

jest.mock("@/lib/onboarding", () => {
  const actual = jest.requireActual("@/lib/onboarding");
  return { ...actual, completeOnboardingStep: jest.fn(actual.completeOnboardingStep) };
});

const completeStepMock = completeOnboardingStep as jest.Mock;

const USER = "u1";
const REGION_NAME = "Starter Path";

function show() {
  render(<DailyIntroCard userId={USER} />);
}

function card(): HTMLElement | null {
  return screen.queryByRole("region", { name: REGION_NAME });
}

function completeFirstPuzzle() {
  completeOnboardingStep(USER, "welcome");
  completeOnboardingStep(USER, "first_puzzle_started");
  completeOnboardingStep(USER, "first_puzzle_completed");
}

describe("DailyIntroCard", () => {
  beforeEach(() => {
    localStorage.clear();
    completeStepMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("is hidden for not_started", () => {
    show();
    expect(card()).toBeNull();
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("is hidden for skipped", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    skipOnboarding(USER);
    show();
    expect(card()).toBeNull();
  });

  it("is hidden for completed", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "completed" });
    show();
    expect(card()).toBeNull();
  });

  it("is hidden before first_puzzle_completed", () => {
    startOnboarding(USER);
    show();
    expect(card()).toBeNull();
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("shows for active onboarding after first_puzzle_completed", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    show();
    expect(card()).toBeTruthy();
    expect(screen.getByText("Fresh puzzles arrive every day.")).toBeTruthy();
    expect(
      screen.getByText(
        "Choose any Daily Puzzle below. Daily challenges refresh each day, and completing them can build your streak.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Starter Path • 2 of 4 discovered")).toBeTruthy();
    expect(screen.getByText("Pick the puzzle that looks most interesting.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /got it/i })).toBeTruthy();
  });

  it("shows for paused onboarding after first_puzzle_completed", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "paused" });
    show();
    expect(card()).toBeTruthy();
  });

  it("is already hidden when daily_introduced is already complete", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    completeOnboardingStep(USER, "daily_introduced");
    completeStepMock.mockClear();
    show();
    expect(card()).toBeNull();
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("records daily_introduced exactly once when shown", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    completeStepMock.mockClear();
    show();
    expect(completeStepMock).toHaveBeenCalledTimes(1);
    expect(completeStepMock).toHaveBeenCalledWith(USER, "daily_introduced");
    const state = loadOnboardingState(USER);
    expect(state.completedSteps.includes("daily_introduced")).toBe(true);
  });

  it("remains visible immediately after recording the step", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    show();
    expect(card()).toBeTruthy();
    const state = loadOnboardingState(USER);
    expect(state.completedSteps.includes("daily_introduced")).toBe(true);
  });

  it("the button hides the card for the current visit without navigating", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    show();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(card()).toBeNull();
  });

  it("does not alter puzzle, streak, XP, or unrelated onboarding steps", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    show();
    const state = loadOnboardingState(USER);
    expect(state.completedSteps.sort()).toEqual(
      ["welcome", "first_puzzle_started", "first_puzzle_completed", "daily_introduced"].sort(),
    );
    expect(
      Object.keys(localStorage).filter((k) => !k.startsWith(getOnboardingStorageKey(USER).split("_v")[0])),
    ).toHaveLength(0);
  });

  it("exposes an accessible region and button", () => {
    startOnboarding(USER);
    completeFirstPuzzle();
    show();
    expect(screen.getByRole("region", { name: REGION_NAME })).toBeTruthy();
    expect(screen.getByRole("button", { name: /got it — show me the puzzles/i })).toBeTruthy();
  });
});
