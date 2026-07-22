/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzLobbyHeader from "./WarzLobbyHeader";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function baseProps(overrides: Partial<Parameters<typeof WarzLobbyHeader>[0]> = {}) {
  return {
    currentUser: { id: "u1", username: "arena-player", totalPoints: 875, level: 12 },
    openCount: 3,
    activeCount: 2,
    completedCount: 1,
    targetingRival: false,
    onIssueChallenge: jest.fn(),
    ...overrides,
  };
}

describe("WarzLobbyHeader", () => {
  it("renders COMPETITIVE ARENA", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByText(/competitive arena/i)).toBeTruthy();
  });

  it("renders exactly one H1", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
  });

  it("H1 is Puzzle Warz", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Puzzle Warz");
  });

  it("renders the approved supporting copy", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(
      screen.getByText("Race another player on the same puzzle. Fastest valid solve wins the pot.")
    ).toBeTruthy();
  });

  it("renders Issue a Challenge", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByRole("button", { name: /issue a challenge/i })).toBeTruthy();
  });

  it("issue action is a semantic button", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByRole("button", { name: /issue a challenge/i }).tagName).toBe("BUTTON");
  });

  it("issue action invokes the callback", () => {
    const onIssueChallenge = jest.fn();
    render(<WarzLobbyHeader {...baseProps({ onIssueChallenge })} />);
    fireEvent.click(screen.getByRole("button", { name: /issue a challenge/i }));
    expect(onIssueChallenge).toHaveBeenCalledTimes(1);
  });

  it("issue action meets the minimum target", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    const button = screen.getByRole("button", { name: /issue a challenge/i });
    expect(button.style.minHeight).toBe("48px");
  });

  it("shows exact user points", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByText(/875 Points/)).toBeTruthy();
  });

  it("shows exact user level", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByText("Level 12")).toBeTruthy();
  });

  it("does not show fake user values when user is null", () => {
    render(<WarzLobbyHeader {...baseProps({ currentUser: null })} />);
    expect(screen.queryByText(/Points/)).toBeNull();
    expect(screen.queryByText(/Level/)).toBeNull();
  });

  it("shows open challenge count", () => {
    render(<WarzLobbyHeader {...baseProps({ openCount: 7 })} />);
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText(/Open Challenges/)).toBeTruthy();
  });

  it("shows active battle count", () => {
    render(<WarzLobbyHeader {...baseProps({ activeCount: 4 })} />);
    expect(screen.getByText(/My Active Battles/)).toBeTruthy();
  });

  it("shows completed battle count", () => {
    render(<WarzLobbyHeader {...baseProps({ completedCount: 9 })} />);
    expect(screen.getByText(/Completed Battles/)).toBeTruthy();
  });

  it("shows the targeted-rival message only when requested", () => {
    const { rerender } = render(<WarzLobbyHeader {...baseProps({ targetingRival: false })} />);
    expect(screen.queryByText(/targeting a specific rival/i)).toBeNull();
    rerender(<WarzLobbyHeader {...baseProps({ targetingRival: true })} />);
    expect(screen.getByText(/targeting a specific rival/i)).toBeTruthy();
  });

  it("does not expose an invite ID", () => {
    const { container } = render(<WarzLobbyHeader {...baseProps({ targetingRival: true })} />);
    expect(container.textContent).not.toMatch(/invite=/);
  });

  it("shows the three-step explanation", () => {
    render(<WarzLobbyHeader {...baseProps()} />);
    expect(screen.getByText(/Choose a puzzle/)).toBeTruthy();
    expect(screen.getByText(/Set a wager and post your time/)).toBeTruthy();
    expect(screen.getAllByText(/Fastest valid solve wins the pot/).length).toBeGreaterThan(0);
  });

  it("uses Lucide SVG icons", () => {
    const { container } = render(<WarzLobbyHeader {...baseProps()} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("decorative icons are hidden", () => {
    const { container } = render(<WarzLobbyHeader {...baseProps()} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains no raw emoji", () => {
    const { container } = render(<WarzLobbyHeader {...baseProps({ targetingRival: true })} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzLobbyHeader.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes entrance offsets where applicable", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzLobbyHeader {...baseProps()} />);
    const header = container.querySelector("header") as HTMLElement;
    expect(header.style.opacity).not.toBe("0");
  });

  it("no points or level calculation occurs inside the component", () => {
    render(<WarzLobbyHeader {...baseProps({ currentUser: { id: "u1", username: "a", totalPoints: 0, level: 1 } })} />);
    expect(screen.getByText(/0 Points/)).toBeTruthy();
    expect(screen.getByText("Level 1")).toBeTruthy();
  });

  it("accepts an issueButtonRef", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<WarzLobbyHeader {...baseProps({ issueButtonRef: ref })} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
