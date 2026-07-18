/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import GameButton, { resolveGameButtonVariant } from "./GameButton";

afterEach(cleanup);

describe("GameButton semantic variants", () => {
  it.each(["primary", "secondary", "accent", "success", "danger"] as const)(
    "renders the %s variant class",
    (variant) => {
      render(<GameButton variant={variant}>Go</GameButton>);
      expect(screen.getByRole("button", { name: "Go" }).className).toContain(`game-btn--${variant}`);
    }
  );

  it("defaults to the primary variant", () => {
    render(<GameButton>Play</GameButton>);
    expect(screen.getByRole("button", { name: "Play" }).className).toContain("game-btn--primary");
  });

  it.each([
    ["pink", "primary"],
    ["purple", "primary"],
    ["cyan", "primary"],
    ["gold", "secondary"],
    ["grass", "success"],
    ["ember", "danger"],
  ] as const)("maps legacy %s onto %s", (legacy, semantic) => {
    expect(resolveGameButtonVariant(legacy)).toBe(semantic);
    render(<GameButton variant={legacy}>Legacy</GameButton>);
    expect(screen.getByRole("button", { name: "Legacy" }).className).toContain(`game-btn--${semantic}`);
  });

  it("needs no palette-specific inline style — fill comes from the variant class", () => {
    render(<GameButton>Styled</GameButton>);
    const button = screen.getByRole("button", { name: "Styled" });
    expect(button.style.backgroundImage).toBe("");
    expect(button.style.borderColor).toBe("");
  });

  it("applies the disabled state", () => {
    render(<GameButton disabled>Nope</GameButton>);
    const button = screen.getByRole("button", { name: "Nope" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("cursor-not-allowed");
  });

  it("pulses when asked and motion is allowed", () => {
    render(<GameButton pulse>Play</GameButton>);
    expect(screen.getByRole("button", { name: "Play" }).className).toContain("animate-candy-breathe");
  });

  it("does not pulse when disabled", () => {
    render(<GameButton pulse disabled>Play</GameButton>);
    expect(screen.getByRole("button", { name: "Play" }).className).not.toContain("animate-candy-breathe");
  });
});

describe("GameButton reduced motion (app accessibility toggle)", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-reduce-animations");
  });

  it("drops the pulse/spark loop entirely", () => {
    render(<GameButton pulse>Play</GameButton>);
    const button = screen.getByRole("button", { name: "Play" });
    expect(button.className).not.toContain("animate-candy-breathe");
    expect(button.querySelector(".animate-candy-spark")).toBeNull();
  });

  it("stays fully interactive", () => {
    const onClick = jest.fn();
    render(<GameButton onClick={onClick}>Go</GameButton>);
    screen.getByRole("button", { name: "Go" }).click();
    expect(onClick).toHaveBeenCalled();
  });
});
