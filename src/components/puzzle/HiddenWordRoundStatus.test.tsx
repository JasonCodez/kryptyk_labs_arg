/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import HiddenWordRoundStatus from "./HiddenWordRoundStatus";

afterEach(cleanup);

function show(overrides: Partial<React.ComponentProps<typeof HiddenWordRoundStatus>> = {}) {
  const onHelp = overrides.onHelp ?? jest.fn();
  return render(
    <HiddenWordRoundStatus
      wordLength={5}
      guessesUsed={2}
      maxGuesses={6}
      showHelp
      finalAttempt={false}
      onHelp={onHelp}
      {...overrides}
    />
  );
}

describe("HiddenWordRoundStatus", () => {
  it("shows the word length", () => {
    show({ wordLength: 7 });
    expect(screen.getByText(/7 letters/i)).toBeTruthy();
  });

  it("shows guesses used and the maximum guesses", () => {
    show({ guessesUsed: 3, maxGuesses: 6 });
    expect(screen.getByText(/3 \/ 6 guesses/i)).toBeTruthy();
  });

  it("calls onHelp when the Help button is clicked", () => {
    const onHelp = jest.fn();
    show({ onHelp });
    screen.getByRole("button", { name: "How to play Hidden Word" }).click();
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it("gives the Help button the correct accessible label", () => {
    show();
    expect(screen.getByRole("button", { name: "How to play Hidden Word" })).toBeTruthy();
  });

  it("hides the Help button when showHelp is false", () => {
    show({ showHelp: false });
    expect(screen.queryByRole("button", { name: "How to play Hidden Word" })).toBeNull();
  });

  it("shows the final-attempt warning only when finalAttempt is true", () => {
    const { rerender } = show({ finalAttempt: false });
    expect(screen.queryByText(/final attempt/i)).toBeNull();

    rerender(
      <HiddenWordRoundStatus
        wordLength={5}
        guessesUsed={2}
        maxGuesses={6}
        showHelp
        finalAttempt
        onHelp={jest.fn()}
      />
    );
    expect(screen.getByText(/final attempt — rewards halved/i)).toBeTruthy();
  });

  it("renders no HIDDEN WORD heading", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/HIDDEN WORD/);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders no ATTEMPT METER text", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/ATTEMPT METER/i);
  });

  it("contains no emoji", () => {
    const { container } = show({ finalAttempt: true });
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("has no animation classes or inline animation styles", () => {
    const { container } = show({ finalAttempt: true });
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("renders a decorative SVG (aria-hidden, not focusable)", () => {
    const { container } = show();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("uses var(--pw-info) for the word-length label", () => {
    show({ wordLength: 5 });
    const label = screen.getByText(/5 letters/i);
    expect(label.style.color).toBe("var(--pw-info)");
  });

  it("uses var(--pw-text-primary) for the guesses label", () => {
    show({ guessesUsed: 2, maxGuesses: 6 });
    const label = screen.getByText(/2 \/ 6 guesses/i);
    expect(label.style.color).toBe("var(--pw-text-primary)");
  });

  it("uses the info tokens for the Help icon and button", () => {
    const { container } = show();
    const button = screen.getByRole("button", { name: "How to play Hidden Word" });
    expect(button.style.border).toContain("var(--pw-info-border)");
    expect(button.style.background).toContain("var(--pw-info)");
    const svg = container.querySelector("svg");
    const path = svg?.querySelector("circle,path");
    expect(path?.getAttribute("stroke") ?? path?.getAttribute("fill")).toBe("var(--pw-info)");
  });

  it("keeps the Help button at a 44px touch target", () => {
    show();
    const button = screen.getByRole("button", { name: "How to play Hidden Word" }) as HTMLButtonElement;
    expect(button.style.width).toBe("44px");
    expect(button.style.height).toBe("44px");
  });
});
