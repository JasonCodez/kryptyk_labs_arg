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

  describe("idle state", () => {
    it("shows the idle prompt and no obsolete label", () => {
      const { container } = render(<WordSearchWordDock {...baseProps} selectedText="" />);
      expect(screen.getByText("Drag or tap to select")).toBeTruthy();
      expect(screen.queryByText("CURRENT SELECTION")).toBeNull();
      expect(container.querySelector('[data-selection-active]')).toBeNull();
    });

    it("does not announce a current selection", () => {
      render(<WordSearchWordDock {...baseProps} selectedText="" />);
      const status = screen.getByRole("status");
      expect(status.textContent).not.toContain("Current selection");
    });
  });

  describe("active state", () => {
    it("shows the selected letters and no idle prompt or obsolete label", () => {
      render(<WordSearchWordDock {...baseProps} selectedText="CAT" />);
      expect(screen.getByText("CAT")).toBeTruthy();
      expect(screen.queryByText("Drag or tap to select")).toBeNull();
      expect(screen.queryByText("CURRENT SELECTION")).toBeNull();
    });

    it("exposes the active-selection state attribute", () => {
      const { container } = render(<WordSearchWordDock {...baseProps} selectedText="CAT" />);
      expect(container.querySelector('[data-selection-active="true"]')).toBeTruthy();
    });

    it("announces the current selection accessibly, without adding it to the visible text", () => {
      render(<WordSearchWordDock {...baseProps} selectedText="CAT" />);
      expect(screen.getByText("CAT").getAttribute("aria-label")).toBe("Current selection: CAT");
      const status = screen.getByRole("status");
      expect(status.textContent).not.toContain("CURRENT SELECTION");
    });
  });
});
