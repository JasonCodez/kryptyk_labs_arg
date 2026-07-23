/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzBattleBriefing, { type WarzBattleBriefingProps } from "./WarzBattleBriefing";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function baseProps(overrides: Partial<WarzBattleBriefingProps> = {}): WarzBattleBriefingProps {
  return {
    challenge: {
      puzzle: { title: "Midnight Sudoku", puzzleType: "sudoku", difficulty: "medium" },
      challenger: { username: "ArenaChallenger", name: null },
      invitedUser: null,
      challengerWager: 50,
      expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    },
    currentUser: { id: "me", username: "arena-player", totalPoints: 875 },
    statusKind: "open",
    accepting: false,
    acceptError: null,
    onAccept: jest.fn(),
    onResume: jest.fn(),
    ...overrides,
  };
}

describe("WarzBattleBriefing", () => {
  it("1. renders PUZZLE WARZ", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("Puzzle Warz")).toBeTruthy();
  });

  it("2. renders exactly one H1", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
  });

  it("3. H1 is You've Been Challenged", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("You’ve Been Challenged");
  });

  it("4. shows exact challenger name", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getAllByText("@ArenaChallenger").length).toBeGreaterThan(0);
  });

  it("5. shows exact puzzle title", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
  });

  it("6. shows puzzle type label", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("Sudoku")).toBeTruthy();
  });

  it("7. shows difficulty when provided", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("medium")).toBeTruthy();
  });

  it("8. shows expiration text", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText(/^\d+h \d+m$/)).toBeTruthy();
  });

  it("9. shows exact wager", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getAllByText("50 Points").length).toBeGreaterThan(0);
  });

  it("10. shows exact total pot", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("100 Points")).toBeTruthy();
  });

  it("11. shows exact balance", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("875 Points")).toBeTruthy();
  });

  it("12. uses tabular numeric presentation", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getAllByText("50 Points")[0].className).toContain("tabular-nums");
  });

  it("13. shows acceptance disclosure", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText(/The winner receives the/)).toBeTruthy();
  });

  it("14. shows all five rule concepts", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByText("No hints")).toBeTruthy();
    expect(screen.getByText("No XP")).toBeTruthy();
    expect(screen.getByText("The timer begins when the puzzle appears")).toBeTruthy();
    expect(screen.getByText("You cannot replay this puzzle in Warz")).toBeTruthy();
    expect(screen.getByText("Accepting commits your wager")).toBeTruthy();
  });

  it("15. open state shows Accept & Start Battle", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "open" })} />);
    expect(screen.getByRole("button", { name: "Accept & Start Battle" })).toBeTruthy();
  });

  it("16. direct state shows Accept Direct Challenge", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "direct" })} />);
    expect(screen.getByRole("button", { name: "Accept Direct Challenge" })).toBeTruthy();
  });

  it("17. accept invokes callback once", () => {
    const onAccept = jest.fn();
    render(<WarzBattleBriefing {...baseProps({ statusKind: "open", onAccept })} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept & Start Battle" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("18. accept respects pending state", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "open", accepting: true })} />);
    expect((screen.getByRole("button", { name: "Accepting challenge…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("19. pending copy is Accepting challenge…", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "open", accepting: true })} />);
    expect(screen.getByText("Accepting challenge…")).toBeTruthy();
  });

  it("20. accept target is at least 52px through class or style", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "open" })} />);
    expect(screen.getByRole("button", { name: "Accept & Start Battle" }).style.minHeight).toBe("52px");
  });

  it("21. resume state shows Play Battle", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "resume" })} />);
    expect(screen.getByRole("button", { name: "Play Battle" })).toBeTruthy();
  });

  it("22. resume invokes callback", () => {
    const onResume = jest.fn();
    render(<WarzBattleBriefing {...baseProps({ statusKind: "resume", onResume })} />);
    fireEvent.click(screen.getByRole("button", { name: "Play Battle" }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("23. resume target is at least 52px", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "resume" })} />);
    expect(screen.getByRole("button", { name: "Play Battle" }).style.minHeight).toBe("52px");
  });

  it("24. own state has no Accept action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "own" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /play battle/i })).toBeNull();
  });

  it("25. private state has no Accept action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "private" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("26. in-progress-other state has no gameplay action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "in-progress-other" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /play battle/i })).toBeNull();
  });

  it("27. expired state has no Accept action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "expired" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("28. cancelled state has no Accept action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "cancelled" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("29. completed state has no Accept action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "completed" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("30. insufficient state has no enabled Accept action", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "insufficient-balance" })} />);
    expect(screen.queryByRole("button", { name: /accept/i })).toBeNull();
  });

  it("31. insufficient state links to /store", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "insufficient-balance" })} />);
    expect(screen.getByRole("link", { name: "Visit Point Store" }).getAttribute("href")).toBe("/store");
  });

  it("32. store link meets minimum target", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "insufficient-balance" })} />);
    expect(screen.getByRole("link", { name: "Visit Point Store" }).style.minHeight).toBe("44px");
  });

  it("33. back link points to /warz", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByRole("link", { name: "Back to Warz Arena" }).getAttribute("href")).toBe("/warz");
  });

  it("34. back link meets minimum target", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.getByRole("link", { name: "Back to Warz Arena" }).style.minHeight).toBe("44px");
  });

  it("35. accept error is visible", () => {
    render(<WarzBattleBriefing {...baseProps({ statusKind: "open", acceptError: "We couldn’t accept this challenge." })} />);
    expect(screen.getByText("We couldn’t accept this challenge.")).toBeTruthy();
  });

  it("36. uses Lucide icons", () => {
    const { container } = render(<WarzBattleBriefing {...baseProps()} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("37. decorative icons are hidden", () => {
    const { container } = render(<WarzBattleBriefing {...baseProps()} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("38. contains no raw emoji", () => {
    const { container } = render(<WarzBattleBriefing {...baseProps()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("39. contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleBriefing.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("40. reduced motion removes briefing entrance movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzBattleBriefing {...baseProps()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).not.toBe("0");
  });

  it("41. performs no API request", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleBriefing.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("42. performs no local point deduction", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleBriefing.tsx"), "utf8");
    expect(source).not.toMatch(/totalPoints\s*[-+]=/);
  });

  it("43. does not display challenger solve time", () => {
    render(<WarzBattleBriefing {...baseProps()} />);
    expect(screen.queryByText(/challengerTime/i)).toBeNull();
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleBriefing.tsx"), "utf8");
    expect(source).not.toMatch(/challengerTime/);
  });
});
