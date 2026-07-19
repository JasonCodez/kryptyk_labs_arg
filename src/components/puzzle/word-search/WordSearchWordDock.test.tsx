/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import WordSearchWordDock from "./WordSearchWordDock";

afterEach(cleanup);

const baseProps = {
  foundCount: 1,
  totalWords: 5,
  selectedText: "",
  onOpenWordList: jest.fn(),
};

describe("WordSearchWordDock", () => {
  it("defaults to showing progress", () => {
    render(<WordSearchWordDock {...baseProps} />);
    expect(screen.getByText("1 / 5 found")).toBeTruthy();
  });

  it("hides progress when showProgress is false", () => {
    render(<WordSearchWordDock {...baseProps} showProgress={false} />);
    expect(screen.queryByText("1 / 5 found")).toBeNull();
  });

  it("shows the selected text", () => {
    render(<WordSearchWordDock {...baseProps} selectedText="CAT" />);
    expect(screen.getByText("CAT")).toBeTruthy();
  });

  it('shows "Drag through a word" when selection is empty', () => {
    render(<WordSearchWordDock {...baseProps} selectedText="" />);
    expect(screen.getByText("Drag through a word")).toBeTruthy();
  });

  it("calls onOpenWordList when Words is clicked", () => {
    const onOpenWordList = jest.fn();
    render(<WordSearchWordDock {...baseProps} onOpenWordList={onOpenWordList} />);
    screen.getByRole("button", { name: "Words" }).click();
    expect(onOpenWordList).toHaveBeenCalledTimes(1);
  });

  it("renders a decorative, non-focusable SVG", () => {
    const { container } = render(<WordSearchWordDock {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<WordSearchWordDock {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no gold or yellow styling", () => {
    const { container } = render(<WordSearchWordDock {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#fde74c|#eab308|#fde047|gold|yellow/i);
  });
});
