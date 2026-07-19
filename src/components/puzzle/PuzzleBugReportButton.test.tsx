/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PuzzleBugReportButton from "./PuzzleBugReportButton";

afterEach(cleanup);

describe("PuzzleBugReportButton", () => {
  it("renders the default visible label when not compact", () => {
    render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" />);
    expect(screen.getByRole("button", { name: /Report Bug/i }).textContent).toContain("Report Bug");
  });

  it("compact trigger has the accessible name Report Bug", () => {
    render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" compact />);
    expect(screen.getByRole("button", { name: "Report Bug" })).toBeTruthy();
  });

  it("compact trigger shows no visible Report Bug text", () => {
    render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" compact />);
    const button = screen.getByRole("button", { name: "Report Bug" });
    expect(button.textContent).toBe("");
  });

  it("compact trigger contains an SVG and no emoji", () => {
    const { container } = render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" compact />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("compact trigger is a 44px touch target", () => {
    render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" compact />);
    const button = screen.getByRole("button", { name: "Report Bug" }) as HTMLButtonElement;
    expect(button.style.width).toBe("44px");
    expect(button.style.height).toBe("44px");
  });

  it("compact trigger opens the existing bug report modal", () => {
    render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" compact />);
    expect(screen.queryByRole("dialog", { name: "Report a bug" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Report Bug" }));
    expect(screen.getByRole("dialog", { name: "Report a bug" })).toBeTruthy();
  });

  it("default (non-compact) trigger opens the same modal", () => {
    render(<PuzzleBugReportButton puzzleId="p1" puzzleTitle="Test Puzzle" />);
    fireEvent.click(screen.getByRole("button", { name: /Report Bug/i }));
    expect(screen.getByRole("dialog", { name: "Report a bug" })).toBeTruthy();
  });
});
