/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LeaderboardIntroCard from "./LeaderboardIntroCard";
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
  return render(<LeaderboardIntroCard userId={USER} />);
}

function card(): HTMLElement | null {
  return screen.queryByRole("region", { name: REGION_NAME });
}

/** Completes every prior Starter Path milestone (plus welcome / first_puzzle_started,
 *  which a real player would have completed en route) so the final step is eligible
 *  and, once recorded, naturally rolls the whole onboarding flow to "completed". */
function completePriorMilestones() {
  completeOnboardingStep(USER, "welcome");
  completeOnboardingStep(USER, "first_puzzle_started");
  completeOnboardingStep(USER, "first_puzzle_completed");
  completeOnboardingStep(USER, "daily_introduced");
  completeOnboardingStep(USER, "library_puzzle_completed");
}

describe("LeaderboardIntroCard", () => {
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
    completePriorMilestones();
    skipOnboarding(USER);
    show();
    expect(card()).toBeNull();
  });

  it("is hidden for completed onboarding", () => {
    startOnboarding(USER);
    completePriorMilestones();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "completed" });
    show();
    expect(card()).toBeNull();
  });

  it("is hidden when first_puzzle_completed is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "daily_introduced");
    completeOnboardingStep(USER, "library_puzzle_completed");
    show();
    expect(card()).toBeNull();
  });

  it("is hidden when daily_introduced is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "first_puzzle_completed");
    completeOnboardingStep(USER, "library_puzzle_completed");
    show();
    expect(card()).toBeNull();
  });

  it("is hidden when library_puzzle_completed is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "first_puzzle_completed");
    completeOnboardingStep(USER, "daily_introduced");
    show();
    expect(card()).toBeNull();
  });

  it("shows for eligible active onboarding", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    expect(card()).toBeTruthy();
    expect(screen.getByText("This is where every solve counts.")).toBeTruthy();
    expect(
      screen.getByText(
        "Your points and completed puzzles determine your position. Use the Global, Weekly, Monthly, and Following tabs to compare different kinds of progress.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Starter Path Complete • 4 of 4")).toBeTruthy();
    expect(screen.getByText("Keep solving puzzles to move up the rankings.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /got it — view rankings/i })).toBeTruthy();
  });

  it("shows for eligible paused onboarding", () => {
    startOnboarding(USER);
    completePriorMilestones();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "paused" });
    show();
    expect(card()).toBeTruthy();
  });

  it("records leaderboard_introduced exactly once", () => {
    startOnboarding(USER);
    completePriorMilestones();
    completeStepMock.mockClear();
    show();
    expect(completeStepMock).toHaveBeenCalledTimes(1);
    expect(completeStepMock).toHaveBeenCalledWith(USER, "leaderboard_introduced");
    expect(loadOnboardingState(USER).completedSteps.includes("leaderboard_introduced")).toBe(true);
  });

  it("recording the final step sets onboarding status to completed", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    expect(loadOnboardingState(USER).status).toBe("completed");
  });

  it("recording the final step sets completedAt", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    const state = loadOnboardingState(USER);
    expect(state.completedAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(state.completedAt as string))).toBe(false);
  });

  it("remains visible immediately after the state becomes completed", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    expect(card()).toBeTruthy();
    expect(loadOnboardingState(USER).status).toBe("completed");
  });

  it("the button hides the card for the current visit", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    fireEvent.click(screen.getByRole("button", { name: /got it — view rankings/i }));
    expect(card()).toBeNull();
  });

  it("a future remount does not show the card", () => {
    startOnboarding(USER);
    completePriorMilestones();
    const { unmount } = show();
    unmount();
    show();
    expect(card()).toBeNull();
  });

  it("exposes an accessible region and button", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    expect(screen.getByRole("region", { name: REGION_NAME })).toBeTruthy();
    expect(screen.getByRole("button", { name: /got it — view rankings/i })).toBeTruthy();
  });

  it("does not add or remove unrelated onboarding steps", () => {
    startOnboarding(USER);
    completePriorMilestones();
    show();
    const state = loadOnboardingState(USER);
    expect(state.completedSteps.sort()).toEqual(
      [
        "welcome",
        "first_puzzle_started",
        "first_puzzle_completed",
        "daily_introduced",
        "library_puzzle_completed",
        "leaderboard_introduced",
      ].sort(),
    );
    expect(
      Object.keys(localStorage).filter((k) => !k.startsWith(getOnboardingStorageKey(USER).split("_v")[0])),
    ).toHaveLength(0);
  });
});
