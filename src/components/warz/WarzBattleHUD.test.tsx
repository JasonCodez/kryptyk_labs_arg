/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import WarzBattleHUD, { type WarzBattleHUDProps } from "./WarzBattleHUD";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function baseProps(overrides: Partial<WarzBattleHUDProps> = {}): WarzBattleHUDProps {
  return {
    puzzleTitle: "Midnight Sudoku",
    wager: 50,
    elapsedSeconds: 0,
    ended: false,
    onForfeit: jest.fn(),
    ...overrides,
  };
}

describe("WarzBattleHUD", () => {
  it("1. renders PUZZLE WARZ", () => {
    render(<WarzBattleHUD {...baseProps()} />);
    expect(screen.getByText("Puzzle Warz")).toBeTruthy();
  });

  it("2. renders the exact puzzle title", () => {
    render(<WarzBattleHUD {...baseProps({ puzzleTitle: "Hidden Word" })} />);
    expect(screen.getByText("Hidden Word")).toBeTruthy();
  });

  it("3. renders the wager label", () => {
    render(<WarzBattleHUD {...baseProps()} />);
    expect(screen.getByText("Wager")).toBeTruthy();
  });

  it("4. renders the exact wager", () => {
    render(<WarzBattleHUD {...baseProps({ wager: 250 })} />);
    expect(screen.getByText("250 Points")).toBeTruthy();
  });

  it("5. renders the battle-time label", () => {
    render(<WarzBattleHUD {...baseProps()} />);
    expect(screen.getByText("Battle time")).toBeTruthy();
  });

  it("6. formats zero as 00:00", () => {
    render(<WarzBattleHUD {...baseProps({ elapsedSeconds: 0 })} />);
    expect(screen.getByText("00:00")).toBeTruthy();
  });

  it("7. formats nine seconds as 00:09", () => {
    render(<WarzBattleHUD {...baseProps({ elapsedSeconds: 9 })} />);
    expect(screen.getByText("00:09")).toBeTruthy();
  });

  it("8. formats 65 seconds as 01:05", () => {
    render(<WarzBattleHUD {...baseProps({ elapsedSeconds: 65 })} />);
    expect(screen.getByText("01:05")).toBeTruthy();
  });

  it("9. does not display negative time", () => {
    render(<WarzBattleHUD {...baseProps({ elapsedSeconds: -5 })} />);
    expect(screen.getByText("00:00")).toBeTruthy();
    expect(screen.queryByText(/-/)).toBeNull();
  });

  it("10. uses tabular numerals", () => {
    render(<WarzBattleHUD {...baseProps({ elapsedSeconds: 65 })} />);
    expect(screen.getByText("01:05").className).toContain("tabular-nums");
  });

  it("11. renders semantic Forfeit button", () => {
    render(<WarzBattleHUD {...baseProps()} />);
    expect(screen.getByRole("button", { name: /forfeit/i }).tagName).toBe("BUTTON");
  });

  it("12. Forfeit invokes callback", () => {
    const onForfeit = jest.fn();
    render(<WarzBattleHUD {...baseProps({ onForfeit })} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    expect(onForfeit).toHaveBeenCalledTimes(1);
  });

  it("13. Forfeit respects disabled state", () => {
    render(<WarzBattleHUD {...baseProps({ forfeitDisabled: true })} />);
    expect((screen.getByRole("button", { name: /forfeit/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("14. Forfeit has at least 44px explicit minimum", () => {
    render(<WarzBattleHUD {...baseProps()} />);
    expect(screen.getByRole("button", { name: /forfeit/i }).style.minHeight).toBe("44px");
  });

  it("15. accepts a Forfeit button ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<WarzBattleHUD {...baseProps({ forfeitButtonRef: ref })} />);
    expect(ref.current).toBe(screen.getByRole("button", { name: /forfeit/i }));
  });

  it("16. puzzle title can wrap", () => {
    render(<WarzBattleHUD {...baseProps()} />);
    expect(screen.getByText("Midnight Sudoku").className).toContain("break-words");
  });

  it("17. uses responsive layout classes", () => {
    const { container } = render(<WarzBattleHUD {...baseProps()} />);
    expect(container.firstElementChild?.className).toMatch(/sm:flex-row/);
  });

  it("18. uses Lucide icons", () => {
    const { container } = render(<WarzBattleHUD {...baseProps()} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("19. decorative icons are hidden", () => {
    const { container } = render(<WarzBattleHUD {...baseProps()} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("20. contains no emoji", () => {
    const { container } = render(<WarzBattleHUD {...baseProps()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("21. contains no raw hex or RGBA values", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleHUD.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("22. does not perform requests", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleHUD.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("23. does not start a timer", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleHUD.tsx"), "utf8");
    expect(source).not.toMatch(/setInterval|setTimeout/);
  });

  it("24. does not call onDone", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleHUD.tsx"), "utf8");
    expect(source).not.toMatch(/onDone/);
  });

  it("25. reduced motion removes HUD Y movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzBattleHUD {...baseProps()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.transform).not.toMatch(/translateY/);
  });
});
