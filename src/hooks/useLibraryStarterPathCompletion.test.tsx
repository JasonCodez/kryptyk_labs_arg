/** @jest-environment jsdom */

import { useState } from "react";
import { cleanup, render } from "@testing-library/react";
import { useLibraryStarterPathCompletion } from "./useLibraryStarterPathCompletion";
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

function completeFirstPuzzleAndDaily() {
  completeOnboardingStep(USER, "welcome");
  completeOnboardingStep(USER, "first_puzzle_started");
  completeOnboardingStep(USER, "first_puzzle_completed");
  completeOnboardingStep(USER, "daily_introduced");
}

function Harness({
  userId,
  completed,
  enabled,
}: {
  userId: string | null;
  completed: boolean;
  enabled?: boolean;
}) {
  useLibraryStarterPathCompletion({ userId, completed, enabled });
  return null;
}

function show(props: { userId: string | null; completed: boolean; enabled?: boolean }) {
  return render(<Harness {...props} />);
}

describe("useLibraryStarterPathCompletion", () => {
  beforeEach(() => {
    localStorage.clear();
    completeStepMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not record when completed is false", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeStepMock.mockClear();
    show({ userId: USER, completed: false });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record when userId is null", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeStepMock.mockClear();
    show({ userId: null, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record when enabled is false", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeStepMock.mockClear();
    show({ userId: USER, completed: true, enabled: false });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record for not_started onboarding", () => {
    show({ userId: USER, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record for skipped onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    skipOnboarding(USER);
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record for completed onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "completed" });
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record when first_puzzle_completed is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "daily_introduced");
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record when daily_introduced is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "first_puzzle_completed");
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("records library_puzzle_completed for eligible active onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).toHaveBeenCalledTimes(1);
    expect(completeStepMock).toHaveBeenCalledWith(USER, "library_puzzle_completed");
    expect(loadOnboardingState(USER).completedSteps.includes("library_puzzle_completed")).toBe(true);
  });

  it("records library_puzzle_completed for eligible paused onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "paused" });
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).toHaveBeenCalledTimes(1);
    expect(completeStepMock).toHaveBeenCalledWith(USER, "library_puzzle_completed");
  });

  it("does not record again when library_puzzle_completed is already complete", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeOnboardingStep(USER, "library_puzzle_completed");
    completeStepMock.mockClear();
    show({ userId: USER, completed: true });
    expect(completeStepMock).not.toHaveBeenCalled();
  });

  it("does not record twice when rerendered with completed=true", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeStepMock.mockClear();
    const { rerender } = show({ userId: USER, completed: true });
    rerender(<Harness userId={USER} completed={true} />);
    rerender(<Harness userId={USER} completed={true} />);
    expect(completeStepMock).toHaveBeenCalledTimes(1);
  });

  it("does not record twice when unrelated React state changes", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeStepMock.mockClear();

    function Wrapper() {
      const [tick, setTick] = useState(0);
      useLibraryStarterPathCompletion({ userId: USER, completed: true });
      return (
        <button type="button" onClick={() => setTick((t) => t + 1)}>
          {tick}
        </button>
      );
    }

    const { getByRole } = render(<Wrapper />);
    const button = getByRole("button");
    button.click();
    button.click();
    expect(completeStepMock).toHaveBeenCalledTimes(1);
  });

  it("leaves unrelated onboarding steps unchanged", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: true });
    const state = loadOnboardingState(USER);
    expect(state.completedSteps.sort()).toEqual(
      ["welcome", "first_puzzle_started", "first_puzzle_completed", "daily_introduced", "library_puzzle_completed"].sort(),
    );
    expect(
      Object.keys(localStorage).filter((k) => !k.startsWith(getOnboardingStorageKey(USER).split("_v")[0])),
    ).toHaveLength(0);
  });
});
