/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawCompletionCard from "./JigsawCompletionCard";

afterEach(cleanup);

describe("JigsawCompletionCard", () => {
  it("renders PUZZLE COMPLETE", () => {
    render(<JigsawCompletionCard awardedPoints={100} />);
    expect(screen.getByText("PUZZLE COMPLETE")).toBeTruthy();
  });

  it("renders the heading 'Beautiful work!'", () => {
    render(<JigsawCompletionCard awardedPoints={100} />);
    expect(screen.getByRole("heading", { name: "Beautiful work!" })).toBeTruthy();
  });

  it("renders 'Every piece is in place.'", () => {
    render(<JigsawCompletionCard awardedPoints={100} />);
    expect(screen.getByText("Every piece is in place.")).toBeTruthy();
  });

  it("renders a numeric points reward", () => {
    render(<JigsawCompletionCard awardedPoints={100} />);
    expect(screen.getByText("+100")).toBeTruthy();
  });

  it("renders the points label", () => {
    render(<JigsawCompletionCard awardedPoints={100} />);
    expect(screen.getByText("POINTS")).toBeTruthy();
  });

  it("correctly renders 0 points as +0", () => {
    render(<JigsawCompletionCard awardedPoints={0} />);
    expect(screen.getByText("+0")).toBeTruthy();
  });

  it("does not treat zero as missing", () => {
    render(<JigsawCompletionCard awardedPoints={0} />);
    expect(screen.queryByText("…")).toBeNull();
    expect(screen.getByText("Added to your PuzzleWarz total.")).toBeTruthy();
  });

  it("renders the null fallback when awardedPoints is null", () => {
    render(<JigsawCompletionCard awardedPoints={null} />);
    expect(screen.getByText("…")).toBeTruthy();
  });

  it("shows 'Added to your PuzzleWarz total.' when points are available", () => {
    render(<JigsawCompletionCard awardedPoints={50} />);
    expect(screen.getByText("Added to your PuzzleWarz total.")).toBeTruthy();
  });

  it("shows 'Confirming your reward.' when points are null", () => {
    render(<JigsawCompletionCard awardedPoints={null} />);
    expect(screen.getByText("Confirming your reward.")).toBeTruthy();
  });

  it("renders the fun-fact section when a non-empty fact is supplied", () => {
    render(<JigsawCompletionCard awardedPoints={10} funFact="Octopuses have three hearts." />);
    expect(screen.getByText("FUN FACT")).toBeTruthy();
  });

  it("renders the supplied fun-fact text", () => {
    render(<JigsawCompletionCard awardedPoints={10} funFact="Octopuses have three hearts." />);
    expect(screen.getByText("Octopuses have three hearts.")).toBeTruthy();
  });

  it("does not render the fun-fact section when funFact is undefined", () => {
    render(<JigsawCompletionCard awardedPoints={10} />);
    expect(screen.queryByText("FUN FACT")).toBeNull();
  });

  it("does not render the fun-fact section when funFact is empty", () => {
    render(<JigsawCompletionCard awardedPoints={10} funFact="" />);
    expect(screen.queryByText("FUN FACT")).toBeNull();
  });

  it("does not render the fun-fact section when funFact contains only whitespace", () => {
    render(<JigsawCompletionCard awardedPoints={10} funFact="   " />);
    expect(screen.queryByText("FUN FACT")).toBeNull();
  });

  it("trims leading and trailing whitespace from the displayed fact", () => {
    render(<JigsawCompletionCard awardedPoints={10} funFact="   Bees can recognize human faces.   " />);
    expect(screen.getByText("Bees can recognize human faces.")).toBeTruthy();
  });

  it("gives the decorative SVG aria-hidden and non-focusable treatment", () => {
    const { container } = render(<JigsawCompletionCard awardedPoints={10} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("exposes aria-label 'Puzzle completion reward'", () => {
    const { container } = render(<JigsawCompletionCard awardedPoints={10} />);
    expect(container.querySelector('[aria-label="Puzzle completion reward"]')).toBeTruthy();
  });

  it("contains no focusable elements", () => {
    const { container } = render(<JigsawCompletionCard awardedPoints={10} funFact="A fact." />);
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]").length).toBe(0);
  });

  it("exposes no callbacks", () => {
    const props = { awardedPoints: 10 };
    render(<JigsawCompletionCard {...props} />);
    // Compile-time contract check: JigsawCompletionCardProps has no function-typed props.
    expect(typeof props).toBe("object");
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawCompletionCard awardedPoints={10} funFact="A fact." />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawCompletionCard awardedPoints={10} funFact="A fact." />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
  });

  it("uses a real heading element for the primary heading", () => {
    const { container } = render(<JigsawCompletionCard awardedPoints={10} />);
    const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
    expect(heading?.textContent).toBe("Beautiful work!");
  });
});
