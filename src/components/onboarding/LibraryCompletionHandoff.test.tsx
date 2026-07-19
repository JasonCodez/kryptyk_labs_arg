/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LibraryCompletionHandoff, { isLibraryCompletionHandoffEligible } from "./LibraryCompletionHandoff";
import {
  completeOnboardingStep,
  getOnboardingStorageKey,
  loadOnboardingState,
  saveOnboardingState,
  skipOnboarding,
  startOnboarding,
  type OnboardingState,
} from "@/lib/onboarding";

const USER = "u1";

function completeThroughLibrary() {
  completeOnboardingStep(USER, "welcome");
  completeOnboardingStep(USER, "first_puzzle_started");
  completeOnboardingStep(USER, "first_puzzle_completed");
  completeOnboardingStep(USER, "daily_introduced");
  completeOnboardingStep(USER, "library_puzzle_completed");
}

describe("isLibraryCompletionHandoffEligible", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("rejects not_started", () => {
    const state = loadOnboardingState(USER);
    expect(isLibraryCompletionHandoffEligible(state)).toBe(false);
  });

  it("rejects skipped", () => {
    startOnboarding(USER);
    completeThroughLibrary();
    skipOnboarding(USER);
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(false);
  });

  it("rejects completed onboarding", () => {
    startOnboarding(USER);
    completeThroughLibrary();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "completed" });
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(false);
  });

  it("rejects missing first_puzzle_completed", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "daily_introduced");
    completeOnboardingStep(USER, "library_puzzle_completed");
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(false);
  });

  it("rejects missing daily_introduced", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "first_puzzle_completed");
    completeOnboardingStep(USER, "library_puzzle_completed");
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(false);
  });

  it("rejects missing library_puzzle_completed", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "first_puzzle_completed");
    completeOnboardingStep(USER, "daily_introduced");
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(false);
  });

  it("rejects when leaderboard_introduced is already complete", () => {
    startOnboarding(USER);
    completeThroughLibrary();
    completeOnboardingStep(USER, "leaderboard_introduced");
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(false);
  });

  it("accepts eligible active onboarding", () => {
    startOnboarding(USER);
    completeThroughLibrary();
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(true);
  });

  it("accepts eligible paused onboarding", () => {
    startOnboarding(USER);
    completeThroughLibrary();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "paused" });
    expect(isLibraryCompletionHandoffEligible(loadOnboardingState(USER))).toBe(true);
  });
});

describe("LibraryCompletionHandoff", () => {
  const onViewLeaderboard = jest.fn();
  const onBrowseMore = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    onViewLeaderboard.mockClear();
    onBrowseMore.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  function show(open: boolean) {
    return render(
      <LibraryCompletionHandoff open={open} onViewLeaderboard={onViewLeaderboard} onBrowseMore={onBrowseMore} />,
    );
  }

  function dialog(): HTMLElement | null {
    return screen.queryByRole("dialog", { name: "Library puzzle complete." });
  }

  it("renders nothing when open is false", () => {
    show(false);
    expect(dialog()).toBeNull();
  });

  it("renders the dialog and all specified content when open is true", () => {
    show(true);
    const modal = dialog();
    expect(modal).toBeTruthy();
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Starter Path // Step 3 Complete")).toBeTruthy();
    expect(screen.getByText("Library puzzle complete.")).toBeTruthy();
    expect(
      screen.getByText("You’ve completed a puzzle from the library. One final stop remains."),
    ).toBeTruthy();
    expect(screen.getByText("Final Step")).toBeTruthy();
    expect(screen.getByText("See where your score lands")).toBeTruthy();
    expect(
      screen.getByText(
        "Open the Leaderboard to see how your points and completed puzzles compare with other players.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Leaderboard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse More Puzzles" })).toBeTruthy();
  });

  it("shows 3 of 4 complete", () => {
    show(true);
    expect(screen.getByText("Starter Path • 3 of 4 complete")).toBeTruthy();
  });

  it("shows the final Leaderboard objective", () => {
    show(true);
    expect(screen.getByText("See where your score lands")).toBeTruthy();
  });

  it("primary action calls onViewLeaderboard", () => {
    show(true);
    fireEvent.click(screen.getByRole("button", { name: "View Leaderboard" }));
    expect(onViewLeaderboard).toHaveBeenCalledTimes(1);
    expect(onBrowseMore).not.toHaveBeenCalled();
  });

  it("secondary action calls onBrowseMore", () => {
    show(true);
    fireEvent.click(screen.getByRole("button", { name: "Browse More Puzzles" }));
    expect(onBrowseMore).toHaveBeenCalledTimes(1);
    expect(onViewLeaderboard).not.toHaveBeenCalled();
  });

  it("Escape calls onBrowseMore", () => {
    show(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBrowseMore).toHaveBeenCalledTimes(1);
  });

  it("focuses the primary action when opened", () => {
    show(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "View Leaderboard" }));
  });

  it("rendering and clicking do not modify onboarding state", () => {
    startOnboarding(USER);
    completeThroughLibrary();
    const before = localStorage.getItem(getOnboardingStorageKey(USER));
    show(true);
    fireEvent.click(screen.getByRole("button", { name: "View Leaderboard" }));
    expect(localStorage.getItem(getOnboardingStorageKey(USER))).toBe(before);
    const afterState: OnboardingState = loadOnboardingState(USER);
    expect(afterState.completedSteps.includes("leaderboard_introduced")).toBe(false);
  });
});
