/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import StarterPathCard from "./StarterPathCard";
import {
  completeOnboardingStep,
  getOnboardingStorageKey,
  loadOnboardingState,
  saveOnboardingState,
  skipOnboarding,
  startOnboarding,
  type OnboardingStep,
} from "@/lib/onboarding";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const USER = "u1";
const REGION_NAME = "Starter Path";
const MILESTONES: readonly OnboardingStep[] = [
  "first_puzzle_completed",
  "daily_introduced",
  "library_puzzle_completed",
  "leaderboard_introduced",
];

function show() {
  render(<StarterPathCard userId={USER} />);
}

function card(): HTMLElement | null {
  return screen.queryByRole("region", { name: REGION_NAME });
}

function completeMilestones(count: number) {
  for (const step of MILESTONES.slice(0, count)) {
    completeOnboardingStep(USER, step);
  }
}

function progressSegments(): HTMLElement[] {
  const list = screen.getByRole("list", { name: /Starter Path progress/ });
  return within(list).getAllByRole("listitem");
}

describe("StarterPathCard", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("is hidden for not_started", () => {
    show();
    expect(card()).toBeNull();
  });

  it("is hidden for skipped", () => {
    startOnboarding(USER);
    skipOnboarding(USER);
    show();
    expect(card()).toBeNull();
  });

  it("is hidden for completed", () => {
    startOnboarding(USER);
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "completed" });
    show();
    expect(card()).toBeNull();
  });

  it("is hidden when all four milestones are complete even if status is active", () => {
    startOnboarding(USER);
    completeMilestones(4);
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "active" });
    show();
    expect(card()).toBeNull();
  });

  it("active with no first solve shows Resume Rookie Run pointing at /rookie-run", () => {
    startOnboarding(USER);
    show();
    expect(card()).toBeTruthy();
    expect(screen.getByText("0 of 4 complete")).toBeTruthy();
    expect(screen.getByText("Complete your first guided solve")).toBeTruthy();
    expect(
      screen.getByText("Finish the short practice puzzle to learn the core loop."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /resume rookie run/i }));
    expect(mockPush).toHaveBeenCalledWith("/rookie-run");
  });

  it("shows for paused onboarding", () => {
    startOnboarding(USER);
    const state = loadOnboardingState(USER);
    saveOnboardingState(USER, { ...state, status: "paused" });
    show();
    expect(card()).toBeTruthy();
  });

  it("one completed milestone shows 1 of 4 and the Daily objective", () => {
    startOnboarding(USER);
    completeMilestones(1);
    show();
    expect(screen.getByText("1 of 4 complete")).toBeTruthy();
    expect(screen.getByText("Discover today’s Daily Puzzle")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /open daily puzzle/i }));
    expect(mockPush).toHaveBeenCalledWith("/daily");
  });

  it("two completed milestones shows 2 of 4 and the library objective", () => {
    startOnboarding(USER);
    completeMilestones(2);
    show();
    expect(screen.getByText("2 of 4 complete")).toBeTruthy();
    expect(screen.getByText("Solve a puzzle from the library")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /browse puzzles/i }));
    expect(mockPush).toHaveBeenCalledWith("/puzzles");
  });

  it("three completed milestones shows 3 of 4 and the leaderboard objective", () => {
    startOnboarding(USER);
    completeMilestones(3);
    show();
    expect(screen.getByText("3 of 4 complete")).toBeTruthy();
    expect(screen.getByText("See where your score lands")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /view leaderboard/i }));
    expect(mockPush).toHaveBeenCalledWith("/leaderboards");
  });

  it("does not count welcome or first_puzzle_started toward progress", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    completeOnboardingStep(USER, "first_puzzle_started");
    show();
    expect(screen.getByText("0 of 4 complete")).toBeTruthy();
    expect(screen.getByText("Complete your first guided solve")).toBeTruthy();
  });

  it("progress segments expose complete/current/upcoming meaning accessibly", () => {
    startOnboarding(USER);
    completeMilestones(1);
    show();
    const segments = progressSegments();
    expect(segments).toHaveLength(4);
    expect(segments[0].getAttribute("aria-label")).toBe(
      "Complete your first guided solve (complete)",
    );
    expect(segments[1].getAttribute("aria-label")).toBe(
      "Discover today’s Daily Puzzle (current)",
    );
    expect(segments[1].getAttribute("aria-current")).toBe("step");
    expect(segments[2].getAttribute("aria-label")).toBe(
      "Solve a puzzle from the library (upcoming)",
    );
    expect(segments[3].getAttribute("aria-label")).toBe(
      "See where your score lands (upcoming)",
    );
  });

  it("completed segments include a non-color checkmark", () => {
    startOnboarding(USER);
    completeMilestones(1);
    show();
    expect(progressSegments()[0].textContent).toContain("✓");
  });

  it("does not alter onboarding state on render or button click", () => {
    startOnboarding(USER);
    completeMilestones(1);
    const before = localStorage.getItem(getOnboardingStorageKey(USER));
    show();
    fireEvent.click(screen.getByRole("button", { name: /open daily puzzle/i }));
    expect(localStorage.getItem(getOnboardingStorageKey(USER))).toBe(before);
  });

  it("never touches the legacy pw_welcomed key", () => {
    startOnboarding(USER);
    show();
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith("pw_welcomed")),
    ).toHaveLength(0);
  });
});
