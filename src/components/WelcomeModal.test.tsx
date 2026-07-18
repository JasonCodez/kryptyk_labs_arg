/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WelcomeModal from "./WelcomeModal";

describe("WelcomeModal", () => {
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
    render(<WelcomeModal userName="Ada" userId="u1" />);
    act(() => {
      jest.advanceTimersByTime(700);
    });
  }

  it("appears after the delay for a first-time user", () => {
    show();
    expect(screen.getByText("Welcome to PuzzleWarz")).toBeTruthy();
  });

  it("does not appear when the user was already welcomed", () => {
    localStorage.setItem("pw_welcomed_u1", "1");
    show();
    expect(screen.queryByText("Welcome to PuzzleWarz")).toBeNull();
  });

  it("dismissing records the welcome and hides the modal", () => {
    show();
    fireEvent.click(screen.getByText("Skip tour — go to dashboard"));
    expect(localStorage.getItem("pw_welcomed_u1")).toBe("1");
  });

  it("renders the fireworks canvas when motion is allowed", () => {
    show();
    expect(screen.getByTestId("welcome-fireworks")).toBeTruthy();
  });

  it("never starts the fireworks loop under the app's reduced-motion setting", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    show();
    expect(screen.getByText("Welcome to PuzzleWarz")).toBeTruthy();
    expect(screen.queryByTestId("welcome-fireworks")).toBeNull();
  });
});
