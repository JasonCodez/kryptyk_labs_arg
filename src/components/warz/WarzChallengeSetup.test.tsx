/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzChallengeSetup, { type WarzChallengeSetupProps } from "./WarzChallengeSetup";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function baseProps(overrides: Partial<WarzChallengeSetupProps> = {}): WarzChallengeSetupProps {
  return {
    puzzle: { id: "p1", title: "Midnight Sudoku", difficulty: "medium", puzzleType: "sudoku" },
    currentUser: { id: "u1", username: "arena-player", totalPoints: 875 },
    wagerInput: "50",
    wager: 50,
    wagerError: null,
    selectedOpponent: null,
    resolvingInvite: false,
    inviteError: null,
    onPresetWager: jest.fn(),
    onWagerInputChange: jest.fn(),
    onSelectOpponent: jest.fn(),
    onRemoveOpponent: jest.fn(),
    onRetryInvite: jest.fn(),
    onStart: jest.fn(),
    onCancel: jest.fn(),
    startDisabled: false,
    ...overrides,
  };
}

describe("WarzChallengeSetup", () => {
  it("renders PUZZLE WARZ", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText(/puzzle warz/i)).toBeTruthy();
  });

  it("renders exactly one H1", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
  });

  it("H1 is Set Your Challenge", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Set Your Challenge");
  });

  it("renders approved supporting copy", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText("Choose your wager and opponent before the timer begins.")).toBeTruthy();
  });

  it("shows exact puzzle title", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getAllByText("Midnight Sudoku").length).toBeGreaterThan(0);
  });

  it("shows puzzle type label", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText("Sudoku")).toBeTruthy();
  });

  it("shows difficulty when supplied", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText("medium")).toBeTruthy();
  });

  it("shows exact available balance", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText("875 Points")).toBeTruthy();
  });

  it("renders all six presets", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    for (const preset of [10, 25, 50, 100, 250, 500]) {
      expect(screen.getByRole("button", { name: String(preset) })).toBeTruthy();
    }
  });

  it("presets are semantic buttons", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByRole("button", { name: "10" }).tagName).toBe("BUTTON");
  });

  it("presets use aria-pressed", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByRole("button", { name: "50" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "100" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("preset activation invokes the exact value", () => {
    const onPresetWager = jest.fn();
    render(<WarzChallengeSetup {...baseProps({ onPresetWager })} />);
    fireEvent.click(screen.getByRole("button", { name: "250" }));
    expect(onPresetWager).toHaveBeenCalledWith(250);
  });

  it("preset controls carry explicit minimum sizing", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByRole("button", { name: "10" }).style.minHeight).toBe("46px");
  });

  it("custom wager has a visible label", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByLabelText(/custom wager/i)).toBeTruthy();
  });

  it("custom wager has numeric input mode", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByLabelText(/custom wager/i).getAttribute("inputMode")).toBe("numeric");
  });

  it("custom wager retains exact input string", () => {
    render(<WarzChallengeSetup {...baseProps({ wagerInput: "007" })} />);
    expect((screen.getByLabelText(/custom wager/i) as HTMLInputElement).value).toBe("007");
  });

  it("invalid wager uses aria-invalid", () => {
    render(<WarzChallengeSetup {...baseProps({ wager: null, wagerError: "Enter a wager." })} />);
    expect(screen.getByLabelText(/custom wager/i).getAttribute("aria-invalid")).toBe("true");
  });

  it("wager error is associated accessibly", () => {
    render(<WarzChallengeSetup {...baseProps({ wager: null, wagerError: "Enter a wager." })} />);
    const input = screen.getByLabelText(/custom wager/i);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Enter a wager.");
  });

  it("shows exact valid wager", () => {
    render(<WarzChallengeSetup {...baseProps({ wager: 250, wagerInput: "250" })} />);
    expect(screen.getAllByText("250 Points").length).toBeGreaterThan(0);
  });

  it("shows exact valid pot", () => {
    render(<WarzChallengeSetup {...baseProps({ wager: 250, wagerInput: "250" })} />);
    expect(screen.getAllByText("500 Points").length).toBeGreaterThan(0);
  });

  it("does not show misleading pot for invalid wager", () => {
    render(<WarzChallengeSetup {...baseProps({ wager: null, wagerError: "Enter a wager." })} />);
    // Balance is still shown, but wager/pot placeholders must not fabricate a value.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows open-to-anyone state", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getAllByText("Open to anyone").length).toBeGreaterThan(0);
  });

  it("shows targeted-opponent state", () => {
    render(
      <WarzChallengeSetup {...baseProps({ selectedOpponent: { id: "o1", username: "RivalOne" } })} />
    );
    expect(screen.getByText(/only the selected player can accept/i)).toBeTruthy();
  });

  it("shows exact selected username", () => {
    render(
      <WarzChallengeSetup {...baseProps({ selectedOpponent: { id: "o1", username: "RivalOne" } })} />
    );
    expect(screen.getAllByText("@RivalOne").length).toBeGreaterThan(0);
  });

  it("remove opponent invokes callback", () => {
    const onRemoveOpponent = jest.fn();
    render(
      <WarzChallengeSetup
        {...baseProps({ selectedOpponent: { id: "o1", username: "RivalOne" }, onRemoveOpponent })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove opponent/i }));
    expect(onRemoveOpponent).toHaveBeenCalledTimes(1);
  });

  it("remove opponent meets minimum target", () => {
    render(
      <WarzChallengeSetup {...baseProps({ selectedOpponent: { id: "o1", username: "RivalOne" } })} />
    );
    expect(screen.getByRole("button", { name: /remove opponent/i }).className).toContain("min-h-11");
  });

  it("resolving-invite state is visible", () => {
    render(<WarzChallengeSetup {...baseProps({ resolvingInvite: true })} />);
    expect(screen.getByText(/resolving your targeted opponent/i)).toBeTruthy();
  });

  it("invite-error state is visible", () => {
    render(<WarzChallengeSetup {...baseProps({ inviteError: "That player is unavailable." })} />);
    expect(screen.getByText("That player is unavailable.")).toBeTruthy();
  });

  it("retry-invite invokes callback", () => {
    const onRetryInvite = jest.fn();
    render(<WarzChallengeSetup {...baseProps({ inviteError: "That player is unavailable.", onRetryInvite })} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetryInvite).toHaveBeenCalledTimes(1);
  });

  it("displays challenge review", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText("Your Challenge")).toBeTruthy();
  });

  it("displays all four required rule concepts", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByText("No hints")).toBeTruthy();
    expect(screen.getByText("No XP")).toBeTruthy();
    expect(screen.getByText("The timer begins when you start")).toBeTruthy();
    expect(screen.getByText("Your challenge is posted only after a valid solve")).toBeTruthy();
  });

  it("Start Battle invokes callback", () => {
    const onStart = jest.fn();
    render(<WarzChallengeSetup {...baseProps({ onStart })} />);
    fireEvent.click(screen.getByRole("button", { name: /start battle/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("Start Battle respects disabled prop", () => {
    render(<WarzChallengeSetup {...baseProps({ startDisabled: true })} />);
    expect(screen.getByRole("button", { name: /start battle/i })).toHaveProperty("disabled", true);
  });

  it("Start Battle target is at least 52px through style or classes", () => {
    render(<WarzChallengeSetup {...baseProps()} />);
    expect(screen.getByRole("button", { name: /start battle/i }).style.minHeight).toBe("52px");
  });

  it("Cancel invokes callback", () => {
    const onCancel = jest.fn();
    render(<WarzChallengeSetup {...baseProps({ onCancel })} />);
    fireEvent.click(screen.getByRole("link", { name: /back to warz arena/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses Lucide icons", () => {
    const { container } = render(<WarzChallengeSetup {...baseProps()} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("decorative icons are hidden", () => {
    const { container } = render(<WarzChallengeSetup {...baseProps()} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains no raw emoji", () => {
    const { container } = render(<WarzChallengeSetup {...baseProps()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeSetup.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes setup entrance movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzChallengeSetup {...baseProps()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).not.toBe("0");
  });

  it("no navigation occurs in the component", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeSetup.tsx"), "utf8");
    expect(source).not.toMatch(/useRouter|router\.push/);
  });

  it("no API request occurs in the component", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeSetup.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("no point deduction occurs in the component", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeSetup.tsx"), "utf8");
    expect(source).not.toMatch(/totalPoints\s*[-+*/]=|totalPoints\s*[-+]/);
  });

  it("no challenge creation occurs in the component", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeSetup.tsx"), "utf8");
    expect(source).not.toMatch(/warz\/create/);
  });
});
