/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, render, screen } from "@testing-library/react";
import DailyPuzzleResult from "./DailyPuzzleResult";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function heading(): HTMLElement {
  return screen.getByRole("heading", { level: 2 });
}

describe("DailyPuzzleResult", () => {
  it("renders the DAILY CHALLENGE COMPLETE eyebrow", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(screen.getByText(/daily challenge complete/i)).toBeTruthy();
  });

  it("renders the puzzle name", () => {
    render(<DailyPuzzleResult puzzleName="Crossword" dayNumber={42} streak={4} streakDay={5} />);
    expect(heading().textContent).toContain("Crossword");
  });

  it("renders the Daily number when positive", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(heading().textContent).toContain("#42");
  });

  it("omits a fake Daily number when zero", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={0} streak={4} streakDay={5} />);
    expect(heading().textContent).not.toContain("#");
  });

  it("omits a fake Daily number when negative", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={-1} streak={4} streakDay={5} />);
    expect(heading().textContent).not.toContain("#");
  });

  it("uses an H2 for the result heading", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(heading().tagName).toBe("H2");
  });

  it("the result section references the heading accessibly", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const region = document.querySelector('section[aria-labelledby="daily-result-heading"]');
    expect(region).not.toBeNull();
    expect(heading().id).toBe("daily-result-heading");
  });

  it("the heading has tabIndex -1", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(heading().getAttribute("tabIndex")).toBe("-1");
  });

  it("focus moves to the result heading on mount", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(document.activeElement).toBe(heading());
  });

  it("focus does not repeatedly move after an unrelated rerender", () => {
    const { rerender } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const otherFocusable = document.createElement("button");
    document.body.appendChild(otherFocusable);
    otherFocusable.focus();
    rerender(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={5} streakDay={5} />);
    expect(document.activeElement).toBe(otherFocusable);
    otherFocusable.remove();
  });

  it("shows the just-completed supporting message when reward exists", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 10, xp: 5 }} />
    );
    expect(screen.getByText(/your reward has been recorded/i)).toBeTruthy();
  });

  it("shows the revisit supporting message when reward is absent", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={null} />);
    expect(screen.getByText(/you.ve already completed today.s challenge/i)).toBeTruthy();
  });

  it("shows Reward earned only when reward exists", () => {
    const { rerender } = render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 10, xp: 5 }} />
    );
    expect(screen.getByText(/reward earned/i)).toBeTruthy();
    rerender(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={null} />);
    expect(screen.queryByText(/reward earned/i)).toBeNull();
  });

  it("shows exact returned point value", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 123, xp: 5 }} />
    );
    expect(screen.getByText("+123")).toBeTruthy();
  });

  it("shows exact returned XP value", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 10, xp: 77 }} />
    );
    expect(screen.getByText("+77")).toBeTruthy();
  });

  it("displays an explicitly returned zero-point reward", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 0, xp: 5 }} />
    );
    expect(screen.getByText("+0")).toBeTruthy();
  });

  it("displays an explicitly returned zero-XP reward", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 10, xp: 0 }} />
    );
    expect(screen.getByText("+0")).toBeTruthy();
  });

  it("does not show earned points or XP when reward is absent", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={null} />);
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });

  it("shows current streak", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(screen.getByText("4 day streak")).toBeTruthy();
  });

  it("shows 1 day streak for one", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={1} streakDay={5} />);
    expect(screen.getByText("1 day streak")).toBeTruthy();
  });

  it("shows the current product wording for values greater than one", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={9} streakDay={5} />);
    expect(screen.getByText("9 day streak")).toBeTruthy();
  });

  it("shows No active streak for zero", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={0} streakDay={5} />);
    expect(screen.getByText("No active streak")).toBeTruthy();
  });

  it("shows the next-reward section only when nextReward exists", () => {
    const { rerender } = render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />
    );
    expect(screen.queryByText(/next streak reward/i)).toBeNull();
    rerender(
      <DailyPuzzleResult
        puzzleName="Sudoku"
        dayNumber={42}
        streak={4}
        streakDay={5}
        nextReward={{ points: 125, xp: 60, streakDay: 5 }}
      />
    );
    expect(screen.getByText(/next streak reward/i)).toBeTruthy();
  });

  it("shows the exact next streak day", () => {
    render(
      <DailyPuzzleResult
        puzzleName="Sudoku"
        dayNumber={42}
        streak={4}
        streakDay={5}
        nextReward={{ points: 125, xp: 60, streakDay: 7 }}
      />
    );
    expect(screen.getByText("Day 7")).toBeTruthy();
  });

  it("shows exact next point and XP values", () => {
    render(
      <DailyPuzzleResult
        puzzleName="Sudoku"
        dayNumber={42}
        streak={4}
        streakDay={5}
        nextReward={{ points: 125, xp: 60, streakDay: 7 }}
      />
    );
    expect(screen.getByText(/125 Points/)).toBeTruthy();
    expect(screen.getByText(/60 XP/)).toBeTruthy();
  });

  it("next-reward values do not use earned-reward plus signs", () => {
    render(
      <DailyPuzzleResult
        puzzleName="Sudoku"
        dayNumber={42}
        streak={4}
        streakDay={5}
        nextReward={{ points: 125, xp: 60, streakDay: 7 }}
      />
    );
    expect(screen.queryByText("+125")).toBeNull();
    expect(screen.queryByText("+60")).toBeNull();
  });

  it("shows the reset reminder", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(screen.getByText(/fresh challenge arrives at the next daily reset/i)).toBeTruthy();
  });

  it("Back to Daily Arena links to /daily", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const link = screen.getByRole("link", { name: /back to daily arena/i });
    expect(link.getAttribute("href")).toBe("/daily");
  });

  it("Back action has a 44px minimum through classes", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const link = screen.getByRole("link", { name: /back to daily arena/i });
    expect(link.className).toContain("min-h-11");
  });

  it("Back action is a semantic link", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const link = screen.getByRole("link", { name: /back to daily arena/i });
    expect(link.tagName).toBe("A");
  });

  it("no nested button exists inside the link", () => {
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const link = screen.getByRole("link", { name: /back to daily arena/i });
    expect(link.querySelector("button")).toBeNull();
  });

  it("renders supplied children", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5}>
        <div data-testid="handoff-child">handoff</div>
      </DailyPuzzleResult>
    );
    expect(screen.getByTestId("handoff-child")).toBeTruthy();
  });

  it("uses Lucide SVG icons", () => {
    const { container } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("decorative SVG icons are hidden from assistive technology", () => {
    const { container } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("contains no raw emoji", () => {
    const { container } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("uses no raw hex or RGBA colors in the component source", () => {
    const source = fs.readFileSync(path.join(__dirname, "DailyPuzzleResult.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes the entrance animation", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const motionRoot = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(motionRoot.style.opacity).not.toBe("0");
  });

  it("normal motion uses only a one-shot entrance", () => {
    const { container } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    const motionRoot = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(motionRoot).toBeTruthy();
  });

  it("no looping animation is present", () => {
    const { container } = render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(container.querySelector(".animate-candy-breathe")).toBeNull();
    expect(container.querySelector(".animate-candy-spark")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("no reward counter animation is present", () => {
    render(
      <DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} reward={{ points: 10, xp: 5 }} />
    );
    expect(screen.getByText("+10").tagName).toBe("DD");
  });

  it("no request is performed by the component", () => {
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<DailyPuzzleResult puzzleName="Sudoku" dayNumber={42} streak={4} streakDay={5} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
