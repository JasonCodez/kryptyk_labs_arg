/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import JigsawCompletionFooter from "./JigsawCompletionFooter";

afterEach(cleanup);

describe("JigsawCompletionFooter", () => {
  it("renders 'Puzzle complete'", () => {
    render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    expect(screen.getByText("Puzzle complete")).toBeTruthy();
  });

  it("uses a heading element for 'Puzzle complete'", () => {
    const { container } = render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
    expect(heading?.textContent).toBe("Puzzle complete");
  });

  it("renders the Claim Rewards button", () => {
    render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeTruthy();
  });

  it("gives the button the accessible name 'Claim Rewards'", () => {
    render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Claim Rewards" }) as HTMLButtonElement;
    expect(button.textContent).toBe("Claim Rewards");
  });

  it("calls onContinue once when activated", () => {
    const onContinue = jest.fn();
    render(<JigsawCompletionFooter continuing={false} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Claim Rewards" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard activation (a real, focusable, non-disabled button element)", () => {
    render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Claim Rewards" }) as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.tabIndex).not.toBe(-1);
    expect(button.disabled).toBe(false);
  });

  it("shows 'Claiming Rewards…' when continuing is true", () => {
    render(<JigsawCompletionFooter continuing onContinue={jest.fn()} />);
    expect(screen.getByText("Claiming Rewards…")).toBeTruthy();
  });

  it("disables the button when continuing", () => {
    render(<JigsawCompletionFooter continuing onContinue={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Claiming Rewards…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("does not call the callback while continuing", () => {
    const onContinue = jest.fn();
    render(<JigsawCompletionFooter continuing onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Claiming Rewards…" }));
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("prevents a rapid double activation from firing onContinue twice", () => {
    const onContinue = jest.fn();
    render(<JigsawCompletionFooter continuing={false} onContinue={onContinue} />);
    const button = screen.getByRole("button", { name: "Claim Rewards" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("exposes aria-label 'Jigsaw completion actions'", () => {
    const { container } = render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    expect(container.querySelector('[aria-label="Jigsaw completion actions"]')).toBeTruthy();
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
  });

  it("has no links or unrelated controls", () => {
    const { container } = render(<JigsawCompletionFooter continuing={false} onContinue={jest.fn()} />);
    expect(container.querySelectorAll("a").length).toBe(0);
    expect(container.querySelectorAll("input, select, textarea").length).toBe(0);
    expect(container.querySelectorAll("button").length).toBe(1);
  });
});
