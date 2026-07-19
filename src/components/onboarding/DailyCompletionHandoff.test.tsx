/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DailyCompletionHandoff from "./DailyCompletionHandoff";
import {
  completeOnboardingStep,
  getOnboardingStorageKey,
  loadOnboardingState,
  saveOnboardingState,
  skipOnboarding,
  startOnboarding,
} from "@/lib/onboarding";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const USER = "u1";
const REGION_NAME = "Starter Path";

function show(props: { userId: string | null; completed: boolean }) {
  return render(<DailyCompletionHandoff {...props} />);
}

function card(): HTMLElement | null {
  return screen.queryByRole("region", { name: REGION_NAME });
}

function completeFirstPuzzleAndDaily() {
  completeOnboardingStep(USER, "welcome");
  completeOnboardingStep(USER, "first_puzzle_started");
  completeOnboardingStep(USER, "first_puzzle_completed");
  completeOnboardingStep(USER, "daily_introduced");
}

describe("DailyCompletionHandoff", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("is hidden when completed is false", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: false });
    expect(card()).toBeNull();
  });

  it("is hidden when userId is null", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: null, completed: true });
    expect(card()).toBeNull();
  });

  it("is hidden for not_started", () => {
    show({ userId: USER, completed: true });
    expect(card()).toBeNull();
  });

  it("is hidden for skipped", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    skipOnboarding(USER);
    show({ userId: USER, completed: true });
    expect(card()).toBeNull();
  });

  it("is hidden for completed onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "completed" });
    show({ userId: USER, completed: true });
    expect(card()).toBeNull();
  });

  it("is hidden when first_puzzle_completed is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "daily_introduced");
    show({ userId: USER, completed: true });
    expect(card()).toBeNull();
  });

  it("is hidden when daily_introduced is missing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    completeOnboardingStep(USER, "first_puzzle_completed");
    show({ userId: USER, completed: true });
    expect(card()).toBeNull();
  });

  it("shows for eligible active onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: true });
    expect(card()).toBeTruthy();
  });

  it("shows for eligible paused onboarding", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "paused" });
    show({ userId: USER, completed: true });
    expect(card()).toBeTruthy();
  });

  it("is hidden once library_puzzle_completed is already complete", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    completeOnboardingStep(USER, "library_puzzle_completed");
    show({ userId: USER, completed: true });
    expect(card()).toBeNull();
  });

  it("shows the correct 2-of-4 progress", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: true });
    expect(screen.getByText("Starter Path • 2 of 4 complete")).toBeTruthy();
  });

  it("shows the library objective", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: true });
    expect(screen.getByText("Solve a puzzle from the library")).toBeTruthy();
    expect(
      screen.getByText(
        "Pick a puzzle type that looks interesting. Your first completed library puzzle advances the Starter Path.",
      ),
    ).toBeTruthy();
  });

  it("clicking the button navigates to /puzzles", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: true });
    fireEvent.click(screen.getByRole("button", { name: /browse puzzle library/i }));
    expect(mockPush).toHaveBeenCalledWith("/puzzles");
  });

  it("rendering and clicking do not alter onboarding state", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    const before = localStorage.getItem(getOnboardingStorageKey(USER));
    show({ userId: USER, completed: true });
    fireEvent.click(screen.getByRole("button", { name: /browse puzzle library/i }));
    expect(localStorage.getItem(getOnboardingStorageKey(USER))).toBe(before);
  });

  it("exposes an accessible region and button", () => {
    startOnboarding(USER);
    completeFirstPuzzleAndDaily();
    show({ userId: USER, completed: true });
    expect(screen.getByRole("region", { name: REGION_NAME })).toBeTruthy();
    expect(screen.getByRole("button", { name: /browse puzzle library/i })).toBeTruthy();
  });
});
