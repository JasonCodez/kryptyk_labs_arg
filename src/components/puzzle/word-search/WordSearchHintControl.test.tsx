/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import WordSearchHintControl from "./WordSearchHintControl";
import WordSearchControls from "./WordSearchControls";

afterEach(cleanup);

const baseProps = {
  tokens: 3,
  pending: false,
  disabled: false,
  onHint: jest.fn(),
};

describe("WordSearchHintControl", () => {
  it("shows Hint and the token count", () => {
    render(<WordSearchHintControl {...baseProps} tokens={28} />);
    expect(screen.getByText("Hint")).toBeTruthy();
    expect(screen.getByText("28 tokens")).toBeTruthy();
  });

  it("calls onHint when clicked", () => {
    const onHint = jest.fn();
    render(<WordSearchHintControl {...baseProps} onHint={onHint} />);
    screen.getByRole("button", { name: /Hint/ }).click();
    expect(onHint).toHaveBeenCalledTimes(1);
  });

  it("shows Finding a word… and is disabled while pending", () => {
    render(<WordSearchHintControl {...baseProps} pending />);
    expect(screen.getByText("Finding a word…")).toBeTruthy();
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("disables the button when the disabled prop is true", () => {
    render(<WordSearchHintControl {...baseProps} disabled />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows No Hint Tokens and links to /store when tokens are zero", () => {
    render(<WordSearchHintControl {...baseProps} tokens={0} />);
    expect(screen.getByText("No Hint Tokens")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Get Hint Tokens" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/store");
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("renders a decorative, non-focusable SVG", () => {
    const { container } = render(<WordSearchHintControl {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<WordSearchHintControl {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no gold or yellow styling", () => {
    const { container } = render(<WordSearchHintControl {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#fde74c|#eab308|#fde047|gold|yellow/i);
  });
});

describe("WordSearchControls zoom rendering", () => {
  const controlsBaseProps = {
    hintTokens: 3,
    hintPending: false,
    disabled: false,
    zoomed: false,
    onHint: jest.fn(),
    onZoomIn: jest.fn(),
    onZoomOut: jest.fn(),
    onResetZoom: jest.fn(),
  };

  it("renders zoom controls when canZoom is true", () => {
    render(<WordSearchControls {...controlsBaseProps} canZoom />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset zoom" })).toBeTruthy();
  });

  it("hides zoom controls when canZoom is false", () => {
    render(<WordSearchControls {...controlsBaseProps} canZoom={false} />);
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Zoom out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset zoom" })).toBeNull();
  });
});
