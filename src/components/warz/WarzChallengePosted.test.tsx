/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, render, screen } from "@testing-library/react";
import WarzChallengePosted from "./WarzChallengePosted";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function baseProps(overrides: Partial<Parameters<typeof WarzChallengePosted>[0]> = {}) {
  return {
    puzzleTitle: "Midnight Sudoku",
    solveTimeSeconds: 42,
    wager: 50,
    opponent: null,
    ...overrides,
  };
}

describe("WarzChallengePosted", () => {
  it("renders Challenge Posted", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByText("Challenge Posted")).toBeTruthy();
  });

  it("uses exactly one H1", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
  });

  it('heading has tabIndex="-1"', () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("tabIndex")).toBe("-1");
  });

  it("heading receives focus once on mount", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("focus does not repeat after unrelated rerender", () => {
    const { rerender } = render(<WarzChallengePosted {...baseProps()} />);
    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();
    rerender(<WarzChallengePosted {...baseProps({ wager: 60 })} />);
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("shows exact puzzle title", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
  });

  it("formats sub-minute time", () => {
    render(<WarzChallengePosted {...baseProps({ solveTimeSeconds: 42 })} />);
    expect(screen.getByText("42s")).toBeTruthy();
  });

  it("formats minute-plus time", () => {
    render(<WarzChallengePosted {...baseProps({ solveTimeSeconds: 84 })} />);
    expect(screen.getByText("1m 24s")).toBeTruthy();
  });

  it("shows exact wager", () => {
    render(<WarzChallengePosted {...baseProps({ wager: 75 })} />);
    expect(screen.getByText("75 Points")).toBeTruthy();
  });

  it("shows exact total pot", () => {
    render(<WarzChallengePosted {...baseProps({ wager: 75 })} />);
    expect(screen.getByText("150 Points")).toBeTruthy();
  });

  it("shows Open to anyone without opponent", () => {
    render(<WarzChallengePosted {...baseProps({ opponent: null })} />);
    expect(screen.getByText("Open to anyone")).toBeTruthy();
  });

  it("shows exact username with targeted opponent", () => {
    render(<WarzChallengePosted {...baseProps({ opponent: { id: "o1", username: "RivalOne" } })} />);
    expect(screen.getByText("@RivalOne")).toBeTruthy();
  });

  it("shows open-challenge supporting copy", () => {
    render(<WarzChallengePosted {...baseProps({ opponent: null })} />);
    expect(screen.getByText(/any eligible player can accept it/i)).toBeTruthy();
  });

  it("shows targeted-challenge supporting copy", () => {
    render(<WarzChallengePosted {...baseProps({ opponent: { id: "o1", username: "RivalOne" } })} />);
    expect(screen.getByText(/challenge sent to @RivalOne/i)).toBeTruthy();
  });

  it("shows 24-hour explanation", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByText(/remains open for up to 24 hours/i)).toBeTruthy();
  });

  it("does not claim the opponent has played", () => {
    render(<WarzChallengePosted {...baseProps({ opponent: { id: "o1", username: "RivalOne" } })} />);
    expect(screen.queryByText(/has played|has completed|beat your time/i)).toBeNull();
  });

  it("does not show XP", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.queryByText(/\bXP\b/)).toBeNull();
  });

  it("does not show a winner", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.queryByText(/winner/i)).toBeNull();
  });

  it("does not show a reward", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.queryByText(/reward/i)).toBeNull();
  });

  it("View My Battles links to /warz", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByRole("link", { name: /view my battles/i }).getAttribute("href")).toBe("/warz");
  });

  it("Back to Warz Arena links to /warz", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByRole("link", { name: /back to warz arena/i }).getAttribute("href")).toBe("/warz");
  });

  it("primary action meets 48px minimum", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    expect(screen.getByRole("link", { name: /view my battles/i }).style.minHeight).toBe("48px");
  });

  it("links are semantic, no nested buttons", () => {
    render(<WarzChallengePosted {...baseProps()} />);
    const link = screen.getByRole("link", { name: /view my battles/i });
    expect(link.tagName).toBe("A");
    expect(link.querySelector("button")).toBeNull();
  });

  it("uses Lucide icons", () => {
    const { container } = render(<WarzChallengePosted {...baseProps()} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("decorative icons are hidden", () => {
    const { container } = render(<WarzChallengePosted {...baseProps()} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains no raw emoji", () => {
    const { container } = render(<WarzChallengePosted {...baseProps()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengePosted.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes entrance movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzChallengePosted {...baseProps()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).not.toBe("0");
  });

  it("no API request occurs", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengePosted.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("no point balance calculation occurs", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengePosted.tsx"), "utf8");
    expect(source).not.toMatch(/totalPoints/);
  });

  it("no refund calculation occurs (the copy only references existing server rules, computes no value)", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengePosted.tsx"), "utf8");
    expect(source).not.toMatch(/refund\s*=|refundAmount|calculateRefund/i);
  });
});
