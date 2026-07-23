/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, render, screen } from "@testing-library/react";
import WarzChallengeStatus, { type WarzChallengeStatusProps } from "./WarzChallengeStatus";

afterEach(() => {
  cleanup();
});

function baseProps(overrides: Partial<WarzChallengeStatusProps> = {}): WarzChallengeStatusProps {
  return {
    kind: "open",
    challengerName: "ArenaChallenger",
    invitedUserName: null,
    requiredPoints: 50,
    availablePoints: 875,
    ...overrides,
  };
}

describe("WarzChallengeStatus", () => {
  it("1. own state shows YOUR CHALLENGE", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "own" })} />);
    expect(screen.getByText("YOUR CHALLENGE")).toBeTruthy();
  });

  it("2. own state shows approved ownership copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "own" })} />);
    expect(
      screen.getByText("This is your challenge. Another eligible player must accept it before the battle can continue.")
    ).toBeTruthy();
  });

  it("3. open state shows OPEN CHALLENGE", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "open" })} />);
    expect(screen.getByText("OPEN CHALLENGE")).toBeTruthy();
  });

  it("4. open state shows public acceptance copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "open" })} />);
    expect(screen.getByText("Any eligible player may accept this battle.")).toBeTruthy();
  });

  it("5. direct state shows DIRECT CHALLENGE", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "direct" })} />);
    expect(screen.getByText("DIRECT CHALLENGE")).toBeTruthy();
  });

  it("6. direct state shows targeted copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "direct" })} />);
    expect(screen.getByText("This battle was sent specifically to you.")).toBeTruthy();
  });

  it("7. private state shows PRIVATE CHALLENGE", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "private", invitedUserName: "SomeoneElse" })} />);
    expect(screen.getByText("PRIVATE CHALLENGE")).toBeTruthy();
  });

  it("8. private state does not expose raw user ID", () => {
    const { container } = render(
      <WarzChallengeStatus {...baseProps({ kind: "private", invitedUserName: "SomeoneElse" })} />
    );
    expect(container.textContent).not.toMatch(/cl[a-z0-9]{20,}/i);
    expect(screen.queryByText(/\buser-[a-z0-9-]+\b/i)).toBeNull();
  });

  it("9. resume state shows BATTLE READY", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "resume" })} />);
    expect(screen.getByText("BATTLE READY")).toBeTruthy();
  });

  it("10. resume state shows wager-already-committed copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "resume" })} />);
    expect(
      screen.getByText("You have already accepted this challenge. Your wager is committed and the puzzle is ready.")
    ).toBeTruthy();
  });

  it("11. in-progress-other state shows correct copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "in-progress-other" })} />);
    expect(screen.getByText("This battle is already in progress.")).toBeTruthy();
  });

  it("12. expired state shows correct copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "expired" })} />);
    expect(screen.getByText("This challenge has expired.")).toBeTruthy();
  });

  it("13. cancelled state shows correct copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "cancelled" })} />);
    expect(screen.getByText("This challenge was cancelled.")).toBeTruthy();
  });

  it("14. completed state shows correct copy", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "completed" })} />);
    expect(screen.getByText("This battle has already finished.")).toBeTruthy();
  });

  it("15. insufficient-balance state shows exact required Points", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "insufficient-balance", requiredPoints: 250, availablePoints: 60 })} />);
    expect(screen.getByText("250 Points")).toBeTruthy();
  });

  it("16. insufficient-balance state shows exact available Points", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "insufficient-balance", requiredPoints: 250, availablePoints: 60 })} />);
    expect(screen.getByText("60 Points")).toBeTruthy();
  });

  it("17. status uses visible text", () => {
    render(<WarzChallengeStatus {...baseProps({ kind: "expired" })} />);
    expect(screen.getByText("This challenge has expired.").textContent).toBeTruthy();
  });

  it("18. uses Lucide icons", () => {
    const { container } = render(<WarzChallengeStatus {...baseProps()} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("19. decorative icons are hidden", () => {
    const { container } = render(<WarzChallengeStatus {...baseProps()} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("20. contains no raw emoji", () => {
    const { container } = render(<WarzChallengeStatus {...baseProps({ kind: "insufficient-balance" })} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("21. contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeStatus.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("22. performs no request", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeStatus.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("23. performs no navigation", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeStatus.tsx"), "utf8");
    expect(source).not.toMatch(/useRouter|router\.push|window\.location/);
  });

  it("24. performs no balance mutation", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeStatus.tsx"), "utf8");
    expect(source).not.toMatch(/totalPoints\s*[-+]=|setAvailablePoints/);
  });
});
