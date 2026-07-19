/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DailySkipControl from "./DailySkipControl";

afterEach(cleanup);

describe("DailySkipControl", () => {
  it("renders nothing when tokens are below one", () => {
    const { container } = render(<DailySkipControl tokens={0} skipping={false} onSkip={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows singular token text", () => {
    render(<DailySkipControl tokens={1} skipping={false} onSkip={jest.fn()} />);
    expect(screen.getByText("1 token")).toBeTruthy();
  });

  it("shows plural token text", () => {
    render(<DailySkipControl tokens={3} skipping={false} onSkip={jest.fn()} />);
    expect(screen.getByText("3 tokens")).toBeTruthy();
  });

  it("uses the default label", () => {
    render(<DailySkipControl tokens={1} skipping={false} onSkip={jest.fn()} />);
    expect(screen.getByText("Skip Today")).toBeTruthy();
  });

  it("uses the compact label", () => {
    render(<DailySkipControl tokens={1} skipping={false} onSkip={jest.fn()} compact />);
    expect(screen.getByText("Skip")).toBeTruthy();
    expect(screen.queryByText("Skip Today")).toBeNull();
  });

  it("calls onSkip when clicked", () => {
    const onSkip = jest.fn();
    render(<DailySkipControl tokens={1} skipping={false} onSkip={onSkip} />);
    screen.getByRole("button").click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("disables the button while skipping", () => {
    render(<DailySkipControl tokens={1} skipping onSkip={jest.fn()} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows the skipping label while skipping", () => {
    render(<DailySkipControl tokens={1} skipping onSkip={jest.fn()} />);
    expect(screen.getByText("Skipping…")).toBeTruthy();
  });

  it("renders a decorative SVG (aria-hidden, not focusable)", () => {
    const { container } = render(<DailySkipControl tokens={1} skipping={false} onSkip={jest.fn()} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<DailySkipControl tokens={2} skipping={false} onSkip={jest.fn()} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });
});
