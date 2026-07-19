/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import WelcomeModal from "./WelcomeModal";
import { loadOnboardingState } from "@/lib/onboarding";

const HEADING = "Your first solve starts here.";

describe("WelcomeModal (Rookie Run)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    document.documentElement.removeAttribute("data-reduce-animations");
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    document.documentElement.removeAttribute("data-reduce-animations");
  });

  function show() {
    render(<WelcomeModal userId="u1" />);
    act(() => {
      jest.advanceTimersByTime(700);
    });
  }

  it("shows the Rookie Run introduction to a new user", () => {
    show();
    expect(screen.getByText(HEADING)).toBeTruthy();
    expect(screen.getByText("Rookie Run // Mission 01")).toBeTruthy();
    expect(screen.getByText("Complete a guided starter puzzle")).toBeTruthy();
    expect(screen.getByText("Practice run • About 2 minutes • No timer pressure")).toBeTruthy();
    expect(screen.getByText("Learn")).toBeTruthy();
    expect(screen.getByText("Solve")).toBeTruthy();
    expect(screen.getByText("Celebrate")).toBeTruthy();
  });

  it("Begin Rookie Run activates onboarding, completes the welcome step, and closes", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /begin rookie run/i }));

    const state = loadOnboardingState("u1");
    expect(state.status).toBe("active");
    expect(state.completedSteps).toContain("welcome");
    expect(state.currentStep).toBe("first_puzzle_started");

    // Exit animations run on real frames, not jest's fake clock
    jest.useRealTimers();
    await waitForElementToBeRemoved(() => screen.queryByText(HEADING), { timeout: 3000 });
    jest.useFakeTimers();
  });

  it("Explore on My Own marks onboarding skipped and closes", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /explore on my own/i }));

    expect(loadOnboardingState("u1").status).toBe("skipped");

    jest.useRealTimers();
    await waitForElementToBeRemoved(() => screen.queryByText(HEADING), { timeout: 3000 });
    jest.useFakeTimers();
  });

  it("does not show for a legacy welcomed user and migrates them to skipped", () => {
    localStorage.setItem("pw_welcomed_u1", "1");
    show();
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(loadOnboardingState("u1").status).toBe("skipped");
    // Legacy key is preserved, not deleted
    expect(localStorage.getItem("pw_welcomed_u1")).toBe("1");
  });

  it("does not show again once onboarding has left not_started", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /explore on my own/i }));
    cleanup();

    show();
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("no longer renders the old feature-grid welcome content", () => {
    show();
    expect(screen.queryByText("Welcome to PuzzleWarz")).toBeNull();
    expect(screen.queryByText("Warz Mode")).toBeNull();
    expect(screen.queryByText("Hundreds of Puzzles")).toBeNull();
    expect(screen.queryByText(/take the tour/i)).toBeNull();
    expect(screen.queryByTestId("welcome-fireworks")).toBeNull();
  });

  it("primary and secondary actions are keyboard-focusable buttons", () => {
    show();
    const primary = screen.getByRole("button", { name: /begin rookie run/i });
    const secondary = screen.getByRole("button", { name: /explore on my own/i });

    primary.focus();
    expect(document.activeElement).toBe(primary);
    secondary.focus();
    expect(document.activeElement).toBe(secondary);
  });

  it("still renders fully under the app's reduced-motion setting", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    show();
    expect(screen.getByText(HEADING)).toBeTruthy();
    expect(screen.getByRole("button", { name: /begin rookie run/i })).toBeTruthy();
    expect(screen.queryByTestId("welcome-fireworks")).toBeNull();
  });
});
