/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PuzzleXpModal from "./PuzzleXpModal";

afterEach(cleanup);

const baseProps = {
  xpGained: 50,
  pointsEarned: 100,
  oldLevel: 3,
  newLevel: 3,
  newTitle: "Puzzler",
  oldProgress: 40,
  newProgress: 60,
  onDismiss: jest.fn(),
};

describe("PuzzleXpModal", () => {
  it("renders the XP reward", () => {
    render(<PuzzleXpModal {...baseProps} />);
    expect(screen.getByText("XP")).toBeTruthy();
    expect(screen.getByText("Experience")).toBeTruthy();
  });

  it("renders the points reward when points are positive", () => {
    render(<PuzzleXpModal {...baseProps} pointsEarned={100} />);
    expect(screen.getByText("pts")).toBeTruthy();
    expect(screen.getByText("Points")).toBeTruthy();
  });

  it("omits the points reward when points are absent, preserving current behavior", () => {
    render(<PuzzleXpModal {...baseProps} pointsEarned={undefined} />);
    expect(screen.queryByText("pts")).toBeNull();
    expect(screen.queryByText("Points")).toBeNull();
  });

  it("omits the points reward when points are zero, preserving current behavior", () => {
    render(<PuzzleXpModal {...baseProps} pointsEarned={0} />);
    expect(screen.queryByText("pts")).toBeNull();
    expect(screen.queryByText("Points")).toBeNull();
  });

  it("keeps the XP amount and XP unit on one reward line", () => {
    const { container } = render(<PuzzleXpModal {...baseProps} />);
    const xpUnit = screen.getByText("XP");
    const line = xpUnit.closest(".puzzle-xp-reward-line");
    expect(line).toBeTruthy();
    expect(line?.querySelector(".puzzle-xp-reward-amount")).toBeTruthy();
    expect(container.contains(line)).toBe(true);
  });

  it("keeps the points amount and points unit on one reward line", () => {
    render(<PuzzleXpModal {...baseProps} pointsEarned={100} />);
    const ptsUnit = screen.getByText("pts");
    const line = ptsUnit.closest(".puzzle-xp-reward-line");
    expect(line).toBeTruthy();
    expect(line?.querySelector(".puzzle-xp-reward-amount")).toBeTruthy();
  });

  it("uses the safe responsive grid structure for both reward columns", () => {
    const { container } = render(<PuzzleXpModal {...baseProps} pointsEarned={100} />);
    const grid = container.querySelector(".puzzle-xp-rewards");
    expect(grid).toBeTruthy();
    expect(grid?.classList.contains("grid")).toBe(true);
    expect(grid?.classList.contains("grid-cols-2")).toBe(true);
    const columns = container.querySelectorAll(".puzzle-xp-reward");
    expect(columns.length).toBe(2);
    for (const column of columns) {
      expect(column.classList.contains("min-w-0")).toBe(true);
      const line = column.querySelector(".puzzle-xp-reward-line");
      expect(line?.classList.contains("whitespace-nowrap")).toBe(true);
      expect(line?.classList.contains("min-w-0")).toBe(true);
    }
  });

  it("uses a single grid column when points are absent", () => {
    const { container } = render(<PuzzleXpModal {...baseProps} pointsEarned={undefined} />);
    const grid = container.querySelector(".puzzle-xp-rewards");
    expect(grid?.classList.contains("grid-cols-1")).toBe(true);
    expect(container.querySelectorAll(".puzzle-xp-reward").length).toBe(1);
  });

  it("retains a Continue button", () => {
    render(<PuzzleXpModal {...baseProps} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  it("calls onDismiss once when Continue is activated", () => {
    const onDismiss = jest.fn();
    render(<PuzzleXpModal {...baseProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders the safe reward layout for the Normal variant", () => {
    const { container } = render(<PuzzleXpModal {...baseProps} newLevel={3} oldLevel={3} pointsEarned={100} />);
    expect(container.querySelector(".puzzle-xp-modal-card")).toBeTruthy();
    expect(container.querySelector(".puzzle-xp-rewards.grid")).toBeTruthy();
  });

  it("renders the safe reward layout for the Level Up variant", () => {
    const { container } = render(<PuzzleXpModal {...baseProps} newLevel={4} oldLevel={3} pointsEarned={100} />);
    expect(container.querySelector(".puzzle-xp-modal-card")).toBeTruthy();
    expect(container.querySelector(".puzzle-xp-rewards.grid")).toBeTruthy();
    expect(screen.getByText("XP")).toBeTruthy();
    expect(screen.getByText("pts")).toBeTruthy();
  });

  it("gives no reward element a fixed width that would force horizontal overflow", () => {
    const { container } = render(<PuzzleXpModal {...baseProps} pointsEarned={100} />);
    const rewardEls = container.querySelectorAll(".puzzle-xp-reward, .puzzle-xp-reward-line, .puzzle-xp-reward-amount, .puzzle-xp-reward-unit");
    for (const el of rewardEls) {
      const style = (el as HTMLElement).style;
      expect(style.width).toBe("");
      expect(style.minWidth === "" || style.minWidth === "0" || style.minWidth === "0px").toBe(true);
    }
  });
});
