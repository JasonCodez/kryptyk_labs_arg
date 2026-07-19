/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import ActiveClueDock from "./ActiveClueDock";

afterEach(cleanup);

const activeClue = { direction: "across" as const, number: 7, clueText: "A deterministic test clue" };

const baseProps = {
  activeClue,
  canSwitchDirection: true,
  onPrevious: jest.fn(),
  onNext: jest.fn(),
  onSwitchDirection: jest.fn(),
  onOpenClues: jest.fn(),
};

describe("ActiveClueDock", () => {
  it("renders the active clue number, direction, and clue text", () => {
    render(<ActiveClueDock {...baseProps} />);
    expect(screen.getByText("7 across")).toBeTruthy();
    expect(screen.getByText("A deterministic test clue")).toBeTruthy();
  });

  it("renders the empty-state copy when there is no active clue", () => {
    render(<ActiveClueDock {...baseProps} activeClue={null} />);
    expect(screen.getByText("Select a square to begin")).toBeTruthy();
  });

  it("calls onPrevious when Previous is clicked", () => {
    const onPrevious = jest.fn();
    render(<ActiveClueDock {...baseProps} onPrevious={onPrevious} />);
    screen.getByRole("button", { name: "Previous clue" }).click();
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when Next is clicked", () => {
    const onNext = jest.fn();
    render(<ActiveClueDock {...baseProps} onNext={onNext} />);
    screen.getByRole("button", { name: "Next clue" }).click();
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onSwitchDirection when the direction button is clicked", () => {
    const onSwitchDirection = jest.fn();
    render(<ActiveClueDock {...baseProps} onSwitchDirection={onSwitchDirection} />);
    screen.getByRole("button", { name: "Switch between Across and Down" }).click();
    expect(onSwitchDirection).toHaveBeenCalledTimes(1);
  });

  it("respects canSwitchDirection on the direction button", () => {
    render(<ActiveClueDock {...baseProps} canSwitchDirection={false} />);
    const button = screen.getByRole("button", { name: "Switch between Across and Down" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("calls onOpenClues when the clues button is clicked", () => {
    const onOpenClues = jest.fn();
    render(<ActiveClueDock {...baseProps} onOpenClues={onOpenClues} />);
    screen.getByRole("button", { name: "Open all clues" }).click();
    expect(onOpenClues).toHaveBeenCalledTimes(1);
  });

  it("renders exactly four buttons", () => {
    render(<ActiveClueDock {...baseProps} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("renders decorative SVGs that are not focusable", () => {
    const { container } = render(<ActiveClueDock {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<ActiveClueDock {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no visible A/D text", () => {
    const { container } = render(<ActiveClueDock {...baseProps} />);
    expect(container.textContent).not.toContain("A/D");
  });

  it("disables Previous and Next without an active clue", () => {
    render(<ActiveClueDock {...baseProps} activeClue={null} canSwitchDirection={false} />);
    const previous = screen.getByRole("button", { name: "Previous clue" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Next clue" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it("keeps Open Clues enabled when there is no active clue", () => {
    render(<ActiveClueDock {...baseProps} activeClue={null} canSwitchDirection={false} />);
    const button = screen.getByRole("button", { name: "Open all clues" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("disables every button when the whole dock is disabled", () => {
    render(<ActiveClueDock {...baseProps} disabled />);
    for (const button of screen.getAllByRole("button") as HTMLButtonElement[]) {
      expect(button.disabled).toBe(true);
    }
  });
});
