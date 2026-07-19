/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HiddenWordInstructionsModal from "./HiddenWordInstructionsModal";

function show(onClose = jest.fn(), wordLength = 5, maxGuesses = 6) {
  const utils = render(
    <HiddenWordInstructionsModal wordLength={wordLength} maxGuesses={maxGuesses} onClose={onClose} />,
  );
  return { ...utils, onClose };
}

afterEach(() => {
  cleanup();
});

describe("HiddenWordInstructionsModal", () => {
  it("renders the heading and briefing copy", () => {
    show();
    expect(screen.getByText("Find the hidden word")).toBeTruthy();
    expect(screen.getByText(/HIDDEN WORD \/\/ BRIEFING/i)).toBeTruthy();
  });

  it("interpolates wordLength and maxGuesses", () => {
    show(jest.fn(), 7, 5);
    expect(
      screen.getByText((_, node) => node?.textContent === "You have 5 attempts to identify today’s 7-letter word."),
    ).toBeTruthy();
  });

  it("renders Correct, Close, and Cold explanations", () => {
    show();
    expect(screen.getByText(/Right letter, right position/)).toBeTruthy();
    expect(screen.getByText(/Letter exists, wrong position/)).toBeTruthy();
    expect(screen.getByText(/Letter is not in the word/)).toBeTruthy();
    expect(screen.getByText("CORRECT")).toBeTruthy();
    expect(screen.getByText("CLOSE")).toBeTruthy();
    expect(screen.getByText("COLD")).toBeTruthy();
  });

  it("Start Solving calls onClose", () => {
    const { onClose } = show();
    fireEvent.click(screen.getByRole("button", { name: /start solving/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape calls onClose", () => {
    const { onClose } = show();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has dialog semantics", () => {
    show();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("hidden-word-briefing-heading");
  });

  it("focuses the primary action when opened", () => {
    show();
    const button = screen.getByRole("button", { name: /start solving/i });
    expect(document.activeElement).toBe(button);
  });

  it("contains no emoji", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = show();
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163", "a78bfa"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no animation classes or inline animation styles", () => {
    const { container } = show();
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });
});
