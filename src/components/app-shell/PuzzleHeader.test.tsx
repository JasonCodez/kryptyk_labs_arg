/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PuzzleHeaderCrosswordActions } from "./PuzzleHeader";

describe("PuzzleHeader crossword overflow", () => {
  beforeEach(() => {
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: window.clearTimeout,
    });
  });

  afterEach(cleanup);

  it("omits More when there are no actionable overflow items", () => {
    render(
      <PuzzleHeaderCrosswordActions
        onClues={jest.fn()}
        onHelp={jest.fn()}
        overflow={[null, false, undefined]}
      />
    );

    expect(screen.queryByRole("button", { name: "More puzzle actions" })).toBeNull();
  });

  it("focuses and keyboard-navigates menu actions, then restores the trigger", async () => {
    render(
      <PuzzleHeaderCrosswordActions
        onClues={jest.fn()}
        onHelp={jest.fn()}
        overflow={[
          <button type="button" key="skip">Skip</button>,
          <button type="button" key="report">Report bug</button>,
        ]}
      />
    );

    const trigger = screen.getByRole("button", { name: "More puzzle actions" });
    fireEvent.click(trigger);

    const skip = await screen.findByRole("menuitem", { name: "Skip" });
    const report = screen.getByRole("menuitem", { name: "Report bug" });
    await waitFor(() => expect(document.activeElement).toBe(skip));

    fireEvent.keyDown(skip, { key: "ArrowDown" });
    expect(document.activeElement).toBe(report);

    fireEvent.keyDown(report, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
