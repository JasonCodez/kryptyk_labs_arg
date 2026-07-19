/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawControls from "./JigsawControls";

afterEach(cleanup);

const baseProps = {
  canInteract: true,
  fullscreen: false,
  onPreview: jest.fn(),
  onFullscreen: jest.fn(),
  onExitFullscreen: jest.fn(),
  onHelp: jest.fn(),
  onReturn: jest.fn(),
  onReset: jest.fn(),
};

describe("JigsawControls", () => {
  it("renders all five controls when showUtilities is true", () => {
    render(<JigsawControls {...baseProps} showUtilities />);
    expect(screen.getByRole("button", { name: "Preview image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "How to play" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Return loose pieces to tray" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset puzzle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter fullscreen" })).toBeTruthy();
  });

  it("renders no controls when showUtilities is false", () => {
    render(<JigsawControls {...baseProps} showUtilities={false} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("calls onPreview when Preview is clicked", () => {
    const onPreview = jest.fn();
    render(<JigsawControls {...baseProps} onPreview={onPreview} />);
    screen.getByRole("button", { name: "Preview image" }).click();
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it("calls onHelp when Help is clicked", () => {
    const onHelp = jest.fn();
    render(<JigsawControls {...baseProps} onHelp={onHelp} />);
    screen.getByRole("button", { name: "How to play" }).click();
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it("calls onReturn when Return is clicked", () => {
    const onReturn = jest.fn();
    render(<JigsawControls {...baseProps} onReturn={onReturn} />);
    screen.getByRole("button", { name: "Return loose pieces to tray" }).click();
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("calls onReset when Reset is clicked", () => {
    const onReset = jest.fn();
    render(<JigsawControls {...baseProps} onReset={onReset} />);
    screen.getByRole("button", { name: "Reset puzzle" }).click();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("calls onFullscreen when the fullscreen control is clicked while not fullscreen", () => {
    const onFullscreen = jest.fn();
    render(<JigsawControls {...baseProps} fullscreen={false} onFullscreen={onFullscreen} />);
    screen.getByRole("button", { name: "Enter fullscreen" }).click();
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls onExitFullscreen when the fullscreen control is clicked while fullscreen", () => {
    const onExitFullscreen = jest.fn();
    render(<JigsawControls {...baseProps} fullscreen onExitFullscreen={onExitFullscreen} />);
    screen.getByRole("button", { name: "Exit fullscreen" }).click();
    expect(onExitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("shows the correct visible label and accessible name for both fullscreen states", () => {
    const { rerender } = render(<JigsawControls {...baseProps} fullscreen={false} />);
    let fsButton = screen.getByRole("button", { name: "Enter fullscreen" });
    expect(fsButton.textContent).toContain("Fullscreen");

    rerender(<JigsawControls {...baseProps} fullscreen />);
    fsButton = screen.getByRole("button", { name: "Exit fullscreen" });
    expect(fsButton.textContent).toContain("Exit");
  });

  it("disables Preview, Return, and Reset when canInteract is false", () => {
    render(<JigsawControls {...baseProps} canInteract={false} />);
    expect((screen.getByRole("button", { name: "Preview image" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Return loose pieces to tray" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reset puzzle" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps Help and Fullscreen enabled when canInteract is false", () => {
    render(<JigsawControls {...baseProps} canInteract={false} />);
    expect((screen.getByRole("button", { name: "How to play" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Enter fullscreen" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not fire callbacks for disabled controls", () => {
    const onPreview = jest.fn();
    const onReturn = jest.fn();
    const onReset = jest.fn();
    render(<JigsawControls {...baseProps} canInteract={false} onPreview={onPreview} onReturn={onReturn} onReset={onReset} />);
    screen.getByRole("button", { name: "Preview image" }).click();
    screen.getByRole("button", { name: "Return loose pieces to tray" }).click();
    screen.getByRole("button", { name: "Reset puzzle" }).click();
    expect(onPreview).not.toHaveBeenCalled();
    expect(onReturn).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("gives each control a decorative, non-focusable SVG", () => {
    const { container } = render(<JigsawControls {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(5);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("renders exactly five action buttons when utilities are shown", () => {
    render(<JigsawControls {...baseProps} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("gives every button a clear accessible name", () => {
    render(<JigsawControls {...baseProps} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.getAttribute("aria-label")?.length).toBeGreaterThan(0);
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawControls {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawControls {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });

  it("keeps the container aria-label 'Jigsaw controls'", () => {
    const { container } = render(<JigsawControls {...baseProps} />);
    expect(container.querySelector('[aria-label="Jigsaw controls"]')).toBeTruthy();
  });

  it("preserves the existing prop contract", () => {
    // Compile-time contract check: this render call only type-checks if every original prop
    // name (canInteract, fullscreen, showUtilities, onPreview, onFullscreen, onExitFullscreen,
    // onHelp, onReturn, onReset) still exists with a compatible type.
    render(
      <JigsawControls
        canInteract
        fullscreen={false}
        showUtilities
        onPreview={() => {}}
        onFullscreen={() => {}}
        onExitFullscreen={() => {}}
        onHelp={() => {}}
        onReturn={() => {}}
        onReset={() => {}}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});
